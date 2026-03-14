<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

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
    settled: boolean;
    fading: boolean;
    settledRotation: number;
    settledBottom: number;
    // Physics state
    startTime: number;
    currentX: number;
    currentY: number;
    currentRotation: number;
    done: boolean;
    // Per-leaf physics params
    swayAmplitude: number;   // dvw, how far it drifts horizontally
    swayFrequency: number;   // Hz, oscillations per fall
    swayPhase: number;       // radians, starting phase offset
    baseSpeed: number;       // dvh/s, average vertical speed
    dragCoefficient: number; // 0-1, how much sway slows the fall
  }

  /**
   * Physics-based leaf motion:
   * - Horizontal: sinusoidal sway with per-leaf amplitude, frequency, and phase
   * - Vertical: base gravity speed modulated by horizontal velocity (leaf falls
   *   fastest when sway velocity is zero, i.e. at the extremes of horizontal
   *   travel, the leaf momentarily pauses vertically — wait, that's wrong.
   *   Actually: fastest vertical when passing through center, slowest at edges.)
   *   We use: vY = baseSpeed * (1 - drag * |cos(wt + phase)|)
   *   cos is max at sway center crossing → drag slows it there? No.
   *   sin derivative = cos, so horizontal velocity = A*w*cos(wt+p).
   *   We want vertical speed to peak when horizontal displacement is zero
   *   (center of swing). Displacement = A*sin(wt+p), so center when sin=0,
   *   which is when cos is ±1 (max horizontal velocity).
   *   So: vY = baseSpeed * (1 + drag * |cos(wt+p)|) — falls fastest at center.
   * - Rotation: proportional to horizontal velocity (tilts in sway direction)
   */
  function computeLeafPosition(leaf: Leaf, elapsed: number): { x: number; y: number; rotation: number } {
    const { swayAmplitude, swayFrequency, swayPhase, baseSpeed, dragCoefficient } = leaf;
    const w = swayFrequency * Math.PI * 2;
    const t = elapsed;

    // Horizontal: simple sine wave
    const x = swayAmplitude * Math.sin(w * t + swayPhase);

    // Vertical: integrate speed over time. Speed = baseSpeed * (1 + drag * |cos(wt+p)|)
    // For smooth results, compute analytically:
    // y = baseSpeed * t + baseSpeed * drag * integral(|cos(wt+p)|) from 0 to t
    // integral of |cos(u)| over one period = 4/period, but piecewise is complex.
    // Approximate: since |cos| averages to 2/pi ≈ 0.637, and we want the modulation
    // to feel natural, just use the instantaneous formula per frame.
    // We accumulate y in the animation loop instead.
    // Return NaN for y to signal "use accumulated value"
    const horizontalVelocity = Math.abs(Math.cos(w * t + swayPhase));
    const verticalSpeed = baseSpeed * (1 + dragCoefficient * horizontalVelocity);

    // Rotation: tilt proportional to horizontal velocity (leaf banks into its sway)
    const swayVelocity = swayAmplitude * w * Math.cos(w * t + swayPhase);
    const rotation = swayVelocity * -2.5;

    return { x, y: verticalSpeed, rotation };
  }

  let isActive = $state(false);
  let leaves = $state<Leaf[]>([]);
  let openPoem = $state<{ text: string; x: number; y: number } | null>(null);
  let nextLeafId = 0;
  let spawnTimerId: ReturnType<typeof setTimeout> | null = null;
  let mounted = $state(false);

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

  function createLeaf(): Leaf {
    return {
      id: nextLeafId++,
      x: 5 + Math.random() * 90,
      sprite: LEAF_SPRITES[Math.floor(Math.random() * LEAF_SPRITES.length)],
      duration: 18 + Math.random() * 12,
      opacity: 0.6 + Math.random() * 0.2,
      settled: false,
      fading: false,
      settledRotation: -20 + Math.random() * 40,
      settledBottom: Math.random() * 12,
      startTime: 0,
      currentX: 0,
      currentY: -5,
      currentRotation: 0,
      done: false,
      swayAmplitude: 3 + Math.random() * 4,       // 3-7 dvw
      swayFrequency: 0.08 + Math.random() * 0.06,  // 0.08-0.14 Hz (slow, lazy sway)
      swayPhase: Math.random() * Math.PI * 2,       // random start angle
      baseSpeed: 3.5 + Math.random() * 1.5,         // 3.5-5 dvh/s
      dragCoefficient: 0.3 + Math.random() * 0.3,   // 0.3-0.6 modulation depth
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
    leaves = [...leaves, createLeaf()];
    scheduleNextSpawn();
    startAnimationLoop();
  }

  function isBambooPage(pathname: string): boolean {
    return pathname === BAMBOO_PATH || pathname === BAMBOO_PATH + '/';
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

  let rafId: number | null = null;

  function settleLeaf(leaf: Leaf) {
    if (leaf.settled) return;
    leaf.settled = true;
    leaf.done = true;

    const leafId = leaf.id;
    setTimeout(() => {
      const target = leaves.find(l => l.id === leafId);
      if (target && target.settled && !target.fading) {
        target.fading = true;
        setTimeout(() => {
          leaves = leaves.filter(l => l.id !== leafId);
          if (!allPoemsRead()) {
            leaves = [...leaves, createLeaf()];
          }
        }, 1000);
      }
    }, SETTLE_FADE_DELAY);
  }

  let lastTickTime = 0;

  function animationTick(now: number) {
    const dt = lastTickTime === 0 ? 0.016 : Math.min((now - lastTickTime) / 1000, 0.1);
    lastTickTime = now;
    let needsUpdate = false;

    for (const leaf of leaves) {
      if (leaf.done || leaf.settled) continue;

      if (leaf.startTime === 0) {
        leaf.startTime = now;
      }

      const elapsed = (now - leaf.startTime) / 1000;
      const { x, y: verticalSpeed, rotation } = computeLeafPosition(leaf, elapsed);

      leaf.currentX = x;
      leaf.currentY += verticalSpeed * dt;
      leaf.currentRotation = Math.max(-35, Math.min(35, rotation));
      needsUpdate = true;

      if (leaf.currentY >= 100) {
        leaf.currentY = 100;
        settleLeaf(leaf);
      }
    }

    if (needsUpdate) {
      leaves = leaves;
    }

    rafId = requestAnimationFrame(animationTick);
  }

  function startAnimationLoop() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(animationTick);
  }

  function stopAnimationLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && openPoem) {
      closePoem();
    }
  }

  // Detect navigation to bamboo page after initial mount.
  // The component lives in +layout.svelte so it persists across navigations,
  // but we still need to activate when the user navigates TO the bambooboys page.
  $effect(() => {
    const pathname = page.url.pathname;
    if (!mounted) return;
    if (!isActive && isBambooPage(pathname) && !allPoemsRead()) {
      safeSetItem(STORAGE_ACTIVE_KEY, 'true');
      isActive = true;
      startTrickleSpawn();
    }
  });

  onMount(() => {
    mounted = true;
    const wasActive = safeGetItem(STORAGE_ACTIVE_KEY) === 'true';

    if ((wasActive || isBambooPage(page.url.pathname)) && !allPoemsRead()) {
      safeSetItem(STORAGE_ACTIVE_KEY, 'true');
      isActive = true;
      startTrickleSpawn();
    }

    document.addEventListener('keydown', handleKeydown);

    return () => {
      stopSpawning();
      stopAnimationLoop();
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
          opacity: {leaf.opacity};
          translate: {leaf.currentX}dvw {leaf.currentY}dvh;
          rotate: {leaf.settled ? leaf.settledRotation + 'deg' : leaf.currentRotation + 'deg'};
          {leaf.settled ? 'bottom: ' + leaf.settledBottom + 'px;' : ''}
        "
        onclick={(e) => handleLeafClick(leaf, e)}
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
        <button class="poem-close" onclick={closePoem} aria-label="Close poem">&#10005;</button>
        <p class="poem-text">{openPoem.text}</p>
        <img src="/assets/pixel-art/decorative/bamboo-stem.png" alt="" class="stamp-icon pixel-sprite" />
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
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3));
    transition: scale 0.15s ease;
  }

  .falling-leaf:hover {
    scale: 1.3;
    filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.3)) brightness(1.3);
  }

  .falling-leaf.settled {
    top: auto;
  }

  .falling-leaf.fading {
    opacity: 0 !important;
    transition: opacity 1s ease;
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
    border-width: 22px;
    border-image: url('/assets/pixel-art/ui/scroll-frame-02.png') 22 fill / 32px / 0 round;
    image-rendering: pixelated;
    box-sizing: border-box;
  }

  .stamp-icon {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    pointer-events: none;
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
