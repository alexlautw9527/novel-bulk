import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { xbanxiaAdapter } from '../src/core/sites/xbanxia';

const tocHtml = readFileSync(new URL('./fixtures/xbanxia-toc.html', import.meta.url), 'utf8');
const chapterHtml = readFileSync(new URL('./fixtures/xbanxia-chapter.html', import.meta.url), 'utf8');
const tocUrl = 'https://www.xbanxia.cc/books/249675.html';

describe('xbanxiaAdapter.matches', () => {
  it('接受半夏小說的書籍目錄頁網址', () => {
    // Arrange：兩個 xbanxia 網域的網址與一個其他網站網址
    // Act + Assert：只有 xbanxia 的網址符合
    expect(xbanxiaAdapter.matches(tocUrl)).toBe(true);
    expect(xbanxiaAdapter.matches('http://xbanxia.cc/books/1.html')).toBe(true);
    expect(xbanxiaAdapter.matches('https://example.com/books/1.html')).toBe(false);
  });
});

describe('xbanxiaAdapter.parseToc', () => {
  it('解析書名、作者、封面與書籍 id', () => {
    // Arrange：真實目錄頁 fixture
    // Act：解析
    const book = xbanxiaAdapter.parseToc(tocHtml, tocUrl);

    // Assert：基本資料正確
    expect(book.id).toBe('249675');
    expect(book.title).toBe('HP：最強魔藥收購商');
    expect(book.author).toBe('奶茶加布丁');
    expect(book.coverUrl).toBe('https://image.xbanxia.cc/files/article/image/249/249675/249675s.jpg');
  });

  it('依目錄順序解析章節並把相對連結轉成絕對網址', () => {
    // Arrange：真實目錄頁 fixture
    // Act：解析
    const { chapters } = xbanxiaAdapter.parseToc(tocHtml, tocUrl);

    // Assert：前兩章的順序、標題與網址
    expect(chapters.length).toBeGreaterThan(1100);
    expect(chapters[0]).toEqual({
      index: 1,
      title: '第1章 楔子：7月初的一天',
      url: 'https://www.xbanxia.cc/books/249675/42396476.html',
    });
    expect(chapters[1]?.index).toBe(2);
    expect(chapters[1]?.title).toBe('第2章 對角巷（1）');
  });

  it('簡介只保留文字段落，不含廣告與 email 防護文字', () => {
    // Arrange：真實目錄頁 fixture
    // Act：解析
    const { summary } = xbanxiaAdapter.parseToc(tocHtml, tocUrl);

    // Assert：有簡介內容，且沒有廣告相關字串
    expect(summary.join('\n')).toContain('原創女主');
    expect(summary.join('\n')).not.toContain('惡意廣告');
    expect(summary.join('\n')).not.toContain('email');
  });
});

describe('xbanxiaAdapter.parseChapter', () => {
  it('取出標題與段落，移除廣告腳本與只有 br 的空行', () => {
    // Arrange：真實章節頁 fixture
    // Act：解析
    const chapter = xbanxiaAdapter.parseChapter(chapterHtml);

    // Assert：標題正確，第一段是正文，且沒有空段落或腳本殘留
    expect(chapter.title).toBe('第2章 對角巷（1）');
    expect(chapter.paragraphs[0]).toBe('什麽能讓一個11歲少女食不下咽，坐立難安？');
    expect(chapter.paragraphs.every((p) => p.trim().length > 0)).toBe(true);
    expect(chapter.paragraphs.join('')).not.toContain('genieessp');
    expect(chapter.paragraphs.join('')).not.toContain('<');
  });
});
