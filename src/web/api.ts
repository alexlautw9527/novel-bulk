import type { LayoutOptions } from '../core/options';

export type { LayoutOptions };
export interface Chapter {
  index: number;
  title: string;
}
export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  summary: string[];
  chapters: Chapter[];
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}
