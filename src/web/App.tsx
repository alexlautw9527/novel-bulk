import { useEffect, useRef, useState } from 'react';
import { DEFAULT_LAYOUT } from '../core/options';
import { post, type Book, type LayoutOptions } from './api';

interface Progress {
  stage: string;
  done?: number;
  total?: number;
  failed?: number;
  message?: string;
}
interface Result {
  files: string[];
  failed: number[];
  warnings: string[];
  error?: string;
}

export function App() {
  const [url, setUrl] = useState('');
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [layout, setLayout] = useState<LayoutOptions>(DEFAULT_LAYOUT);
  const [range, setRange] = useState({ from: 1, to: 1 });
  const [previewIndex, setPreviewIndex] = useState(1);
  const [previewHtml, setPreviewHtml] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [building, setBuilding] = useState(false);

  const patch = (p: Partial<LayoutOptions>) => setLayout((l) => ({ ...l, ...p }));

  async function parseToc() {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const b = await post<Book>('/api/toc', { url });
      setBook(b);
      setRange({ from: 1, to: b.chapters.length });
      setPreviewIndex(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // 排版選項或預覽章節改變後延遲重新取得預覽，避免輸入時每個按鍵都送請求
  useEffect(() => {
    if (!book) return;
    const t = setTimeout(async () => {
      try {
        const r = await post<{ html: string }>('/api/preview', { url, index: previewIndex, layout });
        setPreviewHtml(r.html);
      } catch (e) {
        setPreviewHtml(`<p style="padding:1em">${(e as Error).message}</p>`);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [book, url, previewIndex, layout]);

  async function build(refresh = false) {
    setError('');
    setResult(null);
    setProgress({ stage: 'toc', message: '開始' });
    setBuilding(true);
    try {
      const { jobId } = await post<{ jobId: string }>('/api/build', {
        url,
        from: range.from,
        to: range.to,
        refresh,
        layout,
      });
      const es = new EventSource(`/api/jobs/${jobId}/events`);
      es.addEventListener('progress', (ev) => setProgress(JSON.parse((ev as MessageEvent).data)));
      const finish = (ev: Event) => {
        es.close();
        setResult(JSON.parse((ev as MessageEvent).data));
        setBuilding(false);
      };
      es.addEventListener('done', finish);
      es.addEventListener('error', (ev) => {
        if ((ev as MessageEvent).data) finish(ev);
      });
    } catch (e) {
      setError((e as Error).message);
      setBuilding(false);
    }
  }

  const exportConfig = () => {
    const config = { ...layout };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'novel-bulk.config.json';
    a.click();
  };

  const pct = progress?.total ? Math.round(((progress.done ?? 0) / progress.total) * 100) : 0;

  return (
    <main>
      <h1>Novel Bulk</h1>
      <section>
        <h2>1. 目錄頁網址</h2>
        <div className="row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.xbanxia.cc/books/249675.html"
            onKeyDown={(e) => e.key === 'Enter' && url && parseToc()}
          />
          <button onClick={parseToc} disabled={!url || loading}>
            {loading ? '解析中' : '解析'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {book && (
        <>
          <section className="book">
            {book.coverUrl && <img src={book.coverUrl} alt={book.title} referrerPolicy="no-referrer" />}
            <div>
              <h2>{book.title}</h2>
              <p className="muted">{book.author}，共 {book.chapters.length} 章</p>
              {book.summary.map((s, i) => (
                <p key={i} className="summary">{s}</p>
              ))}
            </div>
          </section>

          <section>
            <h2>2. 章節範圍</h2>
            <div className="row">
              <label>從第 <input type="number" min={1} max={book.chapters.length} value={range.from} onChange={(e) => setRange({ ...range, from: Number(e.target.value) })} /> 章</label>
              <label>到第 <input type="number" min={1} max={book.chapters.length} value={range.to} onChange={(e) => setRange({ ...range, to: Number(e.target.value) })} /> 章</label>
            </div>
            <details>
              <summary>查看章節清單</summary>
              <ol className="chapters">
                {book.chapters.map((c) => (
                  <li key={c.index} className={c.index >= range.from && c.index <= range.to ? '' : 'off'}>
                    {c.index}. {c.title}
                  </li>
                ))}
              </ol>
            </details>
          </section>

          <section>
            <h2>3. 排版</h2>
            <div className="split">
              <div className="form">
                <label>首行縮排（字元）<input type="number" min={0} max={3} value={layout.indent} onChange={(e) => patch({ indent: Number(e.target.value) })} /></label>
                <label>行距（倍數，空白為閱讀器預設）<input type="number" step={0.1} min={1} max={3} value={layout.lineHeight ?? ''} onChange={(e) => patch({ lineHeight: e.target.value ? Number(e.target.value) : null })} /></label>
                <label>段落間距
                  <select value={layout.paragraphSpacing} onChange={(e) => patch({ paragraphSpacing: e.target.value as LayoutOptions['paragraphSpacing'] })}>
                    <option value="none">無</option><option value="half">半行</option><option value="full">一行</option>
                  </select>
                </label>
                <label>章節標題對齊
                  <select value={layout.titleAlign} onChange={(e) => patch({ titleAlign: e.target.value as LayoutOptions['titleAlign'] })}>
                    <option value="center">置中</option><option value="left">靠左</option>
                  </select>
                </label>
                <label>字型（font-family，空白為閱讀器字型）<input value={layout.fontFamily ?? ''} onChange={(e) => patch({ fontFamily: e.target.value || null })} /></label>
                <label>簡繁處理
                  <select value={layout.convert} onChange={(e) => patch({ convert: e.target.value as LayoutOptions['convert'] })}>
                    <option value="s2t">只轉字形（建議）</option><option value="s2twp">字形加台灣詞彙</option><option value="none">不處理</option>
                  </select>
                </label>
                <label>目錄每組章數（0 不分組）<input type="number" min={0} value={layout.groupSize} onChange={(e) => patch({ groupSize: Number(e.target.value) })} /></label>
                <label className="check"><input type="checkbox" checked={layout.pageBreak} onChange={(e) => patch({ pageBreak: e.target.checked })} />章節標題前換頁</label>
                <label className="check"><input type="checkbox" checked={layout.cover} onChange={(e) => patch({ cover: e.target.checked })} />加入封面</label>
                <label className="check"><input type="checkbox" checked={layout.summaryPage} onChange={(e) => patch({ summaryPage: e.target.checked })} />加入簡介頁</label>
                <button className="ghost" onClick={exportConfig}>匯出設定檔</button>
              </div>
              <div className="preview">
                <label>預覽第 <input type="number" min={1} max={book.chapters.length} value={previewIndex} onChange={(e) => setPreviewIndex(Number(e.target.value))} /> 章</label>
                <iframe title="預覽" srcDoc={previewHtml} sandbox="" />
              </div>
            </div>
          </section>

          <section>
            <h2>4. 輸出</h2>
            <div className="row">
              <button onClick={() => build(false)} disabled={building}>開始</button>
              <button className="ghost" onClick={() => build(true)} disabled={building}>忽略快取重新下載</button>
            </div>
            {progress && (
              <div className="progress">
                <div className="bar"><div style={{ width: `${progress.stage === 'fetch' ? pct : 100}%` }} /></div>
                <p className="muted">
                  {progress.stage === 'fetch'
                    ? `抓取 ${pct}%（${progress.done}/${progress.total}，失敗 ${progress.failed}）`
                    : progress.message}
                </p>
              </div>
            )}
            {result && (
              <div className="result">
                {result.error && <p className="error">{result.error}</p>}
                {result.files.map((f) => (
                  <p key={f}><a href={`/api/files/${encodeURIComponent(f)}`}>下載 {f}</a></p>
                ))}
                {result.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
                {result.failed.length > 0 && (
                  <p className="warn">失敗章節：{result.failed.join(', ')}。再按一次「開始」只會補抓這些章節。</p>
                )}
                <p className="muted">檔案也存放在執行 serve 的資料夾下的 output/。</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
