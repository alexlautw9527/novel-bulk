import { readFile } from 'node:fs/promises';
import { startServer } from '../server/index';
import { buildBook } from '../core/pipeline';
import { parseCli, USAGE } from './args';
import { formatProgress } from './progress';

async function loadConfig(argv: string[]): Promise<Record<string, unknown>> {
  const i = argv.indexOf('--config');
  const explicit = i >= 0 ? argv[i + 1] : undefined;
  try {
    return JSON.parse(await readFile(explicit ?? 'novel-bulk.config.json', 'utf8'));
  } catch (err) {
    // 預設路徑不存在是正常情況；使用者指定的檔案讀不到才報錯
    if (explicit) throw new Error(`讀不到設定檔 ${explicit}`);
    return {};
  }
}

async function main() {
  // .env 放各站需要的 cookie 等私密設定；不存在時略過
  try {
    process.loadEnvFile('.env');
  } catch {}
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return;
  }
  const cmd = parseCli(argv, await loadConfig(argv));

  if (cmd.name === 'serve') {
    await startServer(cmd.port);
    console.log(`gui 已啟動：http://127.0.0.1:${cmd.port}`);
    return;
  }

  const report = await buildBook(cmd.url, {
    ...cmd.options,
    onProgress: (e) => {
      if (e.stage === 'fetch') {
        // 非終端機（導向檔案）時 \r 會產生大量殘行，改為每 50 章印一行
        if (process.stdout.isTTY) process.stdout.write(`\r抓取 ${formatProgress(e)}`);
        else if (e.done % 50 === 0 || e.done === e.total) console.log(`抓取 ${formatProgress(e)}`);
        if (e.done === e.total && process.stdout.isTTY) process.stdout.write('\n');
      } else console.log(e.message);
    },
  });
  console.log(`\n完成：${report.book.title}`);
  report.files.forEach((f) => console.log(`  ${f}`));
  report.warnings.forEach((w) => console.warn(`警告：${w}`));
  if (report.failed.length > 0) {
    console.warn(`失敗章節（目錄順序）：${report.failed.join(', ')}`);
    console.warn(`重新執行 retry 指令即可只補抓這些章節。`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`錯誤：${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
