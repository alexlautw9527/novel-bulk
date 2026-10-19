import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createApp } from './app';

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../dist/web');
const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript',
  css: 'text/css',
  svg: 'image/svg+xml',
};

export async function startServer(port: number) {
  const app = new Hono();
  app.route('/', createApp({ outDir: 'output', cacheDir: '.cache' }));
  app.get('*', async (c) => {
    const rel = c.req.path === '/' ? 'index.html' : c.req.path.replace(/^\/+/, '');
    if (rel.includes('..')) return c.notFound();
    try {
      const data = await readFile(join(WEB_DIR, rel));
      return new Response(data, { headers: { 'content-type': TYPES[rel.split('.').pop() ?? ''] ?? 'application/octet-stream' } });
    } catch {
      return c.text('前端尚未建置，請先執行 npm run build:web', 404);
    }
  });
  // 只綁定本機，不對區域網路開放
  serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
}
