<script lang="ts">
  import type { Game } from '$lib/data/games';
  import { openArcade } from '$lib/arcade.svelte';

  let { game }: { game: Game } = $props();

  const text: Record<Game['accent'], string> = {
    crimson: 'text-crimson group-hover:text-red-300',
    lavender: 'text-purple-300 group-hover:text-purple-200',
    amber: 'text-amber-400 group-hover:text-amber-300',
    maple: 'text-orange-400 group-hover:text-orange-300',
  };
  const tag: Record<Game['accent'], string> = {
    crimson: 'text-red-400/70 bg-red-500/10',
    lavender: 'text-purple-400/60 bg-purple-500/10',
    amber: 'text-amber-400/70 bg-amber-500/10',
    maple: 'text-orange-400/70 bg-orange-500/10',
  };
</script>

<article class="game-tile pixel-box pixel-box-{game.accent} glow-{game.accent} group relative">
  <button type="button" class="absolute inset-0 z-10 w-full h-full" onclick={() => openArcade(game)} aria-label="Play {game.title} in the arcade"></button>

  <div class="game-cover">
    <img src={game.cover} alt="" loading="lazy" decoding="async" />
    <span class="game-play-badge font-mono">&#9654; insert coin</span>
  </div>

  <div class="p-5 pt-4">
    <h3 class="font-display text-xl sm:text-2xl mb-2 transition-colors {text[game.accent]}">{game.title}</h3>
    <p class="text-sm text-gray-400 leading-relaxed mb-3">{game.blurb}</p>
    <div class="flex flex-wrap gap-2 mb-4">
      {#each game.tags as t}
        <span class="text-xs font-mono px-2 py-0.5 rounded {tag[game.accent]}">{t}</span>
      {/each}
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono relative z-20">
      <button type="button" onclick={() => openArcade(game)} class="hover:underline inline-flex items-center gap-1 bg-transparent border-0 p-0 font-mono {text[game.accent]}">
        insert coin
        <img src="/assets/pixel-art/ui/green_up_arrow_tiny.png" alt="" class="pixel-sprite w-3 h-3 rotate-90" />
      </button>
      <a href={game.play} target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 no-underline">new tab</a>
      {#if game.source}
        <a href={game.source} target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 no-underline">source</a>
      {/if}
      {#if game.hint}
        <span class="text-gray-600">{game.hint}</span>
      {/if}
    </div>
  </div>
</article>

<style>
  .game-tile {
    flex: 0 0 min(32rem, 86vw);
    scroll-snap-align: start;
    padding: 3px; /* pixel-box border thickness; the cover sits inside it */
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .game-tile:hover {
    transform: translateY(-4px);
  }
  .game-cover {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: #000;
  }
  .game-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: transform 0.4s ease;
  }
  .game-tile:hover .game-cover img {
    transform: scale(1.03);
  }
  .game-cover::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 55%, #1e1a28 100%);
    pointer-events: none;
  }
  .game-play-badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 0.25rem 0.6rem;
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .game-tile:hover .game-play-badge {
    opacity: 1;
    transform: translateY(0);
  }
</style>
