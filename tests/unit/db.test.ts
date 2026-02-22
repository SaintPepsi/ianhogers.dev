import { describe, test, expect, beforeEach } from 'bun:test';
import { insertNoteIfNoOverlap, clearMemoryStore } from '../../src/components/guestbook/lib/db';

const baseNote = {
  page_index: 0,
  text: 'Hello',
  author: 'Tester',
  profanity_flags: [],
};

beforeEach(() => {
  clearMemoryStore();
});

describe('insertNoteIfNoOverlap', () => {
  test('inserts a note into empty store', async () => {
    const note = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 3,
      col_start: 1, col_end: 3,
    });

    expect(note).not.toBeNull();
    expect(note!.id).toBeDefined();
    expect(note!.created_at).toBeDefined();
    expect(note!.row_start).toBe(1);
    expect(note!.col_end).toBe(3);
  });

  test('rejects overlapping note on same page', async () => {
    const first = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 4,
      col_start: 1, col_end: 4,
    });
    expect(first).not.toBeNull();

    // Fully contained overlap
    const second = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 2, row_end: 3,
      col_start: 2, col_end: 3,
    });
    expect(second).toBeNull();
  });

  test('rejects partial overlap (corner touching)', async () => {
    await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 4,
      col_start: 1, col_end: 4,
    });

    // Overlaps at bottom-right corner of first note
    const overlap = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 3, row_end: 6,
      col_start: 3, col_end: 6,
    });
    expect(overlap).toBeNull();
  });

  test('allows adjacent notes (touching edges, no overlap)', async () => {
    const first = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 3,
      col_start: 1, col_end: 3,
    });
    expect(first).not.toBeNull();

    // Starts exactly where first ends (row_end exclusive)
    const adjacent = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 3, row_end: 5,
      col_start: 1, col_end: 3,
    });
    expect(adjacent).not.toBeNull();
  });

  test('allows adjacent notes (touching columns)', async () => {
    const first = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 3,
      col_start: 1, col_end: 4,
    });
    expect(first).not.toBeNull();

    // Starts at col 4 where first ends
    const adjacent = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 3,
      col_start: 4, col_end: 7,
    });
    expect(adjacent).not.toBeNull();
  });

  test('allows same area on different pages', async () => {
    const page0 = await insertNoteIfNoOverlap({
      ...baseNote,
      page_index: 0,
      row_start: 1, row_end: 4,
      col_start: 1, col_end: 4,
    });
    expect(page0).not.toBeNull();

    const page1 = await insertNoteIfNoOverlap({
      ...baseNote,
      page_index: 1,
      row_start: 1, row_end: 4,
      col_start: 1, col_end: 4,
    });
    expect(page1).not.toBeNull();
  });

  test('allows non-overlapping notes on same page', async () => {
    const topLeft = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 3,
      col_start: 1, col_end: 3,
    });
    expect(topLeft).not.toBeNull();

    const bottomRight = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 5, row_end: 8,
      col_start: 5, col_end: 8,
    });
    expect(bottomRight).not.toBeNull();
  });

  test('returns note with correct fields on success', async () => {
    const note = await insertNoteIfNoOverlap({
      ...baseNote,
      row_start: 1, row_end: 3,
      col_start: 1, col_end: 3,
    });

    expect(note).not.toBeNull();
    expect(note!.text).toBe('Hello');
    expect(note!.author).toBe('Tester');
    expect(note!.page_index).toBe(0);
    expect(note!.profanity_flags).toEqual([]);
    expect(typeof note!.id).toBe('string');
    expect(note!.id.length).toBeGreaterThan(0);
  });
});
