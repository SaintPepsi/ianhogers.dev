import adapter from '@sveltejs/adapter-vercel';
import { mdsvex } from 'mdsvex';
import rehypeExternalLinks from 'rehype-external-links';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md', '.mdx'],
	preprocess: [
		mdsvex({
			extensions: ['.md', '.mdx'],
			rehypePlugins: [
				[rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
			],
		}),
	],
	kit: {
		adapter: adapter(),
		alias: {
			$static: 'static'
		},
		prerender: {
			handleHttpError: ({ path, message }) => {
				// Guestbook and API routes are deferred — suppress prerender errors for them
				if (path.startsWith('/guestbook') || path.startsWith('/api/')) return;
				throw new Error(message);
			},
		},
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
