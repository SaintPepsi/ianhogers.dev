# Astro → SvelteKit Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate ianhogers.dev from Astro 5 to SvelteKit so that layout components (nav, FallingLeaves, audio player) persist across navigations without ViewTransition hacks.

**Architecture:** SvelteKit with mdsvex for markdown content, Vercel adapter for deployment, Tailwind for styling. Persistent `+layout.svelte` replaces Astro's `Base.astro` + `transition:persist`. Blog content loaded via mdsvex preprocessor and `import.meta.glob` in `+page.ts` loaders.

**Tech Stack:** SvelteKit, Svelte 5, mdsvex, Tailwind CSS 3, @sveltejs/adapter-vercel, @neondatabase/serverless, @vercel/kv, Playwright

**Design doc:** `docs/plans/2026-03-14-sveltekit-migration-design.md`

---

### Task 1: Scaffold SvelteKit Project

**Files:**
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `src/app.html`
- Create: `src/app.css`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Rename: `public/` → `static/`

**Step 1: Create new branch**

```bash
git checkout -b feature/sveltekit-migration
```

**Step 2: Update package.json**

Remove all `@astrojs/*` and `astro` deps. Add SvelteKit deps:

```json
{
  "name": "ianhogers.com",
  "type": "module",
  "version": "2.0.0",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.0.2",
    "@sveltejs/adapter-vercel": "^5.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@vercel/kv": "^3.0.0",
    "bits-ui": "^2.16.3",
    "mdsvex": "^0.12.0",
    "mermaid": "^11.12.3",
    "obscenity": "^0.4.6",
    "rehype-external-links": "^3.0.0",
    "svelte": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "vite": "^6.0.0"
  }
}
```

**Step 3: Create svelte.config.js**

```js
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
      '@scripts': 'scripts',
      '$content': 'src/content',
    },
  },
};

export default config;
```

**Step 4: Create vite.config.ts**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
});
```

**Step 5: Create src/app.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    %sveltekit.body%
  </body>
</html>
```

**Step 6: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 7: Update tailwind.config.mjs content paths**

Change content array from:
```js
content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}']
```
To:
```js
content: ['./src/**/*.{html,js,md,mdx,svelte,ts,tsx}']
```

**Step 8: Move src/styles/global.css → src/app.css**

Merge the global CSS into `src/app.css` with Tailwind directives at top:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ... rest of global.css content ... */
```

**Step 9: Rename public/ → static/**

```bash
mv public static
```

**Step 10: Update tsconfig.json**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strictNullChecks": true,
    "baseUrl": ".",
    "paths": {
      "@scripts/*": ["scripts/*"],
      "$content/*": ["src/content/*"]
    }
  }
}
```

**Step 11: Remove Astro files**

```bash
rm astro.config.mjs
rm src/content.config.ts
rm -rf src/layouts/
rm -rf src/pages/
```

**Step 12: Install deps and verify**

```bash
bun install
bun run dev
```

Expected: SvelteKit dev server starts (no pages yet, 404 is fine).

**Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project, remove Astro"
```

---

### Task 2: Root Layout (Persistent Shell)

**Files:**
- Create: `src/routes/+layout.svelte`
- Modify: `src/components/FallingLeaves.svelte` (remove Astro-specific code)

**Step 1: Create src/routes/+layout.svelte**

Port `src/layouts/Base.astro` (152 lines) to SvelteKit. This is the persistent shell — nav, decorations, FallingLeaves, footer. The key difference: use `$page` store instead of `Astro.url.pathname`, and use `{@render children()}` for the slot.

Read the full `Base.astro` file and convert:
- Replace `Astro.props` with `$props()` rune
- Replace `Astro.url.pathname` with `$page.url.pathname`
- Replace `<slot />` with `{@render children()}`
- Replace `<ViewTransitions />` — not needed
- Replace `class:list={[...]}` with Svelte `class:` directives
- Import FallingLeaves directly (no `client:only`)
- Import MapleAudioPlayer directly (no `client:only`)
- Move `<style is:global>` to `app.css` or keep as `<style>` in layout
- Import `src/app.css`

**Step 2: Simplify FallingLeaves.svelte**

Remove all Astro ViewTransition workarounds:
- Remove `astro:page-load` event listener
- Remove `astro:before-swap` event listener
- Remove `astro:after-swap` event listener
- Remove Web Animations API elapsed time capture/restore
- Replace `window.location.pathname` with `$page.url.pathname` passed as prop or imported from `$app/stores`
- The component now lives in `+layout.svelte` and never unmounts

**Step 3: Verify dev server shows layout**

```bash
bun run dev
```

Navigate to localhost — should see the nav and shell (no page content yet).

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: root layout with persistent nav, FallingLeaves, audio player"
```

---

### Task 3: Static Pages (Home, About, Credits, Skills)

**Files:**
- Create: `src/routes/+page.svelte` (home)
- Create: `src/routes/about/+page.svelte`
- Create: `src/routes/credits/+page.svelte`
- Create: `src/routes/skills/+page.svelte`

**Step 1: Create home page**

Port `src/pages/index.astro` (167 lines). Key changes:
- Content collection queries (`getCollection('dev')`) move to `+page.ts` load function
- Create `src/routes/+page.ts` with load function that imports blog posts via `import.meta.glob`
- Replace Astro template syntax with Svelte

Create `src/routes/+page.ts`:
```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const devPosts = import.meta.glob('/src/content/dev/*.md', { eager: true });
  const personalPosts = import.meta.glob('/src/content/personal/*.{md,mdx}', { eager: true });
  const maplePosts = import.meta.glob('/src/content/maple/*.md', { eager: true });

  const processPosts = (modules: Record<string, any>) =>
    Object.entries(modules)
      .map(([path, mod]) => ({
        slug: path.split('/').pop()?.replace(/\.mdx?$/, '') ?? '',
        ...mod.metadata,
      }))
      .filter((p) => !p.draft)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

  return {
    devPosts: processPosts(devPosts),
    personalPosts: processPosts(personalPosts),
    maplePosts: processPosts(maplePosts),
  };
};
```

Then create `+page.svelte` with the home page template using `let { data } = $props()`.

**Step 2: Create about page**

Port `src/pages/about.astro` (62 lines) — simple static page, no data loading needed.

**Step 3: Create credits page**

Port `src/pages/credits.astro` — similar static page.

**Step 4: Create skills page**

Port `src/pages/skills.astro` — similar static page.

**Step 5: Verify all pages render**

```bash
bun run dev
```

Navigate: /, /about, /credits, /skills. All should render.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: static pages — home, about, credits, skills"
```

---

### Task 4: Blog Content System (mdsvex)

**Files:**
- Create: `src/routes/dev/+page.svelte` (blog index)
- Create: `src/routes/dev/+page.ts` (load posts)
- Create: `src/routes/dev/[slug]/+page.svelte` (post renderer)
- Create: `src/routes/dev/[slug]/+page.ts` (load single post)
- Create: `src/routes/maple/` (same pattern)
- Create: `src/routes/personal/` (same pattern)
- Create: `src/lib/blog.ts` (shared post loading utilities)

**Step 1: Create shared blog utilities**

`src/lib/blog.ts`:
```ts
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
  default: any; // Svelte component from mdsvex
}

export function loadPosts(modules: Record<string, any>): Post[] {
  return Object.entries(modules)
    .map(([path, mod]) => ({
      slug: path.split('/').pop()?.replace(/\.mdx?$/, '') ?? '',
      metadata: mod.metadata,
      default: mod.default,
    }))
    .filter((p) => !p.metadata.draft)
    .sort((a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime());
}
```

**Step 2: Create dev blog index**

`src/routes/dev/+page.ts`:
```ts
import { loadPosts } from '$lib/blog';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const modules = import.meta.glob('/src/content/dev/*.md', { eager: true });
  return { posts: loadPosts(modules) };
};
```

`src/routes/dev/+page.svelte`: Port `src/pages/dev/index.astro` template.

**Step 3: Create dev blog post page**

`src/routes/dev/[slug]/+page.ts`:
```ts
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
  const modules = import.meta.glob('/src/content/dev/*.md', { eager: true });
  const path = Object.keys(modules).find((p) => p.includes(params.slug));
  if (!path) throw error(404, 'Post not found');
  const post = modules[path] as any;
  return { content: post.default, metadata: post.metadata };
};
```

`src/routes/dev/[slug]/+page.svelte`: Port `BlogPost.astro` template with `<svelte:component this={data.content} />`.

**Step 4: Create maple blog (same pattern)**

Copy dev structure to `src/routes/maple/`. Change glob path to `/src/content/maple/*.md`.

**Step 5: Create personal blog (same pattern)**

Copy dev structure to `src/routes/personal/`. Change glob path to `/src/content/personal/*.{md,mdx}`.

**Step 6: Verify one blog post renders with frontmatter**

```bash
bun run dev
```

Navigate to /dev, click a post. Verify title, date, tags, and markdown content render.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: blog content system with mdsvex — dev, maple, personal"
```

---

### Task 5: Shoutout Pages

**Files:**
- Create: `src/routes/shoutouts/+page.svelte`
- Create: `src/routes/shoutouts/bambooboys/+page.svelte`
- Create: `src/routes/shoutouts/asianfox/+page.svelte`
- Create: `src/routes/shoutouts/rmocci/+page.svelte`

**Step 1: Port all shoutout pages**

These are static pages — straight Astro → Svelte template conversion. No data loading.

Read each `.astro` file, convert to `.svelte`:
- `src/pages/shoutouts/index.astro` → `src/routes/shoutouts/+page.svelte`
- `src/pages/shoutouts/bambooboys.astro` → `src/routes/shoutouts/bambooboys/+page.svelte`
- `src/pages/shoutouts/asianfox.astro` → `src/routes/shoutouts/asianfox/+page.svelte`
- `src/pages/shoutouts/rmocci.astro` → `src/routes/shoutouts/rmocci/+page.svelte`

**Step 2: Verify bambooboys page triggers FallingLeaves**

FallingLeaves checks `$page.url.pathname === '/shoutouts/bambooboys'`. Navigate there, verify leaves spawn.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: shoutout pages — bambooboys, asianfox, rmocci"
```

---

### Task 6: Guestbook (API + Page)

**Files:**
- Create: `src/routes/guestbook/+page.svelte`
- Create: `src/routes/api/guestbook/notes/+server.ts`
- Move: `src/components/guestbook/lib/` stays as-is
- Modify: `src/styles/guestbook.css` (import in page)

**Step 1: Port API endpoint**

`src/routes/api/guestbook/notes/+server.ts`:

Port `src/pages/api/guestbook/notes.ts` (212 lines):
- Replace `APIRoute` with SvelteKit's `RequestHandler`
- Replace `export const GET: APIRoute` with `export const GET: RequestHandler`
- Replace `context.request` with direct `request` parameter
- Replace `new Response(JSON.stringify(...))` with SvelteKit's `json()` helper
- Keep all DB logic, profanity checking, rate limiting unchanged
- `public/assets/stickers/manifest.json` becomes `static/assets/stickers/manifest.json` — load via `fs` or fetch

**Step 2: Port guestbook page**

`src/routes/guestbook/+page.svelte`:
```svelte
<script>
  import GuestBook from '$lib/components/guestbook/GuestBook.svelte';
  import '../styles/guestbook.css';
</script>

<svelte:head>
  <title>guestbook | Ian Hogers</title>
</svelte:head>

<GuestBook />
```

Note: Move guestbook components from `src/components/guestbook/` to `src/lib/components/guestbook/` (SvelteKit convention — `$lib` alias).

**Step 3: Add prerender = false**

Guestbook page and API need server-side rendering:
```ts
// In +page.ts or +page.svelte
export const prerender = false;
```

**Step 4: Verify guestbook loads and can post**

```bash
bun run dev
```

Navigate to /guestbook. Verify book renders, notes load, posting works.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: guestbook page and API endpoint"
```

---

### Task 7: RSS Feeds and Sitemap

**Files:**
- Create: `src/routes/dev/rss.xml/+server.ts`
- Create: `src/routes/personal/rss.xml/+server.ts`
- Create: `src/routes/sitemap.xml/+server.ts`

**Step 1: Create RSS feed endpoint**

`src/routes/dev/rss.xml/+server.ts`:
```ts
import { loadPosts } from '$lib/blog';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = async () => {
  const modules = import.meta.glob('/src/content/dev/*.md', { eager: true });
  const posts = loadPosts(modules);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Ian Hogers — Dev</title>
    <description>Software engineering, game dev, and technical writing.</description>
    <link>https://ianhogers.com/dev</link>
    <atom:link href="https://ianhogers.com/dev/rss.xml" rel="self" type="application/rss+xml"/>
    ${posts.map(p => `<item>
      <title>${escapeXml(p.metadata.title)}</title>
      <description>${escapeXml(p.metadata.description)}</description>
      <pubDate>${new Date(p.metadata.date).toUTCString()}</pubDate>
      <link>https://ianhogers.com/dev/${p.slug}</link>
      <guid>https://ianhogers.com/dev/${p.slug}</guid>
    </item>`).join('\n')}
  </channel>
</rss>`;

  return new Response(xml.trim(), {
    headers: { 'Content-Type': 'application/xml' },
  });
};

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

**Step 2: Create personal RSS feed (same pattern)**

**Step 3: Create sitemap endpoint**

`src/routes/sitemap.xml/+server.ts` — generate sitemap from known routes + blog posts.

**Step 4: Verify feeds**

```bash
curl http://localhost:5173/dev/rss.xml
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: RSS feeds and sitemap"
```

---

### Task 8: Astro Component Conversions

**Files:**
- Create: `src/lib/components/Gallery.svelte` (from Gallery.astro)
- Create: `src/lib/components/GalleryGroup.svelte` (from GalleryGroup.astro)
- Create: `src/lib/components/CollageItem.svelte` (from CollageItem.astro)

**Step 1: Convert Astro components to Svelte**

Read each `.astro` component and convert:
- `Astro.props` → `$props()` rune
- `class:list` → Svelte `class:` directives
- `<slot />` → `{@render children()}`
- `<style>` scoped by default in Svelte (same as Astro)

**Step 2: Move all components to $lib**

SvelteKit convention: shared components live in `src/lib/components/`.

```bash
mv src/components/* src/lib/components/
rmdir src/components
```

Update all imports across routes to use `$lib/components/...`.

**Step 3: Verify gallery renders on pages that use it**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: convert Astro components to Svelte, move to $lib"
```

---

### Task 9: Cleanup and E2E Tests

**Files:**
- Modify: `tests/e2e/falling-leaves.spec.ts` (update if URLs/selectors changed)
- Modify: `playwright.config.ts` (update dev server command)
- Delete: leftover Astro files if any

**Step 1: Update playwright.config.ts**

Change webServer command from `astro dev` to `vite dev`, update port from 4321 to 5173 (SvelteKit default).

**Step 2: Update E2E test URLs if needed**

Most tests use relative paths which should work. Check baseURL in playwright config.

**Step 3: Run all E2E tests**

```bash
npx playwright test
```

Fix any failures.

**Step 4: Run production build**

```bash
bun run build
bun run preview
```

Verify production build works and all pages load.

**Step 5: Clean up any remaining Astro references**

Search codebase for remaining Astro imports or references:
```bash
grep -r "astro" src/ --include="*.ts" --include="*.svelte" --include="*.js"
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: update tests, cleanup Astro remnants"
```

---

### Task 10: Final Verification and PR

**Step 1: Full test suite**

```bash
bun run build && npx playwright test
```

**Step 2: Manual verification checklist**

- [ ] Home page renders with recent posts
- [ ] Navigation works between all pages
- [ ] FallingLeaves persists across navigation (no restart!)
- [ ] MapleAudioPlayer persists across navigation
- [ ] Blog post renders with markdown content
- [ ] Guestbook loads and accepts new notes
- [ ] RSS feeds return valid XML
- [ ] Sitemap returns valid XML
- [ ] Mobile responsive on all pages
- [ ] Pixel-art assets render with image-rendering: pixelated

**Step 3: Create PR**

```bash
git push -u origin feature/sveltekit-migration
gh pr create --title "feat: migrate from Astro to SvelteKit" --body "..."
```
