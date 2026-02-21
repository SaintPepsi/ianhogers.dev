import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';
import rehypeExternalLinks from 'rehype-external-links';

export default defineConfig({
  site: 'https://ianhogers.com',
  adapter: vercel(),
  integrations: [mdx(), sitemap(), tailwind(), svelte()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  markdown: {
    rehypePlugins: [
      [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
    ],
  },
});
