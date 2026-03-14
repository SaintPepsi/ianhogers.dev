import { loadPosts, type PostModule } from '$lib/blog';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const modules = import.meta.glob('/src/content/personal/*.{md,mdx}', { eager: true }) as Record<string, PostModule>;
  const posts = loadPosts(modules);
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) throw error(404, 'Post not found');
  return { metadata: post.metadata, slug: post.slug };
};
