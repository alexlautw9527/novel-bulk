import JSZip from 'jszip';
import { groupChapters } from './toc';
import type { LayoutOptions } from './options';
import type { BookInfo, ChapterContent } from './types';

export interface CoverImage {
  data: Buffer;
  mime: string;
}

export interface BuildEpubInput {
  book: BookInfo;
  /** 與 book.chapters 同順序；null 代表下載失敗 */
  contents: (ChapterContent | null)[];
  cover: CoverImage | null;
  layout: LayoutOptions;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const chapterFile = (index: number) => `chapters/ch${String(index).padStart(4, '0')}.xhtml`;

/** depth 為頁面所在子目錄層數，用來指向根目錄的 style.css */
function xhtml(title: string, body: string, depth = 0) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-TW" lang="zh-TW">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="${'../'.repeat(depth)}style.css"/></head>
<body>
${body}
</body>
</html>`;
}

export function buildCss(l: LayoutOptions): string {
  const spacing = { none: '0', half: '0.5em', full: '1em' }[l.paragraphSpacing];
  const font = l.fontFamily ? `  font-family: ${l.fontFamily};\n` : '';
  const lineHeight = l.lineHeight ? `  line-height: ${l.lineHeight};\n` : '';
  const pageBreak = l.pageBreak ? '  page-break-before: always;\n  break-before: page;\n' : '';
  return `body {
${font}${lineHeight}  margin: 0;
}
p {
  margin: 0 0 ${spacing} 0;
  text-indent: ${l.indent}em;
}
h1.chapter-title {
${pageBreak}  text-align: ${l.titleAlign};
  font-size: 1.3em;
  margin: 2em 0 1.5em 0;
}
h1.book-title { text-align: center; margin: 3em 0 0.5em 0; }
p.author { text-align: center; text-indent: 0; margin-bottom: 2em; }
p.plain, ul.toc, ul.toc li { text-indent: 0; }
ul.toc { list-style: none; padding-left: 0; margin: 0; }
ul.toc ul { list-style: none; padding-left: 1em; }
ul.toc li { margin: 0.4em 0; }
.cover { text-align: center; }
.cover img { max-width: 100%; max-height: 100%; }
`;
}

function navTree(
  groups: ReturnType<typeof groupChapters>,
  li: (c: { index: number; title: string }) => string,
  groupWrap: (title: string, inner: string) => string,
  list: (inner: string) => string,
) {
  if (groups.length === 1 && groups[0]!.title === null) return list(groups[0]!.chapters.map(li).join('\n'));
  return list(groups.map((g) => groupWrap(g.title!, list(g.chapters.map(li).join('\n')))).join('\n'));
}

export async function buildEpub({ book, contents, cover, layout }: BuildEpubInput): Promise<Buffer> {
  const zip = new JSZip();
  // 規格要求 mimetype 為第一個檔案且不壓縮
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );

  const o = (path: string, data: string | Buffer) => zip.file(`OEBPS/${path}`, data);
  o('style.css', buildCss(layout));

  const groups = groupChapters(book.chapters, layout.groupSize);
  const manifest: string[] = [];
  const spine: string[] = [];
  const addPage = (id: string, href: string) => {
    manifest.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
  };

  const useCover = layout.cover && cover !== null;
  if (useCover) {
    const ext = cover.mime.includes('png') ? 'png' : 'jpg';
    o(`cover.${ext}`, cover.data);
    manifest.push(`<item id="cover-img" href="cover.${ext}" media-type="${cover.mime}" properties="cover-image"/>`);
    o('cover.xhtml', xhtml(book.title, `<div class="cover"><img src="cover.${ext}" alt="${esc(book.title)}"/></div>`));
    addPage('cover', 'cover.xhtml');
  }

  if (layout.summaryPage) {
    const summary = book.summary.map((s) => `<p class="plain">${esc(s)}</p>`).join('\n');
    o(
      'intro.xhtml',
      xhtml(
        book.title,
        `<h1 class="book-title">${esc(book.title)}</h1>\n<p class="author">${esc(book.author)}</p>\n${summary}`,
      ),
    );
    addPage('intro', 'intro.xhtml');
  }

  const tocLi = (c: { index: number; title: string }) =>
    `<li><a href="${chapterFile(c.index)}">${esc(c.title)}</a></li>`;
  const tocBody = navTree(
    groups,
    tocLi,
    (t, inner) => `<li><span>${esc(t)}</span>\n${inner}</li>`,
    (inner) => `<ul class="toc">\n${inner}\n</ul>`,
  );
  o('toc.xhtml', xhtml('目錄', `<h1 class="chapter-title">目錄</h1>\n${tocBody}`));
  addPage('tocpage', 'toc.xhtml');

  const navBody = navTree(
    groups,
    tocLi,
    (t, inner) => `<li><span>${esc(t)}</span>\n${inner}</li>`,
    (inner) => `<ol>\n${inner}\n</ol>`,
  );
  o(
    'nav.xhtml',
    xhtml('目錄', `<nav epub:type="toc" id="toc"><h1>目錄</h1>\n${navBody}\n</nav>`),
  );
  manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');

  book.chapters.forEach((ref, i) => {
    const c = contents[i];
    const title = c?.title || ref.title;
    const paragraphs = c
      ? c.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n')
      : '<p class="plain">本章下載失敗，請稍後重新執行以補抓。</p>';
    o(
      chapterFile(ref.index),
      xhtml(title, `<h1 class="chapter-title">${esc(ref.title)}</h1>\n${paragraphs}`, 1),
    );
    addPage(`ch${ref.index}`, chapterFile(ref.index));
  });

  let n = 0;
  // playOrder 須依閱讀順序遞增，所以父節點先取號，再產生子節點
  const point = (title: string, src: string, children?: () => string) => {
    const order = ++n;
    const inner = children?.() ?? '';
    return `<navPoint id="np${order}" playOrder="${order}"><navLabel><text>${esc(title)}</text></navLabel><content src="${src}"/>${inner}</navPoint>`;
  };
  const chapterPoint = (c: { index: number; title: string }) => point(c.title, chapterFile(c.index));
  const ncxPoints = groups
    .map((g) =>
      g.title === null
        ? g.chapters.map(chapterPoint).join('')
        : point(g.title, chapterFile(g.chapters[0]!.index), () => g.chapters.map(chapterPoint).join('')),
    )
    .join('');
  o(
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="novel-bulk-${esc(book.id)}"/></head><docTitle><text>${esc(book.title)}</text></docTitle><navMap>${ncxPoints}</navMap></ncx>`,
  );
  manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');
  manifest.push('<item id="css" href="style.css" media-type="text/css"/>');

  o(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">novel-bulk-${esc(book.id)}</dc:identifier>
<dc:title>${esc(book.title)}</dc:title>
<dc:creator>${esc(book.author)}</dc:creator>
<dc:language>zh-TW</dc:language>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine toc="ncx">
${spine.join('\n')}
</spine>
</package>`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** gui 預覽用：單章獨立 HTML，樣式與 epub 共用同一份 CSS */
export function renderPreview(content: ChapterContent, layout: LayoutOptions): string {
  const paragraphs = content.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n');
  return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><style>${buildCss(layout)}body{margin:1.2em;font-size:18px}</style></head><body><h1 class="chapter-title">${esc(content.title)}</h1>\n${paragraphs}</body></html>`;
}
