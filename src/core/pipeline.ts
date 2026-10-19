import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildEpub, type CoverImage } from './epub';
import { fetchChapters, httpGet, type FetchOptions } from './fetcher';
import { DEFAULT_LAYOUT, type LayoutOptions } from './options';
import { czbooksAdapter } from './sites/czbooks';
import { xbanxiaAdapter } from './sites/xbanxia';
import { convertText, sanitizeFilename } from './text';
import type { BookInfo, ChapterContent, SiteAdapter } from './types';

const ADAPTERS: SiteAdapter[] = [xbanxiaAdapter, czbooksAdapter];

export interface BuildOptions {
  outDir: string;
  cacheDir: string;
  layout?: Partial<LayoutOptions>;
  /** 章節順序範圍（含），1-based，依目錄頁出現順序 */
  from?: number;
  to?: number;
  refresh?: boolean;
  get?: (url: string) => Promise<string>;
  fetch?: Partial<FetchOptions>;
  onProgress?: (e: ProgressEvent) => void;
}

export type ProgressEvent =
  | { stage: 'toc'; message: string }
  | { stage: 'fetch'; done: number; total: number; failed: number }
  | { stage: 'build'; message: string };

export interface BuildReport {
  book: BookInfo;
  files: string[];
  /** 失敗章節在目錄頁中的順序 */
  failed: number[];
  warnings: string[];
}

export function pickAdapter(url: string): SiteAdapter {
  const adapter = ADAPTERS.find((a) => a.matches(url));
  if (!adapter) throw new Error(`不支援的網站：${url}`);
  return adapter;
}

/** 預設的抓取函式：附上該站 adapter 指定的標頭（例如 cookie） */
export function defaultGet(adapter: SiteAdapter): (url: string) => Promise<string> {
  return (url) => httpGet(url, adapter.headers?.());
}

export async function loadToc(url: string, get?: (u: string) => Promise<string>): Promise<BookInfo> {
  const adapter = pickAdapter(url);
  return adapter.parseToc(await (get ?? defaultGet(adapter))(url), url);
}

async function loadCover(url: string | null): Promise<CoverImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/jpeg' };
  } catch {
    return null;
  }
}

export async function buildBook(url: string, opts: BuildOptions): Promise<BuildReport> {
  const adapter = pickAdapter(url);
  const get = opts.get ?? defaultGet(adapter);
  const layout = { ...DEFAULT_LAYOUT, ...opts.layout };
  const warnings: string[] = [];

  opts.onProgress?.({ stage: 'toc', message: '解析目錄頁' });
  const full = adapter.parseToc(await get(url), url);

  const from = Math.max(opts.from ?? 1, 1);
  const to = Math.min(opts.to ?? full.chapters.length, full.chapters.length);
  const selected = full.chapters.filter((c) => c.index >= from && c.index <= to);
  if (selected.length === 0) throw new Error(`章節範圍沒有任何章節（共 ${full.chapters.length} 章）`);

  let failedCount = 0;
  const { htmls, failed } = await fetchChapters(selected, {
    cacheDir: join(opts.cacheDir, full.id),
    get,
    refresh: opts.refresh,
    ...opts.fetch,
    onProgress: (p) => {
      if (!p.ok) failedCount++;
      opts.onProgress?.({ stage: 'fetch', done: p.done, total: p.total, failed: failedCount });
    },
  });

  opts.onProgress?.({ stage: 'build', message: '組裝 epub' });
  const contents: (ChapterContent | null)[] = htmls.map((html) => {
    if (html === null) return null;
    const c = adapter.parseChapter(html);
    return {
      title: convertText(c.title, layout.convert),
      paragraphs: c.paragraphs.map((p) => convertText(p, layout.convert)),
    };
  });

  // 範圍輸出的書以 1 起算重新編號，目錄分組與檔名才連續；失敗清單仍回報原本的順序
  const book: BookInfo = {
    ...full,
    title: convertText(full.title, layout.convert),
    author: convertText(full.author, layout.convert),
    summary: full.summary.map((s) => convertText(s, layout.convert)),
    chapters: selected.map((c, i) => ({ ...c, index: i + 1, title: convertText(c.title, layout.convert) })),
  };

  const cover = layout.cover ? await loadCover(full.coverUrl) : null;
  if (layout.cover && !cover) warnings.push('封面下載失敗，已略過封面');

  const epub = await buildEpub({ book, contents, cover, layout });
  await mkdir(opts.outDir, { recursive: true });
  const base = join(opts.outDir, sanitizeFilename(`${book.title} - ${book.author}`));
  const epubPath = `${base}.epub`;
  await writeFile(epubPath, epub);

  return { book, files: [epubPath], failed, warnings };
}
