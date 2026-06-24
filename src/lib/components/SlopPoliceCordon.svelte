<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { TapeCordon, type TapeCordonOptions } from 'slop-tape';

  // Overlays its (relative) parent — drop inside a `position: relative` container.
  // `seed` defaults to the route; pass a fixed seed (e.g. on the home teaser) to
  // give a section its own stable, independent layout.
  let {
    seed,
    minTapes,
    maxTapes,
    clipVertical,
  }: { seed?: string; minTapes?: number; maxTapes?: number; clipVertical?: boolean } = $props();

  let host = $state<HTMLDivElement>();
  let cordon: TapeCordon | null = null;

  onMount(() => {
    if (!host) return;
    const opts: TapeCordonOptions = {
      seed: seed ?? page.url.pathname, // stable per route, query params stripped
      zIndex: 30,
      colors: { scrim: 'rgba(13,10,18,0.6)' },
    };
    if (minTapes !== undefined) opts.minTapes = minTapes;
    if (maxTapes !== undefined) opts.maxTapes = maxTapes;
    if (clipVertical !== undefined) opts.clipVertical = clipVertical;
    cordon = new TapeCordon(host, opts);
    cordon.mount();
    return () => {
      cordon?.destroy();
      cordon = null;
    };
  });

  // Re-lay on navigation only when seeding from the route (fixed seeds stay put).
  $effect(() => {
    const path = page.url.pathname;
    if (seed === undefined) cordon?.setSeed(path);
  });
</script>

<div bind:this={host} class="slop-cordon-host" aria-hidden="true"></div>

<style>
  .slop-cordon-host {
    position: absolute;
    inset: 0;
    pointer-events: none; /* the cordon's own layer re-enables hit-testing on the tape */
    z-index: 30;
  }
</style>
