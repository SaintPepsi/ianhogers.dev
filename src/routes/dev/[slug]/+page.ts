import { loadPosts, type PostModule } from '$lib/blog';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const modules = import.meta.glob('/src/content/dev/*.md', { eager: true }) as Record<string, PostModule>;
  const posts = loadPosts(modules);
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) throw error(404, 'Post not found');
  // Return only serializable data — component resolved in .svelte file
  return { metadata: post.metadata, slug: post.slug };
};
