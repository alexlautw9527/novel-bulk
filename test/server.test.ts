import { mkdtemp } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app';

const tocHtml = readFileSync(new URL('./fixtures/xbanxia-toc.html', import.meta.url), 'utf8');
const chapterHtml = readFileSync(new URL('./fixtures/xbanxia-chapter.html', import.meta.url), 'utf8');
const url = 'https://www.xbanxia.cc/books/249675.html';

async function setup() {
  const base = await mkdtemp(join(tmpdir(), 'nb-srv-'));
  const get = async (u: string) => (u === url ? tocHtml : chapterHtml);
  return createApp({
    outDir: join(base, 'out'),
    cacheDir: join(base, 'cache'),
    get,
    fetch: { minDelayMs: 0, maxDelayMs: 0, retries: 0, retryBaseMs: 0 },
  });
}

const post = (app: Awaited<ReturnType<typeof setup>>, path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('server', () => {
  it('POST /api/toc 回傳書籍資訊與章節清單', async () => {
    // Arrange
    const app = await setup();

    // Act
    const res = await post(app, '/api/toc', { url });
    const json = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(json.title).toBe('HP：最強魔藥收購商');
    expect(json.chapters.length).toBeGreaterThan(1000);
  });

  it('POST /api/toc 網址不支援時回 400 與錯誤訊息', async () => {
    // Arrange + Act
    const res = await post(await setup(), '/api/toc', { url: 'https://example.com/x' });

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/不支援/);
  });

  it('POST /api/preview 回傳套用排版的單章 HTML', async () => {
    // Arrange + Act
    const res = await post(await setup(), '/api/preview', { url, index: 2, layout: { indent: 4 } });
    const json = await res.json();

    // Assert
    expect(json.html).toContain('text-indent: 4em');
    expect(json.html).toContain('第2章 對角巷（1）');
  });

  it('POST /api/build 建立工作，完成後可查詢結果與下載檔案', async () => {
    // Arrange
    const app = await setup();

    // Act：建立只抓 2 章的工作，輪詢到結束
    const { jobId } = await (
      await post(app, '/api/build', { url, from: 1, to: 2, layout: { cover: false } })
    ).json();
    let job: any;
    for (let i = 0; i < 100; i++) {
      job = await (await app.request(`/api/jobs/${jobId}`)).json();
      if (job.status !== 'running') break;
      await new Promise((r) => setTimeout(r, 20));
    }

    // Assert：完成、有檔案，且可下載
    expect(job.status).toBe('done');
    expect(job.files).toHaveLength(1);
    const dl = await app.request(`/api/files/${encodeURIComponent(job.files[0])}`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-type')).toContain('epub');
  });

  it('下載檔案時拒絕跳出輸出資料夾的路徑', async () => {
    // Arrange + Act
    const res = await (await setup()).request('/api/files/..%2F..%2Fetc%2Fpasswd');

    // Assert
    expect(res.status).toBe(404);
  });
});
