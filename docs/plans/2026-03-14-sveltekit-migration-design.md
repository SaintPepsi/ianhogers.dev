# Astro → SvelteKit Migration Design

## Motivation

Persistent layout shell. Astro's ViewTransitions require opt-in persistence per element (`transition:persist`) and still cause CSS animation restarts, state loss, and DOM re-rendering on navigation. SvelteKit layouts stay mounted by default — components in `+layout.svelte` survive all navigations without any workarounds.

Primary pain points resolved:
- FallingLeaves animation restart on page navigation
- MapleAudioPlayer state loss during ViewTransition swap
- `client:only="svelte"` boilerplate for every interactive component
- `astro:before-swap` / `astro:after-swap` hacks to preserve state

## Current Project Scope

- 15 pages (index, about, credits, skills, guestbook, 3 blog sections with dynamic slug routes, 3 shoutout pages)
- 11 markdown/mdx blog posts across 3 collections (dev, maple, personal)
- 6 Svelte components (GuestBook suite, FallingLeaves, MapleAudioPlayer, MermaidDiagram)
- 4 Astro components (Gallery, CollageItem, GalleryGroup) → convert to Svelte
- 2 layouts (Base, BlogPost)
- 1 API endpoint (guestbook notes, Neon DB)
- 2 RSS feeds (dev, personal)
- Vercel deployment, Tailwind CSS, sitemap

## Architecture

### Route Structure

```
src/routes/
  +layout.svelte          ← Persistent shell (nav, FallingLeaves, audio, cursor)
  +layout.ts              ← Root load function if needed
  +page.svelte            ← Home
  about/+page.svelte
  credits/+page.svelte
  skills/+page.svelte
  guestbook/+page.svelte
  dev/
    +page.svelte          ← Blog index
    [slug]/
      +page.svelte        ← Blog post renderer
      +page.ts            ← Load markdown content
  maple/                  ← Same structure as dev/
  personal/               ← Same structure as dev/
  shoutouts/
    +page.svelte
    bambooboys/+page.svelte
    asianfox/+page.svelte
    rmocci/+page.svelte
  api/
    guestbook/
      notes/+server.ts   ← GET/POST handler
  dev/rss.xml/+server.ts  ← RSS feed
  personal/rss.xml/+server.ts
  sitemap.xml/+server.ts
```

### Key Mapping

| Astro | SvelteKit |
|-------|-----------|
| `src/layouts/Base.astro` | `src/routes/+layout.svelte` |
| `src/layouts/BlogPost.astro` | Shared blog layout or component |
| `src/pages/*.astro` | `src/routes/**/+page.svelte` |
| `src/pages/api/**/*.ts` | `src/routes/api/**/+server.ts` |
| Content Collections | mdsvex + `import.meta.glob` |
| `transition:persist` | Not needed |
| `client:only="svelte"` | Not needed |
| ViewTransitions | SvelteKit router (default) |
| `public/` | `static/` |

### What Stays the Same

- All Svelte components — native in SvelteKit, no `client:only` wrappers
- Tailwind CSS, global.css, guestbook.css
- All pixel-art assets (moved from `public/` to `static/`)
- Neon DB connection for guestbook
- Vercel deployment (`@sveltejs/adapter-vercel`)
- Playwright E2E tests (update URLs if needed)

### What Changes

- Astro components (Gallery, CollageItem, GalleryGroup) → Svelte components
- Content loading: Astro content collections → mdsvex preprocessor
- RSS feeds: `.xml.js` files → `+server.ts` endpoints
- Sitemap: `@astrojs/sitemap` → custom endpoint or `svelte-sitemap`
- rehype-external-links: configured in mdsvex options
- FallingLeaves: remove all ViewTransition workarounds (`astro:before-swap`, `astro:after-swap`, `astro:page-load`). Lives in `+layout.svelte`, stays mounted forever.

### Dependencies

**Remove:** `astro`, `@astrojs/mdx`, `@astrojs/rss`, `@astrojs/sitemap`, `@astrojs/svelte`, `@astrojs/tailwind`, `@astrojs/vercel`, `rehype-external-links`

**Add:** `@sveltejs/kit`, `@sveltejs/adapter-vercel`, `svelte`, `mdsvex`

**Keep:** `@neondatabase/serverless`, `@vercel/kv`, `bits-ui`, `mermaid`, `obscenity`, `tailwindcss`, `@playwright/test`

### FallingLeaves Simplification

Current (Astro):
- `client:only="svelte"` directive
- `transition:persist` attribute
- `astro:page-load` listener for activation
- `astro:before-swap` / `astro:after-swap` for animation preservation
- Web Animations API hack to capture/restore elapsed time

SvelteKit:
- Component in `+layout.svelte`
- `$page.url.pathname` for route detection (replaces `window.location.pathname`)
- `onMount` for initialization
- No persistence hacks needed — component never unmounts

### Risks

1. **mdsvex frontmatter**: May parse differently from Astro content collections. Verify early with one post.
2. **Tailwind config**: SvelteKit uses `postcss.config.js` + `tailwind.config.js`. May need adjustment.
3. **Vercel adapter config**: Server-side rendering config differs. Guestbook API needs `export const prerender = false`.
4. **Prefetching**: Astro had `prefetchAll: true`. SvelteKit has `data-sveltekit-preload-data` for similar behavior.
