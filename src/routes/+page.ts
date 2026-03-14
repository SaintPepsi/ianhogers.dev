import { loadPosts } from '$lib/blog';
import type { PostModule } from '$lib/blog';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const devPosts = import.meta.glob('/src/content/dev/*.md', { eager: true }) as Record<string, PostModule>;
  const personalPosts = import.meta.glob('/src/content/personal/*.{md,mdx}', { eager: true }) as Record<string, PostModule>;
  const maplePosts = import.meta.glob('/src/content/maple/*.md', { eager: true }) as Record<string, PostModule>;

  return {
    devPosts: loadPosts(devPosts).slice(0, 3),
    personalPosts: loadPosts(personalPosts).slice(0, 3),
    maplePosts: loadPosts(maplePosts).slice(0, 3),
  };
};
