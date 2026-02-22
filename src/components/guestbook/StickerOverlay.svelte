<script lang="ts">
  import { onMount } from 'svelte';
  import { createPRNG, hashString } from './lib/prng';
  import type { ProfanityFlag } from './lib/types';

  export let flag: ProfanityFlag;
  export let pageIndex: number;
  export let gridArea: string;

  interface StickerPlacement {
    src: string;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
    zIndex: number;
  }

  let wrapperEl: HTMLSpanElement;
  let placements: StickerPlacement[] = [];

  const AVG_STICKER_WIDTH = 14;

  onMount(() => {
    if (!wrapperEl || flag.stickerPool.length === 0) return;

    const rect = wrapperEl.getBoundingClientRect();
    const spanWidth = rect.width;
    const stickerCount = Math.ceil(spanWidth / AVG_STICKER_WIDTH);
    const seed = hashString(`${pageIndex}:${gridArea}:${flag.word}`);
    const prng = createPRNG(seed);

    const result: StickerPlacement[] = [];

    // Usable region: 8% to 92% of span width
    const startX = spanWidth * 0.08;
    const endX = spanWidth * 0.92;
    const usableWidth = endX - startX;

    for (let i = 0; i < stickerCount; i++) {
      const poolIndex = prng.nextInt(flag.stickerPool.length);
      const stickerId = flag.stickerPool[poolIndex];
      const src = `/assets/stickers/${stickerId}.png`;

      // Use AVG_STICKER_WIDTH as the sticker render width, scale height proportionally
      const stickerWidth = AVG_STICKER_WIDTH;
      const stickerHeight = AVG_STICKER_WIDTH;

      // Position stickers across the usable region
      let x: number;
      if (stickerCount === 1) {
        x = startX + usableWidth / 2 - stickerWidth / 2;
      } else {
        // First sticker at startX, each subsequent offset by stickerWidth * 0.7
        x = startX + i * (stickerWidth * 0.7);
        // Clamp so last sticker doesn't exceed endX
        if (x + stickerWidth > endX) {
          x = endX - stickerWidth;
        }
      }

      const yJitter = prng.nextFloat(-4, 4);
      const rotation = prng.nextFloat(-12, 12);

      result.push({
        src,
        x,
        y: yJitter,
        rotation,
        width: stickerWidth,
        height: stickerHeight,
        zIndex: i + 1,
      });
    }

    placements = result;
  });
</script>

<span class="sticker-overlay" bind:this={wrapperEl}>
  <span class="sticker-text"><slot /></span>
  {#each placements as sticker}
    <img
      class="sticker-img pixel-sprite"
      src={sticker.src}
      alt=""
      aria-hidden="true"
      style="
        left: {sticker.x}px;
        top: 50%;
        transform: translate(0, -50%) translateY({sticker.y}px) rotate({sticker.rotation}deg);
        width: {sticker.width}px;
        height: {sticker.height}px;
        z-index: {sticker.zIndex};
      "
    />
  {/each}
</span>

<style>
  .sticker-overlay {
    position: relative;
    display: inline;
  }

  .sticker-text {
    position: relative;
    z-index: 0;
  }

  .sticker-img {
    position: absolute;
    pointer-events: none;
    user-select: none;
  }
</style>
