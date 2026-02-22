<script lang="ts">
  import type { GuestbookNote } from './lib/types';

  export let pageIndex: number;
  export let notes: GuestbookNote[] = [];
  export let isWritable: boolean = true;
  export let gridConfig: { cols: number; rows: number } = { cols: 9, rows: 16 };
</script>

<div
  class="page pixel-sprite"
  style="--grid-cols: {gridConfig.cols}; --grid-rows: {gridConfig.rows};"
>
  <slot />

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
    overflow: hidden;
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
