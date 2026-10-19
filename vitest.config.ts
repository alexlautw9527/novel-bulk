import { defineConfig } from 'vitest/config';

// 獨立於 vite.config.ts：後者的 root 指向前端目錄，會讓測試找不到檔案
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
