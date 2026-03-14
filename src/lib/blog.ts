import type { Component } from 'svelte';

export interface PostMetadata {
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft?: boolean;
}

export interface PostSummary {
  slug: string;
  metadata: PostMetadata;
}

export type PostModule = { metadata: PostMetadata; default: Component };

/**
 * Load posts from an import.meta.glob result. Returns only serializable data
 * (no component references) — safe to return from SvelteKit load functions.
 */
export function loadPosts(modules: Record<string, PostModule>): PostSummary[] {
  return Object.entries(modules)
    .map(([path, mod]) => ({
      slug: path.split('/').pop()?.replace(/\.mdx?$/, '') ?? '',
      metadata: mod.metadata,
    }))
    .filter((p) => !p.metadata.draft)
    .sort((a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime());
}
