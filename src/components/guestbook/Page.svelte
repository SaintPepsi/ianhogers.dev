<script lang="ts">
  import type { GuestbookNote } from './lib/types';
  import type { Snippet } from 'svelte';

  let {
    pageIndex,
    notes = [],
    isWritable = true,
    gridConfig = { cols: 9, rows: 16 },
    children,
  }: {
    pageIndex: number;
    notes?: GuestbookNote[];
    isWritable?: boolean;
    gridConfig?: { cols: number; rows: number };
    children?: Snippet;
  } = $props();
</script>

<div
  class="page pixel-sprite"
  style="--grid-cols: {gridConfig.cols}; --grid-rows: {gridConfig.rows};"
>
  {@render children?.()}

  <!-- Page number -->
  <div class="page-number" style="grid-column: 1 / -1; grid-row: {gridConfig.rows} / {gridConfig.rows + 1};">
    {pageIndex + 1}
  </div>
</div>

<style>
  .page {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--grid-cols, 9), minmax(0, 1fr));
    grid-template-rows: repeat(var(--grid-rows, 16), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    background: transparent;
    user-select: none;
  }

  .page-number {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: 0.5rem;
    color: hsl(45.71deg 69.23% 30%);
    padding-bottom: 4px;
    pointer-events: none;
    z-index: 1;
    font-family: 'Grand9KPixel', monospace;
    image-rendering: pixelated;
  }
</style>
