<script lang="ts">
  import type { GuestbookNote, ProfanityFlag } from './lib/types';
  import StickerOverlay from './StickerOverlay.svelte';

  export let notes: GuestbookNote[] = [];
  export let pageIndex: number;

  interface TextSegment {
    text: string;
    flagged: boolean;
    flag: ProfanityFlag | null;
  }

  function splitByFlags(text: string, flags: ProfanityFlag[]): TextSegment[] {
    if (!flags || flags.length === 0) {
      return [{ text, flagged: false, flag: null }];
    }

    const sorted = [...flags].sort((a, b) => a.charStart - b.charStart);
    const segments: TextSegment[] = [];
    let cursor = 0;

    for (const flag of sorted) {
      if (flag.charStart > cursor) {
        segments.push({
          text: text.slice(cursor, flag.charStart),
          flagged: false,
          flag: null,
        });
      }
      segments.push({
        text: text.slice(flag.charStart, flag.charEnd),
        flagged: true,
        flag,
      });
      cursor = flag.charEnd;
    }

    if (cursor < text.length) {
      segments.push({
        text: text.slice(cursor),
        flagged: false,
        flag: null,
      });
    }

    return segments;
  }

  function computeFontSize(rowSpan: number): string {
    // Scale font based on how many rows the note occupies
    const base = Math.max(0.6, Math.min(1.2, rowSpan * 0.25));
    return `${base}rem`;
  }
</script>

{#each notes as note (note.id)}
  {@const rowSpan = note.row_end - note.row_start}
  {@const gridArea = `${note.row_start} / ${note.col_start} / ${note.row_end} / ${note.col_end}`}
  {@const segments = splitByFlags(note.text, note.profanity_flags)}
  <div
    class="note"
    style="
      grid-row: {note.row_start} / {note.row_end};
      grid-column: {note.col_start} / {note.col_end};
      font-size: {computeFontSize(rowSpan)};
    "
  >
    <div class="note-content">
      {#each segments as segment}
        {#if segment.flagged && segment.flag}
          <StickerOverlay
            flag={segment.flag}
            {pageIndex}
            gridArea={gridArea}
          >
            {segment.text}
          </StickerOverlay>
        {:else}
          <span>{segment.text}</span>
        {/if}
      {/each}
    </div>
    <div class="note-author">- {note.author}</div>
  </div>
{/each}

<style>
  .note {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px 6px;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;
  }

  .note-content {
    font-family: 'Grand9KPixel', monospace;
    color: #333;
    text-align: center;
    line-height: 1.4;
    word-break: break-word;
    overflow-wrap: break-word;
    image-rendering: pixelated;
  }

  .note-author {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.6em;
    color: hsl(45.71deg 69.23% 30%);
    margin-top: 2px;
    text-align: right;
    align-self: flex-end;
    image-rendering: pixelated;
  }
</style>
