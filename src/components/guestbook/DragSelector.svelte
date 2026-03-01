<script lang="ts">
  import type { Snippet } from 'svelte';
  import { OccupancyMap } from './lib/occupancy';
  import { isDragging } from './lib/dragState';

  let {
    occupancyMap,
    gridCols = 9,
    gridRows = 16,
    onselect,
    interactive = true,
    children,
  }: {
    occupancyMap: OccupancyMap;
    gridCols?: number;
    gridRows?: number;
    onselect?: (detail: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }) => void;
    interactive?: boolean;
    children?: Snippet;
  } = $props();

  let overlayEl = $state<HTMLDivElement | undefined>(undefined);
  let isSelecting = $state(false);
  let startCell = $state<{ row: number; col: number } | null>(null);
  let currentCell = $state<{ row: number; col: number } | null>(null);
  let isValid = $state(false);
  let showFlash = $state(false);

  let selection = $derived(computeSelection(startCell, currentCell));

  $effect(() => {
    if (selection) {
      isValid = occupancyMap.isRegionFree(
        selection.rowStart,
        selection.rowEnd,
        selection.colStart,
        selection.colEnd
      ) && meetsMinimumSize(selection);
    }
  });

  // Cleanup window listeners on destroy
  $effect(() => {
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
    };
  });

  function meetsMinimumSize(sel: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }): boolean {
    return (sel.rowEnd - sel.rowStart) >= 2 && (sel.colEnd - sel.colStart) >= 2;
  }

  function computeSelection(start: { row: number; col: number } | null, current: { row: number; col: number } | null) {
    if (!start || !current) return null;
    return {
      rowStart: Math.min(start.row, current.row),
      rowEnd: Math.max(start.row, current.row) + 1,
      colStart: Math.min(start.col, current.col),
      colEnd: Math.max(start.col, current.col) + 1,
    };
  }

  function getCellFromPoint(clientX: number, clientY: number): { row: number; col: number } | null {
    if (!overlayEl) return null;
    const rect = overlayEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor((x / rect.width) * gridCols) + 1;
    const row = Math.floor((y / rect.height) * gridRows) + 1;
    if (col < 1 || col > gridCols || row < 1 || row > gridRows) return null;
    return { row, col };
  }

  function endDrag() {
    isSelecting = false;
    isDragging.set(false);
    startCell = null;
    currentCell = null;
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointercancel', handleWindowPointerCancel);
  }

  function handlePointerDown(e: PointerEvent) {
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Don't start selection on an occupied cell
    if (!occupancyMap.isRegionFree(cell.row, cell.row + 1, cell.col, cell.col + 1)) return;

    isSelecting = true;
    isDragging.set(true);
    startCell = cell;
    currentCell = cell;

    // Use window-level listeners so cursor isn't affected by pointer capture
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
  }

  function handleWindowPointerMove(e: PointerEvent) {
    if (!isSelecting) return;
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    currentCell = cell;
  }

  function handleWindowPointerUp(e: PointerEvent) {
    if (!isSelecting) return;

    if (selection && isValid) {
      onselect?.({
        rowStart: selection.rowStart,
        rowEnd: selection.rowEnd,
        colStart: selection.colStart,
        colEnd: selection.colEnd,
      });
    } else if (selection) {
      showFlash = true;
      setTimeout(() => {
        showFlash = false;
      }, 300);
    }

    endDrag();
  }

  function handleWindowPointerCancel() {
    if (!isSelecting) return;
    endDrag();
  }
</script>

<div
  class="drag-overlay"
  class:interactive
  data-drag-cursor
  bind:this={overlayEl}
  onpointerdown={interactive ? handlePointerDown : undefined}
  style="--grid-cols: {gridCols}; --grid-rows: {gridRows};"
>
  {@render children?.()}
  {#if selection}
    <div
      class="selection-highlight"
      class:valid={isValid}
      class:invalid={!isValid}
      class:flash={showFlash}
      style="
        grid-row: {selection.rowStart} / {selection.rowEnd};
        grid-column: {selection.colStart} / {selection.colEnd};
      "
    ></div>
  {/if}
</div>

<style>
  .drag-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(var(--grid-cols, 9), minmax(0, 1fr));
    grid-template-rows: repeat(var(--grid-rows, 16), minmax(0, 1fr));
    z-index: 10;
    pointer-events: none;
    touch-action: auto;
  }

  .drag-overlay.interactive {
    pointer-events: auto;
    touch-action: none;
  }

  .selection-highlight {
    border: 2px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    border-radius: 2px;
    pointer-events: none;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .selection-highlight.invalid {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }

  .selection-highlight.flash {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.2);
    animation: flash-red 0.3s ease-out;
  }

  @keyframes flash-red {
    0% { background: rgba(239, 68, 68, 0.3); }
    100% { background: rgba(239, 68, 68, 0); }
  }
</style>
