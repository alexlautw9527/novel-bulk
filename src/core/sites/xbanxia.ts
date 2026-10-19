import * as cheerio from 'cheerio';
import type { BookInfo, ChapterContent, SiteAdapter } from '../types';
import { linesOf } from './dom';

export const xbanxiaAdapter: SiteAdapter = {
  name: 'xbanxia',

  matches(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'xbanxia.cc' || host.endsWith('.xbanxia.cc');
    } catch {
      return false;
    }
  },

  parseToc(html, tocUrl): BookInfo {
    const $ = cheerio.load(html);
    const id = /\/books\/(\d+)\.html/.exec(tocUrl)?.[1] ?? '';
    const cover = $('.book-img img').attr('data-original') ?? null;

    // 作者位於「作者︰」那一行的連結；簡介的段落夾在廣告區塊之間，只取 .describe-html 直接底下的 <p>
    const summary = $('.describe-html > p')
      .toArray()
      .flatMap((p) => linesOf($(p)));

    const chapters = $('.book-list li a')
      .toArray()
      .map((a, i) => ({
        index: i + 1,
        title: $(a).text().trim(),
        url: new URL($(a).attr('href') ?? '', tocUrl).href,
      }));

    return {
      id,
      title: $('.book-describe h1').first().text().trim(),
      author: $('.book-describe p a[href^="/author/"]').first().text().trim(),
      coverUrl: cover,
      summary,
      tocUrl,
      chapters,
    };
  },

  parseChapter(html): ChapterContent {
    const $ = cheerio.load(html);
    return {
      title: $('#nr_title').text().trim(),
      paragraphs: linesOf($('#nr1')),
    };
  },
};
