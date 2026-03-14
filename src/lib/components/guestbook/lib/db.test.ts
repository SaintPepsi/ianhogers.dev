import { describe, it, expect, beforeEach } from 'vitest';
import { clearMemoryStore, getNotesByPage, getAllNotes, insertNoteIfNoOverlap } from '$lib/components/guestbook/lib/db';

/**
 * Tests the in-memory fallback path used when DATABASE_URL is not configured
 * (staging deployments, local dev, preview branches).
 */
describe('guestbook db — in-memory fallback', () => {
	beforeEach(() => {
		clearMemoryStore();
	});

	it('returns empty array when no notes exist', async () => {
		const notes = await getNotesByPage(0);
		expect(notes).toEqual([]);
	});

	it('inserts a note and retrieves it by page', async () => {
		const note = await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 1,
			row_end: 3,
			col_start: 1,
			col_end: 4,
			text: 'Hello',
			author: 'Test',
			profanity_flags: []
		});

		expect(note).not.toBeNull();
		expect(note!.text).toBe('Hello');
		expect(note!.id).toBeTruthy();
		expect(note!.created_at).toBeTruthy();

		const retrieved = await getNotesByPage(0);
		expect(retrieved).toHaveLength(1);
		expect(retrieved[0].text).toBe('Hello');
	});

	it('rejects overlapping notes on same page', async () => {
		await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 1,
			row_end: 4,
			col_start: 1,
			col_end: 5,
			text: 'First',
			author: 'A',
			profanity_flags: []
		});

		const overlap = await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 2,
			row_end: 5,
			col_start: 3,
			col_end: 7,
			text: 'Second',
			author: 'B',
			profanity_flags: []
		});

		expect(overlap).toBeNull();
	});

	it('allows non-overlapping notes on same page', async () => {
		await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 1,
			row_end: 3,
			col_start: 1,
			col_end: 3,
			text: 'Top-left',
			author: 'A',
			profanity_flags: []
		});

		const noOverlap = await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 5,
			row_end: 7,
			col_start: 5,
			col_end: 8,
			text: 'Bottom-right',
			author: 'B',
			profanity_flags: []
		});

		expect(noOverlap).not.toBeNull();

		const all = await getAllNotes();
		expect(all).toHaveLength(2);
	});

	it('allows same bounds on different pages', async () => {
		await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 1,
			row_end: 3,
			col_start: 1,
			col_end: 3,
			text: 'Page 0',
			author: 'A',
			profanity_flags: []
		});

		const differentPage = await insertNoteIfNoOverlap({
			page_index: 1,
			row_start: 1,
			row_end: 3,
			col_start: 1,
			col_end: 3,
			text: 'Page 1',
			author: 'B',
			profanity_flags: []
		});

		expect(differentPage).not.toBeNull();
	});

	it('getAllNotes returns notes sorted by page_index then created_at', async () => {
		await insertNoteIfNoOverlap({
			page_index: 1,
			row_start: 1,
			row_end: 3,
			col_start: 1,
			col_end: 3,
			text: 'Page 1',
			author: 'A',
			profanity_flags: []
		});

		await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 1,
			row_end: 3,
			col_start: 1,
			col_end: 3,
			text: 'Page 0',
			author: 'B',
			profanity_flags: []
		});

		const all = await getAllNotes();
		expect(all[0].page_index).toBe(0);
		expect(all[1].page_index).toBe(1);
	});

	it('clearMemoryStore removes all notes', async () => {
		await insertNoteIfNoOverlap({
			page_index: 0,
			row_start: 1,
			row_end: 3,
			col_start: 1,
			col_end: 3,
			text: 'Will be cleared',
			author: 'A',
			profanity_flags: []
		});

		clearMemoryStore();
		const all = await getAllNotes();
		expect(all).toEqual([]);
	});
});
