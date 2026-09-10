<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { arcade, closeArcade, setFullscreenParam } from '$lib/arcade.svelte';
  import { games } from '$lib/data/games';

  let session = $state(0);
  let credits = $state(1);
  let loaded = $state(false);
  let frame: HTMLIFrameElement | undefined = $state();
  // "Full screen" means the cabinet fills the browser viewport, not the native API.
  // Below 768px it always fills; the button only matters on wider screens.
  let expanded = $state(false);
  let innerWidth = $state(1024);
  const fills = $derived(expanded || innerWidth < 768);

  const game = $derived(arcade.game);

  // URL -> cabinet. Covers pasted links, the back button, and our own open/close.
  // Only assign when the slug actually changes: the fullscreen param also changes the
  // URL, and re-assigning the same game would reset the session and reload the iframe.
  $effect(() => {
    const slug = page.url.searchParams.get('play');
    if ((arcade.game?.slug ?? null) === slug) return;
    arcade.game = slug ? (games.find((g) => g.slug === slug) ?? null) : null;
  });

  const accent: Record<string, string> = {
    crimson: '#ef5350',
    lavender: '#b388ff',
    amber: '#f59e0b',
    maple: '#fb923c',
  };

  // Reset per-session bits whenever a (different) game is opened, and lock page scroll.
  $effect(() => {
    const slug = game?.slug;
    if (!slug) return;
    session = 0;
    credits = 1;
    loaded = false;
    crt = 'idle';
    clearTimeout(crtTimer);
    expanded = untrack(() => page.url.searchParams.get('fullscreen') === '1');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  });

  // CRT power cycle on coin: collapse to a white dot, black void, then come back wobbling.
  let crt = $state<'idle' | 'off' | 'on'>('idle');
  let crtTimer: ReturnType<typeof setTimeout> | undefined;

  function insertCoin() {
    if (crt === 'off') return;
    credits += 1;
    crt = 'off';
    clearTimeout(crtTimer);
    crtTimer = setTimeout(() => {
      loaded = false;
      session += 1;
      crt = 'on';
      crtTimer = setTimeout(() => (crt = 'idle'), 1200);
    }, 720);
  }

  function leave() {
    closeArcade();
  }

  function toggleFullscreen() {
    expanded = !expanded;
    setFullscreenParam(expanded);
    frame?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (!game) return;
    if (e.key === 'Escape') leave();
  }

  function onLoad() {
    loaded = true;
    frame?.focus();
  }
</script>

<svelte:window onkeydown={onKey} bind:innerWidth />

{#if game}
  <div class="arcade-backdrop" role="dialog" aria-modal="true" aria-label="{game.title} arcade cabinet">
    <div class="cabinet" class:fills style="--accent: {accent[game.accent]}; --theme: {game.theme}">
      <!-- Marquee -->
      <header class="marquee">
        <img src="/assets/pixel-art/game-assets/wow_yellow.png" alt="" class="pixel-sprite marquee-sprite animate-float-slow" />
        <h2 class="marquee-title font-display">{game.title}</h2>
        <div class="marquee-credits font-pixel">
          <span class="dim">CREDITS</span> {String(credits).padStart(2, '0')}
        </div>
      </header>

      <!-- Screen -->
      <div class="bezel">
        <div class="screen" class:booted={loaded} class:off={crt === 'off'} class:on={crt === 'on'}>
          {#key session}
            <iframe
              bind:this={frame}
              title={game.title}
              src={game.embed}
              allow="fullscreen; autoplay; gamepad"
              onload={onLoad}
            ></iframe>
          {/key}
          {#if !loaded}
            <div class="attract font-pixel" aria-hidden="true">
              <span class="blink">INSERT COIN</span>
              <span class="dim">loading {game.title.toLowerCase()}...</span>
            </div>
          {/if}
          <div class="scanlines" aria-hidden="true"></div>
          <div class="glow" aria-hidden="true"></div>
          {#if crt === 'on'}
            <div class="static" aria-hidden="true"></div>
          {/if}
        </div>
      </div>

      <!-- Control panel -->
      <footer class="panel">
        <div class="buttons">
          <button type="button" class="arcade-btn" onclick={insertCoin}>
            <span class="cap cap-yellow"></span>
            <span class="label font-pixel">INSERT COIN</span>
          </button>
          {#if innerWidth >= 768}
            <button type="button" class="arcade-btn" onclick={toggleFullscreen}>
              <span class="cap cap-green"></span>
              <span class="label font-pixel">{expanded ? 'WINDOW' : 'FULL SCREEN'}</span>
            </button>
          {/if}
          <button type="button" class="arcade-btn" onclick={leave}>
            <span class="cap cap-red"></span>
            <span class="label font-pixel">LEAVE</span>
          </button>
        </div>

        <div class="panel-links font-mono">
          <a href={game.play} target="_blank" rel="noopener">open in new tab</a>
          {#if game.source}<a href={game.source} target="_blank" rel="noopener">source</a>{/if}
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  .font-pixel {
    font-family: 'Grand9KPixel', monospace;
    letter-spacing: 0.06em;
  }
  .dim {
    color: #6b6480;
  }

  .arcade-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(8, 6, 12, 0.94);
    display: grid;
    place-items: center;
    padding: 1.25rem;
    animation: fade 0.2s ease;
  }
  @keyframes fade {
    from { opacity: 0; }
  }

  /* Cabinet: marquee / screen / panel. The accent is the cabinet's neon. */
  .cabinet {
    width: min(1100px, 100%);
    height: min(100%, 96vh);
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: #1e1a28;
    border: 4px solid #2a2438;
    box-shadow:
      0 0 0 3px #0f0d14,
      0 0 0 4px var(--accent),
      0 40px 80px -20px rgba(0, 0, 0, 0.9);
    image-rendering: pixelated;
  }

  /* Marquee: bare title over a diagonal-stripe rule with a solid line under it. */
  .marquee {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.7rem 1.25rem 0.9rem;
  }
  .marquee::after,
  .fills .marquee::before,
  .fills .panel::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 9px;
    background:
      repeating-linear-gradient(-45deg, var(--accent) 0 4px, transparent 4px 10px) top / 100% 6px no-repeat,
      linear-gradient(var(--accent), var(--accent)) bottom / 100% 2px no-repeat;
    pointer-events: none;
  }
  .marquee::after {
    bottom: 0;
  }
  .marquee-sprite {
    width: 28px;
    height: 28px;
  }
  .marquee-title {
    flex: 1;
    margin: 0;
    font-size: clamp(1.25rem, 3vw, 2.25rem);
    color: #fff;
    letter-spacing: 0.06em;
    /* Hard 8-direction outline in the game's own colour. Crisper on the pixel font than text-stroke. */
    --o: 3px;
    text-shadow:
      var(--o) 0 var(--theme), calc(-1 * var(--o)) 0 var(--theme),
      0 var(--o) var(--theme), 0 calc(-1 * var(--o)) var(--theme),
      var(--o) var(--o) var(--theme), calc(-1 * var(--o)) calc(-1 * var(--o)) var(--theme),
      var(--o) calc(-1 * var(--o)) var(--theme), calc(-1 * var(--o)) var(--o) var(--theme);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .marquee-credits {
    font-size: 0.8rem;
    color: #fbbf24;
    white-space: nowrap;
  }

  /* Screen */
  .bezel {
    min-height: 0;
    padding: 0.75rem;
    background: #0f0d14;
  }
  .screen {
    position: relative;
    height: 100%;
    background: #000;
    border: 6px solid #07060a;
    border-radius: 10px;
    box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.9), 0 0 0 1px #2a2438;
    overflow: hidden;
    transform-origin: center;
    will-change: transform;
    animation: crt-on 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  /* Only transforms and opacity animate in here. Filters or blend modes over a live
     iframe force full repaints every frame and made the open stutter. */
  @keyframes crt-on {
    0% { transform: scaleY(0.005) scaleX(0.6); }
    55% { transform: scaleY(1) scaleX(0.98); }
    100% { transform: none; }
  }
  .screen iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: #000;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .screen.booted iframe {
    opacity: 1;
  }
  .scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 3px);
  }
  /* Power-on surge: a white sheet that burns off. Plays on open and after a coin. */
  .glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: #fff;
    opacity: 0;
    animation: glow-off 0.6s ease-out both;
  }
  @keyframes glow-off {
    0% { opacity: 0.85; }
    100% { opacity: 0; }
  }

  /* Power off: the picture dies while a white burst flashes twice and collapses to a
     point in the middle of the tube, blooms once, and goes out. */
  .screen.off iframe,
  .screen.off .attract {
    animation: crt-die 0.7s ease-in both;
  }
  @keyframes crt-die {
    0% { opacity: 1; transform: none; }
    35% { opacity: 0.6; transform: scale(1.02, 0.85); }
    100% { opacity: 0; transform: scale(0.9, 0.3); }
  }
  .screen.off .glow {
    animation: none;
  }
  .screen.off::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 170%;
    aspect-ratio: 1;
    border-radius: 50%;
    z-index: 2;
    pointer-events: none;
    background: radial-gradient(circle, #fff 0 26%, rgba(255, 255, 255, 0.8) 42%, rgba(255, 255, 255, 0) 66%);
    animation: crt-burst 0.72s cubic-bezier(0.65, 0, 0.35, 1) both;
  }
  @keyframes crt-burst {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
    8% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
    14% { opacity: 0.7; }
    20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
    68% { opacity: 1; transform: translate(-50%, -50%) scale(0.04); }
    80% { opacity: 1; transform: translate(-50%, -50%) scale(0.1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.01); }
  }

  /* Power on after a coin: the normal flicker, then a magnetic wobble on both axes. */
  .screen.on {
    animation: crt-on 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .screen.on .glow {
    animation: glow-off 0.6s ease-out both;
  }
  .screen.on iframe,
  .screen.on .attract {
    animation: crt-wobble 1.2s ease-out 0.3s both;
  }
  @keyframes crt-wobble {
    0% { transform: translate(-10px, 6px) skew(-3deg, 1deg) scaleY(1.04); }
    10% { transform: translate(9px, -7px) skew(2.5deg, -1deg) scaleY(0.97); }
    20% { transform: translate(-7px, 5px) skew(-2deg, 0.8deg) scaleY(1.03); }
    30% { transform: translate(6px, -4px) skew(1.5deg, -0.6deg) scaleY(0.98); }
    45% { transform: translate(-4px, 3px) skew(-1deg, 0.4deg) scaleY(1.015); }
    60% { transform: translate(2px, -2px) skew(0.5deg, -0.2deg); }
    80% { transform: translate(-1px, 1px); }
    100% { transform: none; }
  }
  .static {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    animation: static-fade 1.2s steps(8) both;
  }
  @keyframes static-fade {
    0% { opacity: 0.5; background-position: 0 0; }
    50% { opacity: 0.22; background-position: 120px 80px; }
    100% { opacity: 0; background-position: 40px 200px; }
  }
  .attract {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 0.75rem;
    text-align: center;
    color: #fff;
    font-size: 1rem;
  }
  .attract .dim {
    font-size: 0.65rem;
  }
  .blink {
    animation: blink 1s steps(1) infinite;
    color: var(--accent);
    text-shadow: 0 0 10px var(--accent);
  }
  @keyframes blink {
    50% { opacity: 0; }
  }

  /* Control panel */
  .panel {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.85rem 1.25rem;
    background: linear-gradient(180deg, #2a2438, #1e1a28);
    border-top: 3px solid #0f0d14;
  }
  .buttons {
    display: flex;
    gap: 1.25rem;
    flex: 1;
  }
  .arcade-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: 0;
    padding: 0;
    color: #cfc8dd;
  }
  .cap {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 3px solid #0f0d14;
    box-shadow:
      inset 0 -6px 0 rgba(0, 0, 0, 0.35),
      inset 0 3px 0 rgba(255, 255, 255, 0.35),
      0 4px 0 #0f0d14,
      0 6px 12px rgba(0, 0, 0, 0.6);
    transition: transform 0.06s ease, box-shadow 0.06s ease;
  }
  .arcade-btn:hover .cap {
    filter: brightness(1.15);
  }
  .arcade-btn:active .cap {
    transform: translateY(4px);
    box-shadow:
      inset 0 -2px 0 rgba(0, 0, 0, 0.35),
      inset 0 3px 0 rgba(255, 255, 255, 0.35),
      0 0 0 #0f0d14,
      0 2px 6px rgba(0, 0, 0, 0.6);
  }
  .arcade-btn:focus-visible .cap {
    outline: 2px solid #fff;
    outline-offset: 3px;
  }
  .cap-yellow { background: radial-gradient(circle at 40% 35%, #fde68a, #f59e0b 60%, #b45309); }
  .cap-green { background: radial-gradient(circle at 40% 35%, #86efac, #22c55e 60%, #15803d); }
  .cap-red { background: radial-gradient(circle at 40% 35%, #fca5a5, #ef5350 60%, #991b1b); }
  .label {
    font-size: 0.6rem;
    white-space: nowrap;
  }

  .panel-links {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.2rem;
    font-size: 0.7rem;
  }
  .panel-links a {
    color: #8b83a3;
    text-decoration: none;
  }
  .panel-links a:hover {
    color: #fff;
  }

  /* Filled: cabinet takes the whole viewport, marquee and panel become bordered bars.
     Always on below 768px, toggled by FULL SCREEN above. */
  .arcade-backdrop:has(.fills) {
    padding: 0;
  }
  .cabinet.fills {
    width: 100%;
    height: 100dvh;
    border: 0;
    box-shadow: none;
  }
  .fills .marquee {
    padding: 0.9rem 0.9rem 0.8rem;
  }
  .fills .marquee::before {
    top: 0;
    transform: scaleY(-1);
  }
  .fills .bezel {
    padding: 0;
  }
  .fills .screen {
    border-width: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .fills .panel {
    position: relative;
    padding: 0.6rem 0.9rem calc(0.9rem + env(safe-area-inset-bottom));
  }
  .fills .panel::after {
    bottom: 0;
  }
  @media (max-width: 767px) {
    .marquee-sprite {
      width: 20px;
      height: 20px;
    }
    .marquee-credits {
      font-size: 0.65rem;
    }
    .buttons {
      justify-content: space-around;
      gap: 0.5rem;
    }
    .cap {
      width: 36px;
      height: 36px;
    }
    .label {
      font-size: 0.5rem;
    }
    .panel-links {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .screen, .screen iframe, .screen .attract, .screen::before, .glow, .static, .arcade-backdrop {
      animation: none;
    }
  }
</style>
