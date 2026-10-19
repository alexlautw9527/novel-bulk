import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildBook } from '../src/core/pipeline';

const tocHtml = readFileSync(new URL('./fixtures/xbanxia-toc.html', import.meta.url), 'utf8');
const chapterHtml = readFileSync(new URL('./fixtures/xbanxia-chapter.html', import.meta.url), 'utf8');
const url = 'https://www.xbanxia.cc/books/249675.html';

async function dirs() {
  const base = await mkdtemp(join(tmpdir(), 'nb-pipe-'));
  return { outDir: join(base, 'out'), cacheDir: join(base, 'cache') };
}

describe('buildBook', () => {
  it('依範圍抓取章節並輸出 epub，失敗章節回報在 failed', async () => {
    // Arrange：只抓第 1 至 3 章，第 2 章網址永遠失敗
    const d = await dirs();
    const get = async (u: string) => {
      if (u === url) return tocHtml;
      if (u.endsWith('42396479.html')) throw new Error('boom');
      if (u.includes('/books/249675/')) return chapterHtml;
      throw new Error('no cover');
    };

    // Act
    const report = await buildBook(url, {
      ...d,
      layout: { cover: false },
      from: 1,
      to: 3,
      get,
      fetch: { minDelayMs: 0, maxDelayMs: 0, retryBaseMs: 0, retries: 0 },
    });

    // Assert：檔名、章節數、失敗章節與書內佔位內容
    expect(report.failed).toEqual([2]);
    expect(report.files.map((f) => f.endsWith('HP：最強魔藥收購商 - 奶茶加布丁.epub'))).toEqual([true]);
    const zip = await JSZip.loadAsync(await readFile(report.files[0]!));
    const chapters = Object.keys(zip.files).filter((n) => n.endsWith('.xhtml') && n.startsWith('OEBPS/chapters/'));
    expect(chapters).toHaveLength(3);
    expect(await zip.file('OEBPS/chapters/ch0002.xhtml')!.async('string')).toContain('本章下載失敗');
    // 簡繁轉換預設為 s2t：「什麽」的簡體殘留字形「态」在書中已轉成正體
    const ch1 = await zip.file('OEBPS/chapters/ch0001.xhtml')!.async('string');
    expect(ch1).not.toContain('态');
  });

  it('網址不屬於任何支援的站點時丟出錯誤', async () => {
    // Arrange + Act + Assert
    const d = await dirs();
    await expect(buildBook('https://example.com/a', { ...d, get: async () => '' })).rejects.toThrow(
      /不支援/,
    );
  });
});
