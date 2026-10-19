import type * as cheerio from 'cheerio';

/** 取出節點文字，<br> 視為換行，並丟掉腳本、不間斷空白與首尾空白 */
export function linesOf(el: cheerio.Cheerio<any>): string[] {
  const clone = el.clone();
  clone.find('script, style, iframe, ins, a.__cf_email__').remove();
  clone.find('br').replaceWith('\n');
  return clone
    .text()
    .split('\n')
    .map((line) => line.replace(/[ 　]/g, ' ').trim())
    .filter((line) => line.length > 0);
}
