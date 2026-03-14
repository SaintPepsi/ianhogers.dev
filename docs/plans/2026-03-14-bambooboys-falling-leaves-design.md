# Falling Bamboo Leaves with Poems

**Date:** 2026-03-14
**Status:** Approved
**Page:** bambooboys (shoutouts)

## Summary

Add falling pixel-art bamboo leaves as an ambient global feature. Leaves spawn when a user visits the bambooboys page and persist across page navigations via Astro ViewTransitions. Clicking a leaf opens a fortune-cookie-style poem card at the leaf's position.

## Decisions

- **Approach:** Svelte component with `transition:persist` in Base.astro
- **Visual style:** Pixel-art bamboo leaf sprites (16x16px, 3 variants) matching site aesthetic
- **Spawn behavior:** Leaves spawn on bambooboys page visit, persist across navigations via sessionStorage
- **Click interaction:** Leaf disappears, poem card appears at leaf position (clamped to viewport bounds)
- **Poem pool:** 8-12 curated bamboo proverbs, no repeats until all shown (Fisher-Yates shuffle tracked in sessionStorage)
- **Leaf count:** 6-10 concurrent leaves
- **Positioning:** dvw/dvh percentages for mobile and desktop support

## Architecture

### Component: `FallingLeaves.svelte`

Mounted in `src/layouts/Base.astro` with `client:only="svelte"` and `transition:persist` ([Astro ViewTransitions persist](https://docs.astro.build/en/guides/view-transitions/#transition-persist)).

**State management:**
- `sessionStorage["bamboo-leaves-active"]` — boolean, set true on first bambooboys visit
- `sessionStorage["bamboo-poems-seen"]` — JSON array of shown poem indices
- On mount: check activation state. If inactive and current page is `/shoutouts/bambooboys`, activate.

**Leaf spawning:**
- Spawn 6-10 leaves at random horizontal positions (% of dvw)
- Each falls from -5dvh to ~95dvh (bottom of viewport) over 8-15s (randomized)
- Horizontal drift: subtle translateX oscillation (+-3dvw)
- Subtle rotation oscillation (+-15deg) during fall
- On reaching bottom, leaf settles with a slight bounce animation and stays
- Accumulated leaves pile up at viewport bottom; after 15-20 settle, oldest fade out
- New leaves continue spawning at the top to replace faded ones
- Staggered spawn delays
- Each leaf has a subtle CSS drop-shadow for depth

**Click interaction:**
- Click leaf: leaf disappears, poem card appears at leaf's coordinates
- Card position clamped to 16px from viewport edges
- Click outside or X button closes card, new leaf spawns at top
- Poem selected without repeats until pool exhausted

### Rendering

- Fixed-position overlay container: `pointer-events: none`
- Individual leaves: `pointer-events: auto`, `cursor: pointer`
- Leaf opacity: 0.6-0.8 (ambient, not dominant)
- Subtle drop-shadow on each leaf: `filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.3))`
- `will-change: transform` for GPU acceleration

## Visual Design

### Leaf sprites
- 3 pixel-art bamboo leaf variants, 16x16px
- Green palette: #4ade80 with darker/lighter variants (matches bambooboys accent — `src/pages/shoutouts/bambooboys.astro:L18`)
- `image-rendering: pixelated` via `pixel-sprite` class (`src/styles/global.css`)

### Poem card
- Existing `pixel-box` styling (`src/styles/global.css`)
- Green accent border (#4ade80)
- Max width: 280px
- Content: bamboo emoji, italic poem text, X close button
- Fade-in animation on open

### Responsive
- All positioning via dvw/dvh
- Mobile: poem card centers horizontally if near edges
- Works across all viewport sizes

## Integration

### Files to create
- `src/components/FallingLeaves.svelte`
- `public/assets/pixel-art/decorative/bamboo-leaf-1.png` (16x16)
- `public/assets/pixel-art/decorative/bamboo-leaf-2.png` (16x16)
- `public/assets/pixel-art/decorative/bamboo-leaf-3.png` (16x16)

### Files to modify
- `src/layouts/Base.astro:L125-140` — add `<FallingLeaves>` component after existing floating decorative elements

### No changes needed
- `src/pages/shoutouts/bambooboys.astro` — component detects page via `window.location.pathname`
- `tailwind.config.mjs` — leaf animations scoped in Svelte component
- `src/styles/global.css` — styles scoped in Svelte

## Edge Cases
- ViewTransitions: `transition:persist` keeps component alive ([Astro docs](https://docs.astro.build/en/guides/view-transitions/#transition-persist))
- Back/forward nav: sessionStorage persists state
- Multiple tabs: independent sessionStorage per tab
- Performance: CSS animations are GPU-accelerated, `will-change: transform`

## Poem Content (Draft Pool)

1. "Do not judge a bamboo until it has fully grown."
2. "Bamboo that bends is stronger than the oak that resists."
3. "The bamboo that is alone stands no chance against the wind."
4. "Be like bamboo. The higher you grow, the deeper you bow."
5. "A single bamboo pole does not make a raft."
6. "When the wind blows, the bamboo bends — and rises again."
7. "The green reed which bends in the wind is stronger than the mighty oak which breaks in a storm."
8. "Bamboo is not a weed, it is a flowering plant that flowers once every hundred years."
9. "After the rain, the bamboo grove stands taller."
10. "Even the tallest bamboo started as a small shoot."
