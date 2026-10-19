import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChapterRef } from './types';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function httpGet(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 403 || res.status === 503) {
    throw new Error(`網站拒絕請求（HTTP ${res.status}），可能需要先通過瀏覽器驗證並設定該站的 cookie：${url}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

export interface FetchOptions {
  cacheDir: string;
  get?: (url: string) => Promise<string>;
  concurrency?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** 首次失敗後的額外重試次數 */
  retries?: number;
  retryBaseMs?: number;
  refresh?: boolean;
  onProgress?: (p: { done: number; total: number; chapter: ChapterRef; ok: boolean }) => void;
}

export interface FetchResult {
  /** 與輸入章節同順序；失敗為 null */
  htmls: (string | null)[];
  /** 失敗章節的 index */
  failed: number[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 以網址雜湊命名快取檔，目錄新增或調整章節順序時不會對錯檔 */
function cachePath(dir: string, url: string) {
  return join(dir, `${createHash('sha1').update(url).digest('hex').slice(0, 16)}.html`);
}

export async function fetchChapters(chapters: ChapterRef[], opts: FetchOptions): Promise<FetchResult> {
  const {
    cacheDir,
    get = httpGet,
    concurrency = 3,
    minDelayMs = 300,
    maxDelayMs = 600,
    retries = 3,
    retryBaseMs = 1000,
    refresh = false,
    onProgress,
  } = opts;
  await mkdir(cacheDir, { recursive: true });

  const htmls: (string | null)[] = new Array(chapters.length).fill(null);
  const failed: number[] = [];
  let done = 0;
  let next = 0;

  async function load(chapter: ChapterRef): Promise<string | null> {
    const file = cachePath(cacheDir, chapter.url);
    if (!refresh) {
      try {
        return await readFile(file, 'utf8');
      } catch {
        // 沒有快取，往下請求
      }
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
      await sleep(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
      try {
        const html = await get(chapter.url);
        await writeFile(file, html);
        return html;
      } catch {
        if (attempt < retries) await sleep(retryBaseMs * 2 ** attempt);
      }
    }
    return null;
  }

  async function worker() {
    while (next < chapters.length) {
      const i = next++;
      const chapter = chapters[i]!;
      const html = await load(chapter);
      htmls[i] = html;
      if (html === null) failed.push(chapter.index);
      onProgress?.({ done: ++done, total: chapters.length, chapter, ok: html !== null });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, chapters.length) }, worker));
  return { htmls, failed: failed.sort((a, b) => a - b) };
}
