# Astro → SvelteKit Migration Plan (v2 — reviewed)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate ianhogers.dev from Astro 5 to SvelteKit so that layout components (nav, FallingLeaves, audio player) persist across navigations without ViewTransition hacks.

**Architecture:** SvelteKit with mdsvex for markdown content, Vercel adapter for deployment, Tailwind for styling. Persistent `+layout.svelte` replaces Astro's `Base.astro` + `transition:persist`. Blog content loaded via mdsvex preprocessor and `import.meta.glob` in `+page.ts` loaders.

**Tech Stack:** SvelteKit, Svelte 5, mdsvex, Tailwind CSS 3, @sveltejs/adapter-vercel, @neondatabase/serverless, @vercel/kv, Playwright

**Design doc:** `docs/plans/2026-03-14-sveltekit-migration-design.md`

## Review Fixes Applied

Issues found in plan review and incorporated:
- **Task ordering**: Component conversions (Gallery, CollageItem) moved before blog content, since `baking.mdx` imports them
- **BlogPost layout**: Explicit task to create `BlogPostLayout.svelte` component
- **Environment variables**: `import.meta.env.DATABASE_URL` → `$env/dynamic/private`
- **clientAddress**: Astro destructure → `event.getClientAddress()`
- **cursor.js**: Loading strategy for SvelteKit layout
- **Side derivation**: Compute from `$page.url.pathname` in layout
- **Svelte 5**: Use `<data.content />` not `<svelte:component>`
- **favicon.svg**: Correct reference in app.html
- **Consistent post data shape**: Single `Post` type used everywhere
- **Sticker manifest path**: `"public"` → `"static"` (or use import)
- **DELETE handler**: Included in guestbook API port
- **Prerender default**: `true` at root layout, override to `false` for guestbook
- **Scaffold from `bunx sv create`**: Use official CLI to generate baseline config

---

### Task 1: Scaffold SvelteKit Project

**Step 1: Create new branch**

```bash
git checkout -b feature/sveltekit-migration
```

**Step 2: Scaffold a reference SvelteKit project in /tmp**

```bash
cd /tmp
bunx sv create sveltekit-reference --template minimal --types ts --no-add-ons --install bun
```

This creates a clean SvelteKit baseline. Use it as the reference for config files (svelte.config.js, vite.config.ts, tsconfig.json, app.html, package.json structure). Do NOT copy it wholesale — just reference the correct config patterns.

**Step 3: Update package.json**

Remove all `@astrojs/*` and `astro` deps. Add SvelteKit deps. Match the structure from the reference project:

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
    "@vercel/kv": "^3.0.0",
    "bits-ui": "^2.16.3",
    "mermaid": "^11.12.3",
    "obscenity": "^0.4.6",
    "rehype-external-links": "^3.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "mdsvex": "^0.12.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "svelte": "^5.0.0",
    "vite": "^6.0.0"
  }
}
```

Note: `svelte`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, and `vite` go in devDependencies per SvelteKit convention.

**Step 4: Create svelte.config.js**

Reference the scaffolded project, then add mdsvex and adapter-vercel:

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
      '$content': 'src/content',
    },
  },
};

export default config;
```

**Step 5: Create vite.config.ts**

Match reference project:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
});
```

**Step 6: Create src/app.html**

Match reference project, with our favicon:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    %sveltekit.body%
  </body>
</html>
```

**Step 7: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 8: Create src/app.css**

Move `src/styles/global.css` content into `src/app.css` with Tailwind directives at top:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ... rest of global.css content ... */
```

**Step 9: Update tailwind.config.mjs**

Change content array to remove `.astro`:
```js
content: ['./src/**/*.{html,js,md,mdx,svelte,ts,tsx}']
```

**Step 10: Update tsconfig.json**

Match reference project structure:
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

**Step 11: Rename public/ → static/**

```bash
mv public static
```

**Step 12: Remove Astro-specific files**

```bash
rm astro.config.mjs
rm src/content.config.ts
```

Keep `src/layouts/` and `src/pages/` for now as reference during porting. Delete them after all tasks complete.

**Step 13: Move components to $lib**

SvelteKit convention: shared code lives in `src/lib/`.

```bash
mkdir -p src/lib/components
mv src/components/* src/lib/components/
```

**Step 14: Install deps and verify dev server starts**

```bash
bun install
bun run dev
```

Expected: SvelteKit dev server starts on port 5173 (no pages yet, 404 is fine).

**Step 15: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project, remove Astro config"
```

---

### Task 2: Convert Astro Components to Svelte

**Why first:** `baking.mdx` imports Gallery.astro, CollageItem.astro, GalleryGroup.astro. These must be Svelte before blog content can render.

**Files:**
- Convert: `src/lib/components/Gallery.astro` → `Gallery.svelte`
- Convert: `src/lib/components/GalleryGroup.astro` → `GalleryGroup.svelte`
- Convert: `src/lib/components/CollageItem.astro` → `CollageItem.svelte`

**Step 1: Convert each Astro component to Svelte**

For each file:
- Replace `Astro.props` with `let { propName } = $props()`
- Replace `class:list={[...]}` with Svelte `class:` directives or template literals
- Replace `<slot />` with `{@render children()}` (Svelte 5 snippet syntax)
- Replace `<style>` — scoped by default in both, minimal changes
- **Gallery.astro**: Remove `document.addEventListener('astro:page-load', initGalleryLightbox)` — replace with `onMount` lifecycle

**Step 2: Update baking.mdx imports**

Change:
```
import Gallery from '../../components/Gallery.astro';
```
To:
```
import Gallery from '$lib/components/Gallery.svelte';
```

Same for GalleryGroup and CollageItem.

**Step 3: Delete the old .astro files**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: convert Astro components to Svelte"
```

---

### Task 3: Root Layout (Persistent Shell)

**Files:**
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+layout.ts`
- Modify: `src/lib/components/FallingLeaves.svelte` (remove Astro hacks)

**Step 1: Create src/routes/+layout.ts**

Set default prerender and derive `side` from URL:

```ts
import type { LayoutLoad } from './$types';

export const prerender = true;

export const load: LayoutLoad = async ({ url }) => {
  const path = url.pathname;
  let side: 'dev' | 'personal' | 'maple' | 'neutral' = 'neutral';
  if (path.startsWith('/dev') || path.startsWith('/skills')) side = 'dev';
  else if (path.startsWith('/personal')) side = 'personal';
  else if (path.startsWith('/maple')) side = 'maple';
  return { side };
};
```

**Step 2: Create src/routes/+layout.svelte**

Port `src/layouts/Base.astro` (152 lines):
- Import `src/app.css`
- Use `let { data, children } = $props()` for layout data and page slot
- Use `$page.url.pathname` from `$app/stores` for active nav state
- Use `data.side` for conditional decorations and nav styling
- Import FallingLeaves directly (no `client:only`)
- Import MapleAudioPlayer directly (no `client:only`)
- Replace `<slot />` with `{@render children()}`
- Remove `<ViewTransitions />`
- For cursor.js: load via `onMount` with dynamic script injection, remove the `window.__pixelCursorInit` guard (layout never re-mounts)
- For `<html>` class: use `document.documentElement.className = sideClass` in a reactive `$effect`

**Step 3: Simplify FallingLeaves.svelte**

Remove all Astro ViewTransition workarounds:
- Remove `document.addEventListener('astro:page-load', ...)` listener
- Remove `document.addEventListener('astro:before-swap', ...)` listener
- Remove `document.addEventListener('astro:after-swap', ...)` listener
- Remove Web Animations API elapsed time capture/restore code
- Replace `window.location.pathname` checks with `$page.url.pathname` from `$app/stores`
- The component now lives in `+layout.svelte` and never unmounts — no persistence hacks needed

**Step 4: Verify dev server shows layout shell**

```bash
bun run dev
```

Navigate to localhost — should see nav and shell (no page content yet).

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: persistent root layout with nav, FallingLeaves, audio player"
```

---

### Task 4: BlogPost Layout Component

**Files:**
- Create: `src/lib/components/BlogPostLayout.svelte`

**Step 1: Port BlogPost.astro (96 lines) to Svelte**

Key conversions:
- Props: `title`, `description`, `date`, `tags`, `side`, `slug`, `hasAudio` (boolean)
- Date formatting: `new Date(date).toLocaleDateString('en-AU', {...})`
- Side icon mapping object (same logic)
- Conditional MapleAudioPlayer: use `hasAudio` prop (boolean passed from load function) instead of `fs.existsSync` at build time
- MermaidDiagram: import and render conditionally
- Back link: use side-specific URL (`/dev`, `/personal`, `/maple`)
- Prose styling for markdown content
- Use `{@render children()}` for the rendered markdown slot

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: BlogPostLayout component with audio, mermaid, date formatting"
```

---

### Task 5: Shared Blog Utilities and Content System

**Files:**
- Create: `src/lib/blog.ts`

**Step 1: Create shared blog utilities**

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
  component: any; // Svelte component from mdsvex
}

export function loadPosts(modules: Record<string, any>): Post[] {
  return Object.entries(modules)
    .map(([path, mod]) => ({
      slug: path.split('/').pop()?.replace(/\.mdx?$/, '') ?? '',
      metadata: mod.metadata as PostMetadata,
      component: mod.default,
    }))
    .filter((p) => !p.metadata.draft)
    .sort((a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime());
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: shared blog post loading utilities"
```

---

### Task 6: Static Pages (Home, About, Credits, Skills)

**Files:**
- Create: `src/routes/+page.svelte` (home) + `src/routes/+page.ts`
- Create: `src/routes/about/+page.svelte`
- Create: `src/routes/credits/+page.svelte`
- Create: `src/routes/skills/+page.svelte`

**Step 1: Create home page with load function**

`src/routes/+page.ts` — load recent posts from all three collections using `import.meta.glob` and the shared `loadPosts` utility. Return top 3 from each.

`src/routes/+page.svelte` — port `src/pages/index.astro` template. Use `let { data } = $props()` to access loaded posts.

**Step 2: Create about, credits, skills pages**

Static pages — straight Astro template → Svelte conversion. No data loading.

**Step 3: Verify all pages render**

Navigate: /, /about, /credits, /skills.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: static pages — home, about, credits, skills"
```

---

### Task 7: Blog Routes (dev, maple, personal)

**Files:**
- Create: `src/routes/dev/+page.svelte` + `+page.ts`
- Create: `src/routes/dev/[slug]/+page.svelte` + `+page.ts`
- Create: `src/routes/maple/` (same pattern)
- Create: `src/routes/personal/` (same pattern)

**Step 1: Create dev blog index**

`src/routes/dev/+page.ts` — use `import.meta.glob('/src/content/dev/*.md', { eager: true })` with `loadPosts`.

`src/routes/dev/+page.svelte` — port `src/pages/dev/index.astro`.

**Step 2: Create dev blog post page**

`src/routes/dev/[slug]/+page.ts`:
```ts
import { loadPosts } from '$lib/blog';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const modules = import.meta.glob('/src/content/dev/*.md', { eager: true });
  const posts = loadPosts(modules);
  const post = posts.find(p => p.slug === params.slug);
  if (!post) throw error(404, 'Post not found');
  return { post };
};
```

`src/routes/dev/[slug]/+page.svelte` — render using `BlogPostLayout` and `<data.post.component />` (Svelte 5 dynamic component syntax, NOT `<svelte:component>`).

**Step 3: Create maple blog (same pattern)**

For maple slug pages, add audio file detection. Create `src/routes/maple/[slug]/+page.server.ts` (server-only load) that checks if an audio file exists for the post using `import.meta.glob('/static/assets/audio/maple/*.mp3')` and passes `hasAudio: boolean` to the page.

**Step 4: Create personal blog (same pattern)**

Change glob to `/src/content/personal/*.{md,mdx}`.

**Step 5: Verify a blog post renders**

Navigate to /dev, click a post. Verify title, date, tags, markdown content.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: blog routes — dev, maple, personal with mdsvex"
```

---

### Task 8: Shoutout Pages

**Files:**
- Create: `src/routes/shoutouts/+page.svelte`
- Create: `src/routes/shoutouts/bambooboys/+page.svelte`
- Create: `src/routes/shoutouts/asianfox/+page.svelte`
- Create: `src/routes/shoutouts/rmocci/+page.svelte`

**Step 1: Port all shoutout pages**

Static pages — Astro → Svelte template conversion. No data loading.

**Step 2: Verify bambooboys triggers FallingLeaves**

FallingLeaves should check `$page.url.pathname`. Navigate to /shoutouts/bambooboys, verify leaves spawn.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: shoutout pages"
```

---

### Task 9: Guestbook (API + Page)

**Files:**
- Create: `src/routes/guestbook/+page.svelte`
- Create: `src/routes/guestbook/+page.ts` (prerender = false)
- Create: `src/routes/api/guestbook/notes/+server.ts`
- Modify: `src/lib/components/guestbook/lib/db.ts` (env vars)

**Step 1: Port API endpoint**

`src/routes/api/guestbook/notes/+server.ts`:

Port `src/pages/api/guestbook/notes.ts` (212 lines) with these conversions:
- `APIRoute` → `RequestHandler` from `@sveltejs/kit`
- Export named functions: `GET`, `POST`, `DELETE`
- `context.request` → `event.request` (passed directly)
- `clientAddress` → `event.getClientAddress()`
- `new Response(JSON.stringify(...))` → use SvelteKit's `json()` helper from `@sveltejs/kit`
- Sticker manifest path: `join(process.cwd(), "static", ...)` or use `import manifest from '$lib/sticker-manifest.json'`

**Step 2: Fix environment variable access**

In `src/lib/components/guestbook/lib/db.ts`:
- Replace `import.meta.env.DATABASE_URL` with `import { DATABASE_URL } from '$env/dynamic/private'`

In the API endpoint:
- Replace `import.meta.env.PROD` with `import { dev } from '$app/environment'` and use `!dev` for production check

**Step 3: Port guestbook page**

```svelte
<script>
  import GuestBook from '$lib/components/guestbook/GuestBook.svelte';
  import '$lib/styles/guestbook.css';
</script>

<svelte:head>
  <title>guestbook | Ian Hogers</title>
</svelte:head>

<GuestBook />
```

With `+page.ts`:
```ts
export const prerender = false;
```

**Step 4: Move guestbook.css to $lib/styles/**

```bash
mv src/styles/guestbook.css src/lib/styles/guestbook.css
```

**Step 5: Verify guestbook loads and API responds**

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: guestbook page and API with env var migration"
```

---

### Task 10: RSS Feeds and Sitemap

**Files:**
- Create: `src/routes/dev/rss.xml/+server.ts`
- Create: `src/routes/personal/rss.xml/+server.ts`
- Create: `src/routes/sitemap.xml/+server.ts`

**Step 1: Create RSS feed endpoints**

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

Generate from known routes + all blog posts.

**Step 4: Verify feeds return valid XML**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: RSS feeds and sitemap"
```

---

### Task 11: Cleanup, E2E Tests, Final Verification

**Files:**
- Modify: `playwright.config.ts` (update dev server command and port)
- Modify: `tests/e2e/falling-leaves.spec.ts` (update if needed)
- Delete: `src/layouts/` (Astro layouts, now ported)
- Delete: `src/pages/` (Astro pages, now ported)

**Step 1: Update playwright.config.ts**

Change webServer command from `astro dev` to `vite dev`, update baseURL port from 4321 to 5173.

**Step 2: Delete old Astro source directories**

```bash
rm -rf src/layouts/ src/pages/
```

**Step 3: Search for remaining Astro references**

```bash
grep -r "astro" src/ --include="*.ts" --include="*.svelte" --include="*.js" --include="*.md"
```

Fix any found.

**Step 4: Run production build**

```bash
bun run build
```

**Step 5: Run E2E tests**

```bash
npx playwright test
```

Fix any failures.

**Step 6: Manual verification checklist**

- [ ] Home page renders with recent posts from all 3 collections
- [ ] Navigation between all pages works
- [ ] FallingLeaves persists across navigation (NO restart!)
- [ ] MapleAudioPlayer persists across navigation
- [ ] Blog post renders with correct markdown, date, tags
- [ ] Guestbook loads and can post new notes
- [ ] RSS feeds return valid XML
- [ ] Sitemap returns valid XML
- [ ] Mobile responsive on all pages
- [ ] Pixel-art assets render with image-rendering: pixelated
- [ ] Cursor script works across navigations

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: cleanup Astro remnants, update E2E tests"
```

**Step 8: Create PR**

```bash
git push -u origin feature/sveltekit-migration
gh pr create --title "feat: migrate from Astro to SvelteKit"
```
