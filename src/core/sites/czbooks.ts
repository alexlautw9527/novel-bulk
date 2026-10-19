import * as cheerio from 'cheerio';
import type { BookInfo, ChapterContent, SiteAdapter } from '../types';
import { linesOf } from './dom';

const DEFAULT_THUMBNAIL = 'default_no_thumbnail';

export const czbooksAdapter: SiteAdapter = {
  name: 'czbooks',

  matches(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'czbooks.net' || host.endsWith('.czbooks.net');
    } catch {
      return false;
    }
  },

  // 該站由 Cloudflare 驗證保護，需要使用者在自己的瀏覽器通過驗證後提供 cookie 與對應的 User-Agent
  headers() {
    const headers: Record<string, string> = {};
    if (process.env.CZ_COOKIE) headers.Cookie = process.env.CZ_COOKIE;
    if (process.env.CZ_UA) headers['User-Agent'] = process.env.CZ_UA;
    return headers;
  },

  parseToc(html, tocUrl): BookInfo {
    const $ = cheerio.load(html);
    const id = new URL(tocUrl).pathname.split('/').filter(Boolean).at(-1) ?? '';
    const img = $('.novel-detail .thumbnail img').attr('src');
    const coverUrl = img && !img.includes(DEFAULT_THUMBNAIL) ? new URL(img, tocUrl).href : null;

    // li.volume 是卷標題，不是章節
    const chapters = $('#chapter-list li:not(.volume) a')
      .toArray()
      .map((a, i) => ({
        index: i + 1,
        title: $(a).text().trim(),
        url: new URL($(a).attr('href') ?? '', tocUrl).href,
      }));

    return {
      id,
      title: $('.novel-detail .info .title').first().text().trim().replace(/^《(.*)》$/, '$1'),
      author: $('.novel-detail .info .author a').first().text().trim(),
      coverUrl,
      summary: linesOf($('.novel-detail .description')),
      tocUrl,
      chapters,
    };
  },

  parseChapter(html): ChapterContent {
    const $ = cheerio.load(html);
    return {
      // .name 的格式是「《書名》章節名」
      title: $('.name').first().text().trim().replace(/^《[^》]*》/, ''),
      paragraphs: linesOf($('.content').first()),
    };
  },
};
