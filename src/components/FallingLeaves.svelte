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
  const MAX_SETTLED = 18;
  const STORAGE_ACTIVE_KEY = 'bamboo-leaves-active';
  const STORAGE_POEMS_KEY = 'bamboo-poems-seen';
  const BAMBOO_PATH = '/shoutouts/bambooboys';

  interface Leaf {
    id: number;
    x: number;
    sprite: string;
    duration: number;
    delay: number;
    opacity: number;
    drift: number;
    settled: boolean;
    fading: boolean;
    settledRotation: number;
    settledBottom: number;
  }

  let isActive = $state(false);
  let leaves = $state<Leaf[]>([]);
  let openPoem = $state<{ text: string; x: number; y: number } | null>(null);
  let nextLeafId = 0;

  function safeSetItem(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Private browsing or quota exceeded — silently fail
    }
  }

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
    safeSetItem(STORAGE_POEMS_KEY, JSON.stringify(seen));
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
      fading: false,
      settledRotation: -20 + Math.random() * 40,
      settledBottom: Math.random() * 12,
    };
  }

  function spawnLeaves() {
    leaves = Array.from({ length: LEAF_COUNT }, (_, i) => createLeaf(i * 800));
  }

  function isBambooPage(): boolean {
    const path = window.location.pathname;
    return path === BAMBOO_PATH || path === BAMBOO_PATH + '/';
  }

  function handleLeafClick(leaf: Leaf, event: MouseEvent) {
    const poem = pickPoem();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let cardX = event.clientX;
    let cardY = event.clientY;

    // On mobile (< 480px), center the card horizontally
    if (vw < 480) {
      cardX = (vw - 280) / 2;
    } else {
      // Clamp to viewport with 16px margin, accounting for card width (280px)
      cardX = Math.max(16, Math.min(cardX, vw - 296));
    }
    // Clamp vertically with 16px margin, accounting for estimated card height (120px)
    cardY = Math.max(16, Math.min(cardY, vh - 136));

    openPoem = { text: poem, x: cardX, y: cardY };
    leaves = leaves.filter(l => l.id !== leaf.id);
  }

  function closePoem() {
    openPoem = null;
    // Spawn a replacement leaf
    leaves = [...leaves, createLeaf()];
  }

  function handleLeafAnimationEnd(leaf: Leaf, event: AnimationEvent) {
    // Only handle the leaf-fall animation ending — ignore leaf-rotate
    // This prevents double-spawning (one per animation)
    if (event.animationName !== 'leaf-fall') return;
    if (leaf.settled) return;

    // Settle the leaf at the bottom
    leaf.settled = true;
    leaves = [...leaves];

    // Fade out oldest settled leaves if too many
    const settled = leaves.filter(l => l.settled && !l.fading);
    if (settled.length > MAX_SETTLED) {
      const toRemove = settled.slice(0, settled.length - MAX_SETTLED);
      toRemove.forEach(l => {
        l.fading = true;
      });
      leaves = [...leaves];
      // Remove faded leaves after the CSS transition completes
      setTimeout(() => {
        leaves = leaves.filter(l => !l.fading);
      }, 1000);
    }

    // Spawn a new falling leaf to replace the settled one
    leaves = [...leaves, createLeaf()];
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && openPoem) {
      closePoem();
    }
  }

  onMount(() => {
    const wasActive = sessionStorage.getItem(STORAGE_ACTIVE_KEY) === 'true';

    if (wasActive || isBambooPage()) {
      safeSetItem(STORAGE_ACTIVE_KEY, 'true');
      isActive = true;
      spawnLeaves();
    }

    // Listen for navigation events (Astro ViewTransitions) to check activation
    document.addEventListener('astro:page-load', () => {
      if (!isActive && isBambooPage()) {
        safeSetItem(STORAGE_ACTIVE_KEY, 'true');
        isActive = true;
        spawnLeaves();
      }
    });

    // Escape key to close poem card
    document.addEventListener('keydown', handleKeydown);
  });
</script>

{#if isActive}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="falling-leaves-container">
    {#each leaves as leaf (leaf.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="falling-leaf"
        class:settled={leaf.settled}
        class:fading={leaf.fading}
        style="
          left: {leaf.x}dvw;
          --fall-duration: {leaf.duration}s;
          --fall-delay: {leaf.delay}s;
          --leaf-opacity: {leaf.opacity};
          --leaf-drift: {leaf.drift}dvw;
          --settled-rotation: {leaf.settledRotation}deg;
          --settled-bottom: {leaf.settledBottom}px;
        "
        onclick={(e) => handleLeafClick(leaf, e)}
        onanimationend={(e) => handleLeafAnimationEnd(leaf, e)}
      >
        <img
          src={leaf.sprite}
          alt=""
          class="pixel-sprite"
          width="48"
          height="48"
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
        <img src="/assets/pixel-art/decorative/bamboo-stem.png" alt="" class="poem-icon pixel-sprite" width="48" height="48" draggable="false" />
        <p class="poem-text">{openPoem.text}</p>
      </div>
    </div>
  {/if}
{/if}

<style>
  .falling-leaves-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 40;
    overflow: hidden;
  }

  /* Uses individual CSS transform properties (translate, rotate, scale)
     so they compose independently without overriding each other.
     All animation is pure CSS. */

  .falling-leaf {
    position: absolute;
    top: 0;
    pointer-events: auto;
    cursor: pointer;
    opacity: var(--leaf-opacity, 0.7);
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3));
    will-change: translate, rotate;
    animation:
      leaf-fall var(--fall-duration, 10s) ease-in var(--fall-delay, 0s) forwards,
      leaf-rotate var(--fall-duration, 10s) ease-in-out var(--fall-delay, 0s) infinite;
    transition: scale 0.15s ease;
  }

  .falling-leaf:hover {
    scale: 1.3;
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3)) brightness(1.3);
  }

  /* Settled leaf: stops at bottom with bounce, varied offset for pile effect */
  .falling-leaf.settled {
    animation: leaf-settle 0.3s ease-out forwards;
    top: auto;
    bottom: var(--settled-bottom, 0px);
    rotate: var(--settled-rotation, 0deg);
    translate: none;
  }

  .falling-leaf.fading {
    opacity: 0;
    transition: opacity 1s ease;
  }

  /* Fall + sway combined into translate property (GPU-accelerated) */
  @keyframes leaf-fall {
    0% { translate: 0 -5dvh; }
    25% { translate: var(--leaf-drift, 3dvw) 23dvh; }
    50% { translate: 0 48dvh; }
    75% { translate: calc(var(--leaf-drift, 3dvw) * -1) 73dvh; }
    100% { translate: 0 calc(100dvh - 20px); }
  }

  @keyframes leaf-rotate {
    0% { rotate: 0deg; }
    25% { rotate: 15deg; }
    50% { rotate: 0deg; }
    75% { rotate: -15deg; }
    100% { rotate: 0deg; }
  }

  @keyframes leaf-settle {
    0% { translate: 0 0; }
    60% { translate: 0 -6px; }
    100% { translate: 0 0; }
  }

  /* Poem card */
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
    margin-bottom: 0.5rem;
  }

  .poem-text {
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
    from { opacity: 0; scale: 0.9; }
    to { opacity: 1; scale: 1; }
  }
</style>
