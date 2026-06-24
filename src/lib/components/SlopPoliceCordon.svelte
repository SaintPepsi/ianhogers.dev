<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { TapeCordon } from 'slop-tape';

  // Overlays its (relative) parent — drop inside a `position: relative` container.
  let host = $state<HTMLDivElement>();
  let cordon: TapeCordon | null = null;

  onMount(() => {
    if (!host) return;
    cordon = new TapeCordon(host, {
      seed: page.url.pathname, // stable per post, query params stripped
      zIndex: 30,
      colors: { scrim: 'rgba(13,10,18,0.6)' },
    });
    cordon.mount();
    return () => {
      cordon?.destroy();
      cordon = null;
    };
  });

  // Re-lay the cordon when navigating between Maple pages.
  $effect(() => {
    const path = page.url.pathname;
    cordon?.setSeed(path);
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
