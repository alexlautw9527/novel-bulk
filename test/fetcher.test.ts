import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchChapters } from '../src/core/fetcher';
import type { ChapterRef } from '../src/core/types';

const chapters: ChapterRef[] = [1, 2, 3].map((i) => ({ index: i, title: `c${i}`, url: `https://x/${i}` }));
const fast = { concurrency: 2, minDelayMs: 0, maxDelayMs: 0, retries: 2, retryBaseMs: 0 };

async function tmp() {
  return mkdtemp(join(tmpdir(), 'nb-'));
}

describe('fetchChapters', () => {
  it('抓取全部章節並寫入快取，第二次執行不再發出請求', async () => {
    // Arrange：假的 fetch 與空的快取資料夾
    const cacheDir = await tmp();
    const get = vi.fn(async (url: string) => `html:${url}`);

    // Act：連續抓兩次
    const first = await fetchChapters(chapters, { cacheDir, get, ...fast });
    const second = await fetchChapters(chapters, { cacheDir, get, ...fast });

    // Assert：第一次 3 次請求，第二次全部命中快取
    expect(get).toHaveBeenCalledTimes(3);
    expect(first.htmls[1]).toBe('html:https://x/2');
    expect(second.failed).toEqual([]);
    expect(second.htmls).toEqual(first.htmls);
  });

  it('單章失敗時重試，仍失敗則記錄在 failed 而不中斷其他章節', async () => {
    // Arrange：第 2 章永遠失敗
    const cacheDir = await tmp();
    const get = vi.fn(async (url: string) => {
      if (url.endsWith('/2')) throw new Error('boom');
      return 'ok';
    });

    // Act
    const result = await fetchChapters(chapters, { cacheDir, get, ...fast });

    // Assert：重試 retries 次後放棄，共 1 + 2 次；其他章節正常
    expect(get.mock.calls.filter(([u]) => u.endsWith('/2'))).toHaveLength(3);
    expect(result.failed).toEqual([2]);
    expect(result.htmls[1]).toBeNull();
    expect(result.htmls[0]).toBe('ok');
  });

  it('重試後成功的章節不算失敗', async () => {
    // Arrange：第 1 章第一次失敗、第二次成功
    const cacheDir = await tmp();
    let n = 0;
    const get = async () => {
      if (n++ === 0) throw new Error('flaky');
      return 'ok';
    };

    // Act
    const result = await fetchChapters(chapters.slice(0, 1), { cacheDir, get, ...fast });

    // Assert
    expect(result.failed).toEqual([]);
    expect(result.htmls[0]).toBe('ok');
  });

  it('refresh 會忽略快取重新請求，並回報進度', async () => {
    // Arrange：先填滿快取
    const cacheDir = await tmp();
    const get = vi.fn(async () => 'v');
    await fetchChapters(chapters, { cacheDir, get, ...fast });
    const progress = vi.fn();

    // Act：refresh 重抓
    await fetchChapters(chapters, { cacheDir, get, refresh: true, onProgress: progress, ...fast });

    // Assert：請求共 6 次，進度回報 3 次
    expect(get).toHaveBeenCalledTimes(6);
    expect(progress).toHaveBeenCalledTimes(3);
  });
});
