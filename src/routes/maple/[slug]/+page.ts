import { loadPosts, type PostModule } from '$lib/blog';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const modules = import.meta.glob('/src/content/maple/*.md', { eager: true }) as Record<string, PostModule>;
  const posts = loadPosts(modules);
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) throw error(404, 'Post not found');

  // Discover available audio files at build time via import.meta.glob
  const audioFiles = import.meta.glob('/static/audio/maple/*.m4a');
  const hasAudio = Object.keys(audioFiles).some((p) => p.includes(params.slug));

  return { metadata: post.metadata, slug: post.slug, hasAudio };
};
