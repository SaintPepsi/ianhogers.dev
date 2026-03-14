import type { Component } from 'svelte';

export interface PostMetadata {
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft?: boolean;
}

export interface Post {
  slug: string;
  metadata: PostMetadata;
  component: Component;
}

export type PostModule = { metadata: PostMetadata; default: Component };

export function loadPosts(modules: Record<string, PostModule>): Post[] {
  return Object.entries(modules)
    .map(([path, mod]) => ({
      slug: path.split('/').pop()?.replace(/\.mdx?$/, '') ?? '',
      metadata: mod.metadata,
      component: mod.default,
    }))
    .filter((p) => !p.metadata.draft)
    .sort((a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime());
}
