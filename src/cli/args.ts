import { parseArgs } from 'node:util';
import type { LayoutOptions } from '../core/options';
import type { BuildOptions } from '../core/pipeline';

export type Command =
  | { name: 'build' | 'retry'; url: string; options: BuildOptions }
  | { name: 'serve'; port: number };

export const USAGE = `用法：
  novel-bulk build <目錄頁網址> [選項]   抓取並輸出 epub
  novel-bulk retry <目錄頁網址> [選項]   補抓失敗章節並重新輸出（已快取的章節不會重抓）
  novel-bulk serve [--port 3000]         啟動 local web gui

選項：
  --from N --to M          只輸出第 N 至 M 章
  --out DIR                輸出資料夾（預設 output）
  --cache DIR              快取資料夾（預設 .cache）
  --refresh                忽略快取重新下載
  --indent N               首行縮排字元數（預設 2）
  --line-height X          行距倍數
  --paragraph-spacing none|half|full
  --title-align center|left
  --no-page-break          章節標題前不強制換頁
  --font NAME              font-family（不內嵌字型）
  --no-cover  --no-summary 不加封面 / 簡介頁
  --convert none|s2t|s2twp 簡繁處理（預設 s2t）
  --group-size N           目錄每組章數，0 不分組（預設 100）
  --config FILE            設定檔（預設讀取 ./novel-bulk.config.json）
`;

const oneOf = <const T extends string>(name: string, value: string, allowed: readonly T[]): T => {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`--${name} 只接受 ${allowed.join('、')}`);
  return value as T;
};

const num = (name: string, value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`--${name} 需要數字`);
  return n;
};

/** config 為設定檔內容（鍵名同 LayoutOptions，另有 out、from、to）；命令列優先 */
export function parseCli(argv: string[], config: Record<string, unknown>): Command {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      out: { type: 'string' },
      cache: { type: 'string' },
      refresh: { type: 'boolean' },
      indent: { type: 'string' },
      'line-height': { type: 'string' },
      'paragraph-spacing': { type: 'string' },
      'title-align': { type: 'string' },
      'no-page-break': { type: 'boolean' },
      font: { type: 'string' },
      'no-cover': { type: 'boolean' },
      'no-summary': { type: 'boolean' },
      convert: { type: 'string' },
      'group-size': { type: 'string' },
      port: { type: 'string' },
      config: { type: 'string' },
    },
  });
  const [name, url] = positionals;

  if (name === 'serve') return { name, port: values.port ? num('port', values.port) : 3000 };
  if (name !== 'build' && name !== 'retry') throw new Error(`未知指令：${name ?? '(空)'}`);
  if (!url) throw new Error('缺少目錄頁網址');

  const layout: Partial<LayoutOptions> = {};
  const set = <K extends keyof LayoutOptions>(key: K, cli: LayoutOptions[K] | undefined) => {
    const value = cli !== undefined ? cli : (config[key] as LayoutOptions[K] | undefined);
    if (value !== undefined) layout[key] = value;
  };
  set('indent', values.indent !== undefined ? num('indent', values.indent) : undefined);
  set('lineHeight', values['line-height'] !== undefined ? num('line-height', values['line-height']) : undefined);
  set(
    'paragraphSpacing',
    values['paragraph-spacing'] !== undefined
      ? oneOf('paragraph-spacing', values['paragraph-spacing'], ['none', 'half', 'full'])
      : undefined,
  );
  set(
    'titleAlign',
    values['title-align'] !== undefined ? oneOf('title-align', values['title-align'], ['center', 'left']) : undefined,
  );
  set('pageBreak', values['no-page-break'] ? false : undefined);
  set('fontFamily', values.font);
  set('cover', values['no-cover'] ? false : undefined);
  set('summaryPage', values['no-summary'] ? false : undefined);
  set('convert', values.convert !== undefined ? oneOf('convert', values.convert, ['none', 's2t', 's2twp']) : undefined);
  set('groupSize', values['group-size'] !== undefined ? num('group-size', values['group-size']) : undefined);

  return {
    name,
    url,
    options: {
      layout,
      outDir: values.out ?? (config.out as string | undefined) ?? 'output',
      cacheDir: values.cache ?? '.cache',
      refresh: values.refresh,
      from: values.from ? num('from', values.from) : (config.from as number | undefined),
      to: values.to ? num('to', values.to) : (config.to as number | undefined),
    },
  };
}
