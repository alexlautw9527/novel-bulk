export interface ChapterRef {
  /** 1-based 順序，依目錄頁出現順序而非章節標題上的數字 */
  index: number;
  title: string;
  url: string;
}

export interface BookInfo {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  summary: string[];
  tocUrl: string;
  chapters: ChapterRef[];
}

export interface ChapterContent {
  title: string;
  paragraphs: string[];
}

/** 站點解析規則：核心流程只依賴此介面，不知道任何網站的 HTML 結構 */
export interface SiteAdapter {
  name: string;
  matches(url: string): boolean;
  /** 抓取此站時要額外帶的 HTTP 標頭，例如通過驗證後的 cookie */
  headers?(): Record<string, string>;
  parseToc(html: string, tocUrl: string): BookInfo;
  parseChapter(html: string): ChapterContent;
}
