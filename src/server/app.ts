import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { renderPreview } from '../core/epub';
import { fetchChapters, type FetchOptions } from '../core/fetcher';
import { DEFAULT_LAYOUT, type LayoutOptions } from '../core/options';
import { buildBook, defaultGet, loadToc, pickAdapter, type ProgressEvent } from '../core/pipeline';
import { convertText } from '../core/text';

export interface AppDeps {
  outDir: string;
  cacheDir: string;
  get?: (url: string) => Promise<string>;
  fetch?: Partial<FetchOptions>;
}

interface Job {
  status: 'running' | 'done' | 'error';
  events: ProgressEvent[];
  files: string[];
  failed: number[];
  warnings: string[];
  error?: string;
}

const MIME: Record<string, string> = { epub: 'application/epub+zip' };

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const jobs = new Map<string, Job>();
  let seq = 0;

  app.onError((err, c) => c.json({ error: err.message }, 400));

  app.post('/api/toc', async (c) => {
    const { url } = await c.req.json<{ url: string }>();
    const book = await loadToc(url, deps.get);
    return c.json(book);
  });

  app.post('/api/preview', async (c) => {
    const { url, index, layout } = await c.req.json<{ url: string; index: number; layout?: Partial<LayoutOptions> }>();
    const merged = { ...DEFAULT_LAYOUT, ...layout };
    const adapter = pickAdapter(url);
    const book = await loadToc(url, deps.get);
    const ref = book.chapters.find((ch) => ch.index === index);
    if (!ref) throw new Error(`沒有第 ${index} 章`);
    const { htmls } = await fetchChapters([ref], { cacheDir: join(deps.cacheDir, book.id), get: deps.get ?? defaultGet(adapter), ...deps.fetch });
    if (htmls[0] === null) throw new Error('這一章下載失敗');
    const content = adapter.parseChapter(htmls[0]!);
    const converted = {
      title: convertText(content.title, merged.convert),
      paragraphs: content.paragraphs.map((p) => convertText(p, merged.convert)),
    };
    return c.json({ html: renderPreview(converted, merged) });
  });

  app.post('/api/build', async (c) => {
    const body = await c.req.json<{
      url: string;
      from?: number;
      to?: number;
      refresh?: boolean;
      layout?: Partial<LayoutOptions>;
    }>();
    const id = String(++seq);
    const job: Job = { status: 'running', events: [], files: [], failed: [], warnings: [] };
    jobs.set(id, job);
    buildBook(body.url, {
      outDir: deps.outDir,
      cacheDir: deps.cacheDir,
      from: body.from,
      to: body.to,
      refresh: body.refresh,
      layout: body.layout,
      get: deps.get,
      fetch: deps.fetch,
      onProgress: (e) => job.events.push(e),
    }).then(
      (r) => {
        Object.assign(job, { status: 'done', files: r.files.map((f) => basename(f)), failed: r.failed, warnings: r.warnings });
      },
      (err: Error) => Object.assign(job, { status: 'error', error: err.message }),
    );
    return c.json({ jobId: id });
  });

  app.get('/api/jobs/:id', (c) => {
    const job = jobs.get(c.req.param('id'));
    if (!job) return c.json({ error: '找不到工作' }, 404);
    return c.json({ ...job, events: job.events.slice(-1) });
  });

  // 以輪詢內部事件陣列的方式推送，避免為單機單使用者引入事件匯流排
  app.get('/api/jobs/:id/events', (c) => {
    const job = jobs.get(c.req.param('id'));
    if (!job) return c.json({ error: '找不到工作' }, 404);
    return streamSSE(c, async (stream) => {
      let sent = 0;
      for (;;) {
        for (; sent < job.events.length; sent++) {
          await stream.writeSSE({ event: 'progress', data: JSON.stringify(job.events[sent]) });
        }
        if (job.status !== 'running') break;
        await stream.sleep(200);
      }
      await stream.writeSSE({
        event: job.status,
        data: JSON.stringify({ files: job.files, failed: job.failed, warnings: job.warnings, error: job.error }),
      });
    });
  });

  app.get('/api/files/:name', async (c) => {
    const name = c.req.param('name');
    // 只允許輸出資料夾內的檔名，不接受任何路徑分隔
    if (name !== basename(name) || name.startsWith('.')) return c.notFound();
    try {
      const data = await readFile(join(deps.outDir, name));
      const ext = name.split('.').pop() ?? '';
      return new Response(data, {
        headers: {
          'content-type': MIME[ext] ?? 'application/octet-stream',
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        },
      });
    } catch {
      return c.notFound();
    }
  });

  return app;
}
