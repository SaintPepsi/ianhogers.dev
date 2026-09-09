<script lang="ts">
  import { arcade, closeArcade } from '$lib/arcade.svelte';

  let session = $state(0);
  let credits = $state(1);
  let loaded = $state(false);
  let cabinet: HTMLElement | undefined = $state();
  let frame: HTMLIFrameElement | undefined = $state();
  let isFullscreen = $state(false);
  let canFullscreen = $state(false);

  const game = $derived(arcade.game);

  const accent: Record<string, string> = {
    crimson: '#ef5350',
    lavender: '#b388ff',
    amber: '#f59e0b',
    maple: '#fb923c',
  };

  // Reset per-session bits whenever a (different) game is opened, and lock page scroll.
  $effect(() => {
    if (!game) return;
    session = 0;
    credits = 1;
    loaded = false;
    canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  });

  function insertCoin() {
    credits += 1;
    loaded = false;
    session += 1;
  }

  function leave() {
    closeArcade();
  }

  async function toggleFullscreen() {
    if (!cabinet) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await cabinet.requestFullscreen();
    } catch {
      /* browser said no, nothing to do */
    }
  }

  function onFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
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

<svelte:window onkeydown={onKey} onfullscreenchange={onFullscreenChange} />

{#if game}
  <div class="arcade-backdrop" role="dialog" aria-modal="true" aria-label="{game.title} arcade cabinet">
    <div class="cabinet" style="--accent: {accent[game.accent]}" bind:this={cabinet}>
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
        <div class="screen" class:booted={loaded}>
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
        </div>
      </div>

      <!-- Control panel -->
      <footer class="panel">
        <div class="joystick" aria-hidden="true">
          <span class="stick"></span>
          <span class="ball"></span>
        </div>

        <div class="buttons">
          <button type="button" class="arcade-btn" onclick={insertCoin}>
            <span class="cap cap-yellow"></span>
            <span class="label font-pixel">INSERT COIN</span>
          </button>
          {#if canFullscreen}
            <button type="button" class="arcade-btn" onclick={toggleFullscreen}>
              <span class="cap cap-green"></span>
              <span class="label font-pixel">{isFullscreen ? 'WINDOW' : 'FULL SCREEN'}</span>
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
      0 0 40px color-mix(in srgb, var(--accent) 35%, transparent),
      0 40px 80px -20px rgba(0, 0, 0, 0.9);
    image-rendering: pixelated;
  }
  .cabinet:fullscreen {
    width: 100%;
    height: 100%;
    border: none;
    box-shadow: none;
  }

  /* Marquee */
  .marquee {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.25rem;
    background:
      repeating-linear-gradient(90deg, transparent 0 6px, rgba(0, 0, 0, 0.25) 6px 7px),
      linear-gradient(180deg, #2a2438, #171320);
    border-bottom: 3px solid #0f0d14;
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
    text-shadow:
      0 0 6px var(--accent),
      0 0 18px var(--accent),
      0 0 36px color-mix(in srgb, var(--accent) 60%, transparent);
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
    animation: crt-on 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @keyframes crt-on {
    0% { transform: scaleY(0.005) scaleX(0.6); filter: brightness(4); }
    55% { transform: scaleY(1) scaleX(0.98); filter: brightness(1.6); }
    100% { transform: none; filter: none; }
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
    background: repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 3px);
    mix-blend-mode: overlay;
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
  .joystick {
    position: relative;
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 50%, #0f0d14 0 30%, #2a2438 31% 100%);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.8);
  }
  .stick {
    position: absolute;
    left: 50%;
    bottom: 50%;
    width: 6px;
    height: 26px;
    margin-left: -3px;
    background: linear-gradient(90deg, #3a3448, #6b6480, #3a3448);
    transform: rotate(-12deg);
    transform-origin: bottom center;
    animation: wiggle 3s ease-in-out infinite;
  }
  .ball {
    position: absolute;
    left: 50%;
    top: -12px;
    width: 22px;
    height: 22px;
    margin-left: -11px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ff8a80, #ef5350 55%, #8a1f1d);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
    animation: wiggle-ball 3s ease-in-out infinite;
  }
  @keyframes wiggle {
    0%, 100% { transform: rotate(-12deg); }
    50% { transform: rotate(12deg); }
  }
  @keyframes wiggle-ball {
    0%, 100% { transform: translateX(-5px); }
    50% { transform: translateX(5px); }
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

  /* Mobile: cabinet fills the screen, marquee and panel become bordered bars. */
  @media (max-width: 767px) {
    .arcade-backdrop {
      padding: 0;
    }
    .cabinet {
      width: 100%;
      height: 100dvh;
      border: 0;
      box-shadow: none;
    }
    .marquee {
      padding: 0.6rem 0.9rem;
      border-top: 4px solid var(--accent);
      border-image: repeating-linear-gradient(90deg, var(--accent) 0 6px, transparent 6px 12px) 4;
      border-bottom: 3px solid #0f0d14;
    }
    .marquee-sprite {
      width: 20px;
      height: 20px;
    }
    .marquee-credits {
      font-size: 0.65rem;
    }
    .bezel {
      padding: 0;
    }
    .screen {
      border-width: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .panel {
      gap: 0.75rem;
      padding: 0.6rem 0.9rem calc(0.6rem + env(safe-area-inset-bottom));
      border-bottom: 4px solid var(--accent);
      border-image: repeating-linear-gradient(90deg, var(--accent) 0 6px, transparent 6px 12px) 4;
    }
    .joystick {
      display: none;
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
    .screen, .stick, .ball, .arcade-backdrop {
      animation: none;
    }
  }
</style>
