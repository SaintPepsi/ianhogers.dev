import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import rehypeExternalLinks from 'rehype-external-links';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md', '.mdx'],
	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: ['.md', '.mdx'],
			rehypePlugins: [
				[rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
			],
		}),
	],
	kit: {
		adapter: adapter(),
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
