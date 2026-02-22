<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { OccupancyMap } from './lib/occupancy';

  export let occupancyMap: OccupancyMap;
  export let gridCols: number = 9;
  export let gridRows: number = 16;

  const dispatch = createEventDispatcher();

  let isSelecting = false;
  let startCell: { row: number; col: number } | null = null;
  let currentCell: { row: number; col: number } | null = null;
  let isValid = false;
  let showFlash = false;

  $: selection = computeSelection(startCell, currentCell);
  $: if (selection) {
    isValid = occupancyMap.isRegionFree(
      selection.rowStart,
      selection.rowEnd,
      selection.colStart,
      selection.colEnd
    ) && meetsMinimumSize(selection);
  }

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

  function getCellFromEvent(e: PointerEvent): { row: number; col: number } | null {
    const target = e.currentTarget as HTMLElement;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor((x / rect.width) * gridCols) + 1;
    const row = Math.floor((y / rect.height) * gridRows) + 1;
    if (col < 1 || col > gridCols || row < 1 || row > gridRows) return null;
    return { row, col };
  }

  function handlePointerDown(e: PointerEvent) {
    const cell = getCellFromEvent(e);
    if (!cell) return;

    // Don't start selection on an occupied cell
    if (!occupancyMap.isRegionFree(cell.row, cell.row + 1, cell.col, cell.col + 1)) return;

    isSelecting = true;
    startCell = cell;
    currentCell = cell;
    (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isSelecting) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    currentCell = cell;
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isSelecting) return;
    isSelecting = false;

    if (selection && isValid) {
      dispatch('select', {
        rowStart: selection.rowStart,
        rowEnd: selection.rowEnd,
        colStart: selection.colStart,
        colEnd: selection.colEnd,
      });
    } else if (selection) {
      // Flash red on invalid
      showFlash = true;
      setTimeout(() => {
        showFlash = false;
      }, 300);
    }

    startCell = null;
    currentCell = null;
  }
</script>

<div
  class="drag-overlay"
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
  style="--grid-cols: {gridCols}; --grid-rows: {gridRows};"
>
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
    cursor: crosshair;
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
