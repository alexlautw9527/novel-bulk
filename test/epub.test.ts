import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT } from '../src/core/options';
import { buildEpub } from '../src/core/epub';
import type { BookInfo } from '../src/core/types';

const book: BookInfo = {
  id: '1',
  title: '測試書',
  author: '作者甲',
  coverUrl: null,
  summary: ['簡介第一行', '簡介第二行'],
  tocUrl: 'https://example.com/1.html',
  chapters: [1, 2, 3].map((i) => ({ index: i, title: `第${i}章`, url: `u${i}` })),
};

const contents = [
  { title: '第1章', paragraphs: ['甲段', '乙段'] },
  null,
  { title: '第3章', paragraphs: ['丙段 <&>'] },
];

async function open(opts = {}) {
  const buf = await buildEpub({
    book,
    contents,
    cover: null,
    layout: { ...DEFAULT_LAYOUT, groupSize: 2, ...opts },
  });
  return JSZip.loadAsync(buf);
}

describe('buildEpub', () => {
  it('mimetype 是第一個檔案且不壓縮', async () => {
    // Arrange：產生 epub
    const zip = await open();

    // Act：讀檔案順序與內容
    const names = Object.keys(zip.files);

    // Assert：mimetype 排第一，內容符合規格
    expect(names[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
  });

  it('opf 的 spine 包含簡介、目錄頁與全部章節', async () => {
    // Arrange + Act：產生並讀 opf
    const zip = await open();
    const opf = await zip.file('OEBPS/content.opf')!.async('string');

    // Assert：標題、作者、章節與導覽檔都被列出
    expect(opf).toContain('<dc:title>測試書</dc:title>');
    expect(opf).toContain('<dc:creator>作者甲</dc:creator>');
    expect(opf).toContain('chapters/ch0001.xhtml');
    expect(opf).toContain('chapters/ch0003.xhtml');
    expect(opf).toContain('properties="nav"');
    expect(opf).toContain('toc.ncx');
  });

  it('nav 依 group size 產生兩層目錄', async () => {
    // Arrange + Act：group size 2、3 章
    const zip = await open();
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');

    // Assert：兩個群組標題，章節巢狀在底下
    expect(nav).toContain('第 1 至 2 章');
    expect(nav).toContain('第 3 章');
    expect(nav).toContain('chapters/ch0002.xhtml');
  });

  it('ncx 也有巢狀 navPoint', async () => {
    // Arrange + Act
    const zip = await open();
    const ncx = await zip.file('OEBPS/toc.ncx')!.async('string');

    // Assert：群組與章節各有 navPoint
    expect((ncx.match(/<navPoint /g) ?? []).length).toBe(5);
  });

  it('下載失敗的章節輸出佔位內容，內文特殊字元被跳脫', async () => {
    // Arrange + Act
    const zip = await open();
    const failed = await zip.file('OEBPS/chapters/ch0002.xhtml')!.async('string');
    const ok = await zip.file('OEBPS/chapters/ch0003.xhtml')!.async('string');

    // Assert：失敗章節有提示；正常章節的 < & > 被跳脫
    expect(failed).toContain('本章下載失敗');
    expect(ok).toContain('丙段 &lt;&amp;&gt;');
  });

  it('樣式依選項產生：縮排、標題對齊與換頁', async () => {
    // Arrange + Act：縮排 3、標題靠左、不換頁
    const zip = await open({ indent: 3, titleAlign: 'left', pageBreak: false });
    const css = await zip.file('OEBPS/style.css')!.async('string');

    // Assert
    expect(css).toContain('text-indent: 3em');
    expect(css).toContain('text-align: left');
    expect(css).not.toContain('page-break-before');
  });

  it('預設段落之間有半行距離，可改成無或一行', async () => {
    // Arrange + Act：預設與指定 none、full 三種排版
    const css = async (opts = {}) => (await (await open(opts)).file('OEBPS/style.css')!.async('string'));

    // Assert：段落下方留白對應選項
    expect(await css()).toContain('margin: 0 0 0.5em 0');
    expect(await css({ paragraphSpacing: 'none' })).toContain('margin: 0 0 0 0');
    expect(await css({ paragraphSpacing: 'full' })).toContain('margin: 0 0 1em 0');
  });

  it('groupSize 為 0 時 nav 為單層', async () => {
    // Arrange + Act
    const zip = await open({ groupSize: 0 });
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');

    // Assert：沒有群組標題
    expect(nav).not.toContain('第 1 至');
  });
});

describe('renderPreview', () => {
  it('回傳含樣式與段落的獨立 HTML，供 gui 的 iframe 顯示', async () => {
    // Arrange：一章內容與縮排 3 的排版
    const { renderPreview } = await import('../src/core/epub');

    // Act
    const html = renderPreview({ title: '第1章', paragraphs: ['甲 <b>'] }, { ...DEFAULT_LAYOUT, indent: 3 });

    // Assert：樣式內嵌、標題與跳脫後的段落都在
    expect(html).toContain('text-indent: 3em');
    expect(html).toContain('<h1 class="chapter-title">第1章</h1>');
    expect(html).toContain('<p>甲 &lt;b&gt;</p>');
  });
});
