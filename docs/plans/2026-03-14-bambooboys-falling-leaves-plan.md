# Falling Bamboo Leaves Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add falling pixel-art bamboo leaves that spawn on the bambooboys page, persist across navigations, and reveal fortune-cookie poems on click.

**Architecture:** A single `FallingLeaves.svelte` component mounted in `Base.astro` with `client:only="svelte"` and `transition:persist`. State (activation, seen poems) tracked in sessionStorage. Leaves rendered as fixed-position overlay elements with CSS animations for falling, JS for click interaction and poem cards.

**Tech Stack:** Astro 5 (`package.json:19`), Svelte 5 runes (`$state`, `$props` — pattern from `src/components/MapleAudioPlayer.svelte`), Tailwind CSS (`package.json:24`), CSS animations with dvw/dvh units.

**Design doc:** `docs/plans/2026-03-14-bambooboys-falling-leaves-design.md`

**Key references:**
- Existing Svelte component pattern: `src/components/MapleAudioPlayer.svelte`
- Layout mount point: `src/layouts/Base.astro:125-142`
- Pixel-sprite class: `src/styles/global.css:178-183`
- Pixel-box class: `src/styles/global.css:78-108`
- Bambooboys accent color (#4ade80): `src/pages/shoutouts/bambooboys.astro:19`
- Astro `transition:persist`: [Astro docs](https://docs.astro.build/en/guides/view-transitions/#transition-persist)
- Astro `client:only`: [Astro docs](https://docs.astro.build/en/guides/framework-components/#hydrating-interactive-components)

---

### Task 1: Create pixel-art bamboo leaf sprites

**Files:**
- Create: `public/assets/pixel-art/decorative/bamboo-leaf-1.png` (16x16)
- Create: `public/assets/pixel-art/decorative/bamboo-leaf-2.png` (16x16)
- Create: `public/assets/pixel-art/decorative/bamboo-leaf-3.png` (16x16)

**Step 1: Generate 3 bamboo leaf sprite variants**

Use the Media skill to create 3 pixel-art bamboo leaf sprites:
- 16x16px each
- Green palette centered on #4ade80 (the bambooboys accent color from `src/pages/shoutouts/bambooboys.astro:19`)
- Pixel-art style matching existing sprites in `public/assets/pixel-art/`
- Variant 1: single leaf, angled right
- Variant 2: single leaf, angled left
- Variant 3: small cluster of 2 leaves
- Transparent background (PNG)

**Step 2: Verify sprites exist and are correct size**

Run: `file public/assets/pixel-art/decorative/bamboo-leaf-*.png`
Expected: 3 PNG files, each 16x16

**Step 3: Commit**

```bash
git add public/assets/pixel-art/decorative/bamboo-leaf-*.png
git commit -m "feat: add pixel-art bamboo leaf sprites for falling leaves"
```

---

### Task 2: Create FallingLeaves.svelte — poem data and state management

**Files:**
- Create: `src/components/FallingLeaves.svelte`

This task creates the component shell with poem data, sessionStorage state management, and activation logic. No rendering yet.

**Step 1: Write the component with poem data and state logic**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  const BAMBOO_POEMS = [
    "Do not judge a bamboo until it has fully grown.",
    "Bamboo that bends is stronger than the oak that resists.",
    "The bamboo that is alone stands no chance against the wind.",
    "Be like bamboo. The higher you grow, the deeper you bow.",
    "A single bamboo pole does not make a raft.",
    "When the wind blows, the bamboo bends — and rises again.",
    "The green reed which bends in the wind is stronger than the mighty oak which breaks in a storm.",
    "Bamboo is not a weed, it is a flowering plant that flowers once every hundred years.",
    "After the rain, the bamboo grove stands taller.",
    "Even the tallest bamboo started as a small shoot.",
  ];

  const LEAF_SPRITES = [
    '/assets/pixel-art/decorative/bamboo-leaf-1.png',
    '/assets/pixel-art/decorative/bamboo-leaf-2.png',
    '/assets/pixel-art/decorative/bamboo-leaf-3.png',
  ];

  const LEAF_COUNT = 8;
  const STORAGE_ACTIVE_KEY = 'bamboo-leaves-active';
  const STORAGE_POEMS_KEY = 'bamboo-poems-seen';

  const MAX_SETTLED = 18;

  interface Leaf {
    id: number;
    x: number;
    sprite: string;
    duration: number;
    delay: number;
    opacity: number;
    drift: number;
    settled: boolean;
    settledRotation: number;
  }

  let isActive = $state(false);
  let leaves = $state<Leaf[]>([]);
  let openPoem = $state<{ text: string; x: number; y: number } | null>(null);
  let nextLeafId = 0;

  function getSeenPoems(): number[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_POEMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function pickPoem(): string {
    let seen = getSeenPoems();
    if (seen.length >= BAMBOO_POEMS.length) {
      seen = [];
    }
    const available = BAMBOO_POEMS.map((_, i) => i).filter(i => !seen.includes(i));
    const pick = available[Math.floor(Math.random() * available.length)];
    seen.push(pick);
    sessionStorage.setItem(STORAGE_POEMS_KEY, JSON.stringify(seen));
    return BAMBOO_POEMS[pick];
  }

  function createLeaf(delayMs = 0): Leaf {
    return {
      id: nextLeafId++,
      x: 5 + Math.random() * 90,
      sprite: LEAF_SPRITES[Math.floor(Math.random() * LEAF_SPRITES.length)],
      duration: 8 + Math.random() * 7,
      delay: delayMs / 1000,
      opacity: 0.6 + Math.random() * 0.2,
      drift: -3 + Math.random() * 6,
      settled: false,
      settledRotation: -20 + Math.random() * 40,
    };
  }

  function spawnLeaves() {
    leaves = Array.from({ length: LEAF_COUNT }, (_, i) => createLeaf(i * 800));
  }

  function handleLeafClick(leaf: Leaf, event: MouseEvent) {
    const poem = pickPoem();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let cardX = event.clientX;
    let cardY = event.clientY;

    // Clamp to viewport with 16px margin, accounting for card width (280px) and estimated height (120px)
    cardX = Math.max(16, Math.min(cardX, vw - 296));
    cardY = Math.max(16, Math.min(cardY, vh - 136));

    openPoem = { text: poem, x: cardX, y: cardY };
    leaves = leaves.filter(l => l.id !== leaf.id);
  }

  function closePoem() {
    openPoem = null;
    // Spawn a replacement leaf
    leaves = [...leaves, createLeaf()];
  }

  function handleLeafAnimationEnd(leaf: Leaf) {
    // Settle the leaf at the bottom instead of recycling
    leaf.settled = true;
    leaves = [...leaves];

    // Fade out oldest settled leaves if too many
    const settled = leaves.filter(l => l.settled);
    if (settled.length > MAX_SETTLED) {
      const toRemove = settled.slice(0, settled.length - MAX_SETTLED);
      toRemove.forEach(l => {
        const el = document.querySelector(`[data-leaf-id="${l.id}"]`);
        if (el) {
          (el as HTMLElement).style.transition = 'opacity 1s';
          (el as HTMLElement).style.opacity = '0';
          setTimeout(() => {
            leaves = leaves.filter(ll => ll.id !== l.id);
          }, 1000);
        }
      });
    }

    // Spawn a new falling leaf to replace the settled one
    leaves = [...leaves, createLeaf()];
  }

  onMount(() => {
    const wasActive = sessionStorage.getItem(STORAGE_ACTIVE_KEY) === 'true';
    const isBambooPage = window.location.pathname.includes('/shoutouts/bambooboys');

    if (wasActive || isBambooPage) {
      sessionStorage.setItem(STORAGE_ACTIVE_KEY, 'true');
      isActive = true;
      spawnLeaves();
    }

    // Listen for navigation events (Astro ViewTransitions) to check activation
    document.addEventListener('astro:page-load', () => {
      if (!isActive && window.location.pathname.includes('/shoutouts/bambooboys')) {
        sessionStorage.setItem(STORAGE_ACTIVE_KEY, 'true');
        isActive = true;
        spawnLeaves();
      }
    });
  });
</script>

<!-- Rendering added in Task 3 -->
```

**Step 2: Verify the file was created**

Run: `head -5 src/components/FallingLeaves.svelte`
Expected: `<script lang="ts">` on line 1

**Step 3: Commit**

```bash
git add src/components/FallingLeaves.svelte
git commit -m "feat: FallingLeaves component — poem data and state management"
```

---

### Task 3: Add rendering — falling leaves and poem card

**Files:**
- Modify: `src/components/FallingLeaves.svelte`

Add the template markup and scoped CSS for leaf rendering and the poem card modal.

**Step 1: Add template markup after the closing `</script>` tag**

Replace `<!-- Rendering added in Task 3 -->` with:

```svelte
{#if isActive}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="falling-leaves-container">
    {#each leaves as leaf (leaf.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="falling-leaf"
        class:settled={leaf.settled}
        data-leaf-id={leaf.id}
        style="
          left: {leaf.x}dvw;
          --fall-duration: {leaf.duration}s;
          --fall-delay: {leaf.delay}s;
          --leaf-opacity: {leaf.opacity};
          --leaf-drift: {leaf.drift}dvw;
          --settled-rotation: {leaf.settledRotation}deg;
        "
        onclick={(e) => handleLeafClick(leaf, e)}
        onanimationend={() => handleLeafAnimationEnd(leaf)}
      >
        <img
          src={leaf.sprite}
          alt=""
          class="pixel-sprite"
          width="16"
          height="16"
          draggable="false"
        />
      </div>
    {/each}
  </div>

  {#if openPoem}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="poem-backdrop" onclick={closePoem}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="poem-card pixel-box"
        style="left: {openPoem.x}px; top: {openPoem.y}px; --box-color: #4ade80;"
        onclick={(e) => e.stopPropagation()}
      >
        <button class="poem-close" onclick={closePoem} aria-label="Close poem">✕</button>
        <span class="poem-icon">🎋</span>
        <p class="poem-text">{openPoem.text}</p>
      </div>
    </div>
  {/if}
{/if}
```

**Step 2: Add scoped styles**

Add after the template:

```svelte
<style>
  .falling-leaves-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 40;
    overflow: hidden;
  }

  .falling-leaf {
    position: absolute;
    top: -5dvh;
    pointer-events: auto;
    cursor: pointer;
    opacity: var(--leaf-opacity, 0.7);
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3));
    will-change: transform;
    animation:
      leaf-fall var(--fall-duration, 10s) ease-in var(--fall-delay, 0s) forwards,
      leaf-sway var(--fall-duration, 10s) ease-in-out var(--fall-delay, 0s) forwards,
      leaf-rotate var(--fall-duration, 10s) ease-in-out var(--fall-delay, 0s) forwards;
    transition: transform 0.1s;
  }

  .falling-leaf:hover {
    transform: scale(1.3);
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3)) brightness(1.3);
  }

  .falling-leaf.settled {
    animation: leaf-settle 0.3s ease-out forwards;
    top: auto;
    bottom: 0;
    rotate: var(--settled-rotation, 0deg);
    cursor: pointer;
  }

  @keyframes leaf-fall {
    0% { top: -5dvh; }
    100% { top: calc(100dvh - 20px); }
  }

  @keyframes leaf-settle {
    0% { transform: translateY(0); }
    60% { transform: translateY(-6px); }
    100% { transform: translateY(0); }
  }

  @keyframes leaf-sway {
    0% { transform: translateX(0); }
    25% { transform: translateX(var(--leaf-drift, 3dvw)); }
    50% { transform: translateX(0); }
    75% { transform: translateX(calc(var(--leaf-drift, 3dvw) * -1)); }
    100% { transform: translateX(0); }
  }

  @keyframes leaf-rotate {
    0% { rotate: 0deg; }
    25% { rotate: 15deg; }
    50% { rotate: 0deg; }
    75% { rotate: -15deg; }
    100% { rotate: 0deg; }
  }

  .poem-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.3);
    animation: fade-in 0.15s ease;
  }

  .poem-card {
    position: fixed;
    max-width: 280px;
    padding: 1.25rem;
    z-index: 51;
    animation: poem-appear 0.2s ease;
  }

  .poem-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.75rem;
    line-height: 1;
    padding: 0.25rem;
    transition: color 0.1s;
  }

  .poem-close:hover {
    color: #4ade80;
  }

  .poem-icon {
    display: block;
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .poem-text {
    font-family: 'Inter', sans-serif;
    font-style: italic;
    font-size: 0.875rem;
    color: #d1d5db;
    line-height: 1.6;
    margin: 0;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes poem-appear {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
```

**Step 3: Commit**

```bash
git add src/components/FallingLeaves.svelte
git commit -m "feat: FallingLeaves rendering — falling animation and poem card"
```

---

### Task 4: Mount FallingLeaves in Base.astro

**Files:**
- Modify: `src/layouts/Base.astro:125-142`

**Step 1: Add import at top of frontmatter**

In the frontmatter block (lines 1-12 of `src/layouts/Base.astro`), add after the existing imports:

```astro
import FallingLeaves from '../components/FallingLeaves.svelte';
```

**Step 2: Add component to body**

In `src/layouts/Base.astro`, insert after the closing `)}` of the maple floating decoration (line 140, after the `{side === 'maple' && (...)}` block) and before the cursor script (line 142):

```astro
    <!-- Falling bamboo leaves (spawned on /shoutouts/bambooboys, persists across pages) -->
    <FallingLeaves client:only="svelte" transition:persist />
```

**Step 3: Verify the dev server starts without errors**

Run: `cd /Users/hogers/Projects/ianhogers.dev && npx astro dev`
Expected: Server starts on localhost:4321 with no build errors

**Step 4: Commit**

```bash
git add src/layouts/Base.astro
git commit -m "feat: mount FallingLeaves component in Base layout"
```

---

### Task 5: Browser testing — verify falling leaves and poem interaction

**Files:** None (testing only)

**Step 1: Navigate to bambooboys page and verify leaves spawn**

Use browser automation (@superpowers:webapp-testing) to:
1. Open `http://localhost:4321/shoutouts/bambooboys`
2. Wait 2 seconds for leaves to appear
3. Screenshot — verify leaf sprites are visible and falling with subtle drop shadows
4. Verify leaves have `pointer-events: auto` and cursor changes on hover
5. Wait 15+ seconds for leaves to reach the bottom
6. Screenshot — verify leaves accumulate at the bottom of the viewport with a settle bounce
7. Verify oldest settled leaves fade out when count exceeds 18

**Step 2: Click a leaf and verify poem card**

1. Click one of the falling leaf elements
2. Screenshot — verify poem card appears with:
   - pixel-box styling with green border
   - 🎋 icon
   - Italic poem text
   - X close button
3. Click X or backdrop to close
4. Verify a new leaf spawns after closing

**Step 3: Navigate away and verify persistence**

1. Click a nav link to go to `/about` or `/`
2. Screenshot — verify leaves are still falling on the new page
3. Navigate back to `/shoutouts/bambooboys`
4. Verify leaves are still present (not duplicated)

**Step 4: Test mobile viewport**

1. Resize viewport to 375x667 (iPhone SE)
2. Screenshot — verify leaves are visible and poem card is readable
3. Verify poem card position clamps correctly on small screens

**Step 5: Commit any fixes discovered during testing**

```bash
git add -u
git commit -m "fix: falling leaves adjustments from browser testing"
```

---

### Task 6: Test fresh session behavior

**Files:** None (testing only)

**Step 1: Clear sessionStorage and visit a non-bamboo page**

1. Open devtools, run `sessionStorage.clear()`
2. Navigate to `http://localhost:4321/`
3. Screenshot — verify NO leaves are falling (not activated yet)

**Step 2: Visit bambooboys to activate**

1. Navigate to `http://localhost:4321/shoutouts/bambooboys`
2. Verify leaves start falling
3. Verify `sessionStorage.getItem('bamboo-leaves-active')` returns `'true'`

**Step 3: Verify poem no-repeat logic**

1. Click leaves and collect poems until pool is exhausted (10 poems)
2. Verify no duplicates within a cycle
3. After seeing all 10, click another leaf — verify pool resets and a poem shows

**Step 4: Final commit if any fixes**

```bash
git add -u
git commit -m "fix: session and poem cycle edge cases"
```
