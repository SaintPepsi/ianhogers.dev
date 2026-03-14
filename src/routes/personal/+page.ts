import { loadPosts, type PostModule } from '$lib/blog';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const modules = import.meta.glob('/src/content/personal/*.{md,mdx}', { eager: true }) as Record<string, PostModule>;
  return { posts: loadPosts(modules) };
};
