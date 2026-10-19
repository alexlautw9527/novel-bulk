import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { czbooksAdapter } from '../src/core/sites/czbooks';
import { pickAdapter } from '../src/core/pipeline';

const tocHtml = readFileSync(new URL('./fixtures/czbooks-toc.html', import.meta.url), 'utf8');
const chapterHtml = readFileSync(new URL('./fixtures/czbooks-chapter.html', import.meta.url), 'utf8');
const tocUrl = 'https://czbooks.net/n/dr47npa';

describe('czbooksAdapter.matches', () => {
  it('接受小說狂人的書籍網址，拒絕其他網站', () => {
    // Arrange + Act + Assert
    expect(czbooksAdapter.matches(tocUrl)).toBe(true);
    expect(czbooksAdapter.matches('https://www.czbooks.net/n/x')).toBe(true);
    expect(czbooksAdapter.matches('https://example.com/n/x')).toBe(false);
  });

  it('pickAdapter 依網域選到 czbooks adapter', () => {
    // Arrange + Act + Assert
    expect(pickAdapter(tocUrl).name).toBe('czbooks');
  });
});

describe('czbooksAdapter.parseToc', () => {
  it('解析書名、作者與書籍 id，書名去掉《》', () => {
    // Arrange + Act
    const book = czbooksAdapter.parseToc(tocHtml, tocUrl);

    // Assert
    expect(book.id).toBe('dr47npa');
    expect(book.title).toBe('十日終焉');
    expect(book.author).toBe('殺蟲隊隊員');
  });

  it('章節略過卷標題，連結轉成絕對網址並保留 chapterNumber', () => {
    // Arrange + Act
    const { chapters } = czbooksAdapter.parseToc(tocHtml, tocUrl);

    // Assert：1360 章，第一章與最後一章
    expect(chapters).toHaveLength(1360);
    expect(chapters[0]).toEqual({
      index: 1,
      title: '第1章 空屋',
      url: 'https://czbooks.net/n/dr47npa/drgd3658p?chapterNumber=0',
    });
    expect(chapters.at(-1)?.title).toBe('終：完結感言');
    expect(chapters.some((c) => c.title === '正文卷')).toBe(false);
  });

  it('預設縮圖視為沒有封面', () => {
    // Arrange + Act + Assert
    expect(czbooksAdapter.parseToc(tocHtml, tocUrl).coverUrl).toBeNull();
  });

  it('簡介依 br 分行', () => {
    // Arrange + Act
    const { summary } = czbooksAdapter.parseToc(tocHtml, tocUrl);

    // Assert
    expect(summary[0]).toContain('不后宮');
    expect(summary.length).toBeGreaterThan(2);
  });
});

describe('czbooksAdapter.parseChapter', () => {
  it('標題去掉書名前綴，段落依 br 切開且沒有空段落', () => {
    // Arrange + Act
    const chapter = czbooksAdapter.parseChapter(chapterHtml);

    // Assert
    expect(chapter.title).toBe('第2章 說謊');
    expect(chapter.paragraphs[0]).toBe('女人的尖叫停止，衆人的思緒也戛然而止。');
    expect(chapter.paragraphs.every((p) => p.length > 0)).toBe(true);
    expect(chapter.paragraphs.at(-1)).toBe('上面赫然寫著「說謊者」三個字。');
  });
});

describe('czbooksAdapter.headers', () => {
  const saved = { c: process.env.CZ_COOKIE, u: process.env.CZ_UA };
  afterEach(() => {
    process.env.CZ_COOKIE = saved.c;
    process.env.CZ_UA = saved.u;
    if (saved.c === undefined) delete process.env.CZ_COOKIE;
    if (saved.u === undefined) delete process.env.CZ_UA;
  });

  it('有設定環境變數時帶上 Cookie 與 User-Agent', () => {
    // Arrange
    process.env.CZ_COOKIE = 'cf_clearance=abc';
    process.env.CZ_UA = 'UA-test';

    // Act + Assert
    expect(czbooksAdapter.headers?.()).toEqual({ Cookie: 'cf_clearance=abc', 'User-Agent': 'UA-test' });
  });

  it('沒有設定時不帶額外標頭', () => {
    // Arrange
    delete process.env.CZ_COOKIE;
    delete process.env.CZ_UA;

    // Act + Assert
    expect(czbooksAdapter.headers?.()).toEqual({});
  });
});
