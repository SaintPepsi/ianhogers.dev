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

  const SETTLE_FADE_DELAY = 30_000;
  const STORAGE_ACTIVE_KEY = 'bamboo-leaves-active';
  const STORAGE_POEMS_KEY = 'bamboo-poems-seen';
  const STORAGE_READ_KEY = 'bamboo-poems-read';
  const BAMBOO_PATH = '/shoutouts/bambooboys';

  interface Leaf {
    id: number;
    x: number;
    sprite: string;
    duration: number;
    opacity: number;
    drift1: number;
    drift2: number;
    drift3: number;
    drift4: number;
    settled: boolean;
    fading: boolean;
    settledRotation: number;
    settledBottom: number;
  }

  let isActive = $state(false);
  let leaves = $state<Leaf[]>([]);
  let openPoem = $state<{ text: string; x: number; y: number } | null>(null);
  let nextLeafId = 0;
  let spawnTimerId: ReturnType<typeof setTimeout> | null = null;

  function safeSetItem(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Private browsing or quota exceeded
    }
  }

  function safeGetItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function getSeenPoems(): number[] {
    try {
      const raw = safeGetItem(STORAGE_POEMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function getPoemsReadCount(): number {
    const raw = safeGetItem(STORAGE_READ_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  }

  function allPoemsRead(): boolean {
    return getPoemsReadCount() >= BAMBOO_POEMS.length;
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

  function randomDrift(): number {
    const magnitude = 4 + Math.random() * 2;
    return Math.random() > 0.5 ? magnitude : -magnitude;
  }

  function createLeaf(): Leaf {
    return {
      id: nextLeafId++,
      x: 5 + Math.random() * 90,
      sprite: LEAF_SPRITES[Math.floor(Math.random() * LEAF_SPRITES.length)],
      duration: 18 + Math.random() * 12,
      opacity: 0.6 + Math.random() * 0.2,
      drift1: randomDrift(),
      drift2: randomDrift(),
      drift3: randomDrift(),
      drift4: randomDrift(),
      settled: false,
      fading: false,
      settledRotation: -20 + Math.random() * 40,
      settledBottom: Math.random() * 12,
    };
  }

  function scheduleNextSpawn() {
    if (allPoemsRead()) return;
    const delay = 30_000 + Math.random() * 50_000;
    spawnTimerId = setTimeout(() => {
      if (!allPoemsRead()) {
        leaves = [...leaves, createLeaf()];
      }
      scheduleNextSpawn();
    }, delay);
  }

  function stopSpawning() {
    if (spawnTimerId !== null) {
      clearTimeout(spawnTimerId);
      spawnTimerId = null;
    }
  }

  function startTrickleSpawn() {
    stopSpawning();
    // Spawn first leaf immediately
    leaves = [...leaves, createLeaf()];
    scheduleNextSpawn();
  }

  function isBambooPage(): boolean {
    const path = window.location.pathname;
    return path === BAMBOO_PATH || path === BAMBOO_PATH + '/';
  }

  function handleLeafClick(leaf: Leaf, event: MouseEvent) {
    const poem = pickPoem();
    const readCount = getPoemsReadCount() + 1;
    safeSetItem(STORAGE_READ_KEY, String(readCount));

    openPoem = { text: poem, x: event.clientX, y: event.clientY };
    leaves = leaves.filter(l => l.id !== leaf.id);
  }

  function closePoem() {
    openPoem = null;
    if (!allPoemsRead()) {
      leaves = [...leaves, createLeaf()];
    }
  }

  function handleLeafAnimationEnd(leaf: Leaf, event: AnimationEvent) {
    if (event.animationName !== 'leaf-fall') return;
    if (leaf.settled) return;

    leaf.settled = true;
    leaves = [...leaves];

    // Auto-fade settled leaf after delay
    const leafId = leaf.id;
    setTimeout(() => {
      const target = leaves.find(l => l.id === leafId);
      if (target && target.settled && !target.fading) {
        target.fading = true;
        leaves = [...leaves];
        setTimeout(() => {
          leaves = leaves.filter(l => l.id !== leafId);
          // Spawn replacement if poems remain
          if (!allPoemsRead()) {
            leaves = [...leaves, createLeaf()];
          }
        }, 1000);
      }
    }, SETTLE_FADE_DELAY);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && openPoem) {
      closePoem();
    }
  }

  onMount(() => {
    const wasActive = safeGetItem(STORAGE_ACTIVE_KEY) === 'true';

    if ((wasActive || isBambooPage()) && !allPoemsRead()) {
      safeSetItem(STORAGE_ACTIVE_KEY, 'true');
      isActive = true;
      startTrickleSpawn();
    }

    document.addEventListener('astro:page-load', () => {
      if (!isActive && isBambooPage() && !allPoemsRead()) {
        safeSetItem(STORAGE_ACTIVE_KEY, 'true');
        isActive = true;
        startTrickleSpawn();
      }
    });

    document.addEventListener('keydown', handleKeydown);

    return () => {
      stopSpawning();
      document.removeEventListener('keydown', handleKeydown);
    };
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
          --leaf-opacity: {leaf.opacity};
          --drift-1: {leaf.drift1}dvw;
          --drift-2: {leaf.drift2}dvw;
          --drift-3: {leaf.drift3}dvw;
          --drift-4: {leaf.drift4}dvw;
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
        class="poem-card"
        style="--click-x: {openPoem.x}px; --click-y: {openPoem.y}px;"
        onclick={(e) => e.stopPropagation()}
      >
        <button class="poem-close" onclick={closePoem} aria-label="Close poem">✕</button>
        <p class="poem-text">{openPoem.text}</p>
        <div class="seal-stamp">
          <img src="/assets/pixel-art/ui/btn-seal.png" alt="" class="seal-img pixel-sprite" />
          <img src="/assets/pixel-art/decorative/bamboo-stem.png" alt="" class="bamboo-overlay pixel-sprite" />
        </div>
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

  .falling-leaf {
    position: absolute;
    top: 0;
    pointer-events: auto;
    cursor: pointer;
    opacity: var(--leaf-opacity, 0.7);
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3));
    will-change: translate, rotate;
    animation:
      leaf-fall var(--fall-duration, 20s) ease-in-out forwards,
      leaf-rotate var(--fall-duration, 20s) ease-in-out forwards;
    transition: scale 0.15s ease;
  }

  .falling-leaf:hover {
    scale: 1.3;
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3)) brightness(1.3);
  }

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

  /* Lazy float: 8-point organic curve with per-leaf random drift values */
  @keyframes leaf-fall {
    0%    { translate: 0 -5dvh; }
    12%   { translate: var(--drift-1, 4dvw) 10dvh; }
    25%   { translate: var(--drift-2, -3dvw) 22dvh; }
    37%   { translate: calc(var(--drift-1, 4dvw) * 0.5) 35dvh; }
    50%   { translate: var(--drift-3, 5dvw) 48dvh; }
    62%   { translate: calc(var(--drift-2, -3dvw) * -0.7) 60dvh; }
    75%   { translate: var(--drift-4, -4dvw) 73dvh; }
    87%   { translate: calc(var(--drift-3, 5dvw) * 0.3) 86dvh; }
    100%  { translate: 0 calc(100dvh - 20px); }
  }

  /* Rotation synced to drift: follows the sway direction */
  @keyframes leaf-rotate {
    0%    { rotate: 0deg; }
    12%   { rotate: 8deg; }
    25%   { rotate: -6deg; }
    37%   { rotate: 4deg; }
    50%   { rotate: -8deg; }
    62%   { rotate: 6deg; }
    75%   { rotate: -4deg; }
    87%   { rotate: 3deg; }
    100%  { rotate: 0deg; }
  }

  @keyframes leaf-settle {
    0% { translate: 0 0; }
    60% { translate: 0 -6px; }
    100% { translate: 0 0; }
  }

  /* Parchment scroll poem card */
  .poem-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.3);
    animation: fade-in 0.15s ease;
  }

  .poem-card {
    position: fixed;
    left: clamp(16px, var(--click-x), calc(100dvw - 256px));
    top: clamp(16px, var(--click-y), calc(100dvh - 240px));
    max-width: 240px;
    padding: 24px;
    padding-bottom: 48px;
    z-index: 51;
    animation: poem-appear 0.2s ease;
    border-style: solid;
    border-width: 24px;
    border-image: url('/assets/pixel-art/ui/scroll-frame-02.png') 10 6 16 10 fill / 24px / 0 stretch;
    image-rendering: pixelated;
    box-sizing: border-box;
  }

  .seal-stamp {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 32px;
    height: 32px;
    z-index: 2;
    pointer-events: none;
  }

  .seal-img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }

  .bamboo-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }

  .poem-close {
    position: absolute;
    top: 4px;
    right: 8px;
    background: none;
    border: none;
    color: #7c5a3a;
    cursor: pointer;
    font-size: 0.875rem;
    line-height: 1;
    padding: 0.25rem;
    transition: color 0.1s;
  }

  .poem-close:hover {
    color: #3d2b1f;
  }

  .poem-text {
    font-style: italic;
    font-size: 0.875rem;
    color: #3d2b1f;
    line-height: 1.6;
    margin: 0;
    text-align: center;
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
