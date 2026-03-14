import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import {
	getNotesByPage,
	getAllNotes,
	insertNoteIfNoOverlap,
	clearMemoryStore
} from '$lib/components/guestbook/lib/db';
import { detectProfanity } from '$lib/components/guestbook/lib/profanity';
import { shrinkBounds } from '$lib/components/guestbook/lib/shrinkBounds';
import stickerManifest from '$lib/data/sticker-manifest.json';

/** Lazily get KV client — returns null if @vercel/kv is not configured */
async function getKv() {
	const mod = await import('@vercel/kv').catch(() => null);
	return mod?.kv ?? null;
}

/** Read KV cooldown for an IP, returning null if KV is unavailable or key doesn't exist. */
async function getCooldown(key: string): Promise<unknown | null> {
	const kvClient = await getKv();
	if (!kvClient) return null;
	const result = await kvClient.get(key).catch(() => null);
	return result ?? null;
}

/** Set KV cooldown for an IP. Silently no-ops if KV is unavailable. */
async function setCooldown(key: string, value: number, ttlSeconds: number): Promise<void> {
	const kvClient = await getKv();
	if (!kvClient) return;
	await kvClient.set(key, value, { ex: ttlSeconds }).catch(() => {});
}

function validateText(text: unknown): string | null {
	if (typeof text !== 'string' || text.length < 1 || text.length > 280) {
		return 'Text must be between 1 and 280 characters';
	}
	return null;
}

function validateAuthor(author: unknown): string | null {
	if (typeof author !== 'string' || author.length < 1 || author.length > 100) {
		return 'Author must be between 1 and 100 characters';
	}
	return null;
}

function validateColumnBounds(colStart: unknown, colEnd: unknown): string | null {
	if (
		typeof colStart !== 'number' ||
		typeof colEnd !== 'number' ||
		!Number.isInteger(colStart) ||
		!Number.isInteger(colEnd) ||
		colStart < 1 ||
		colEnd > 10 ||
		colEnd <= colStart
	) {
		return 'Invalid column bounds (integers 1-10, end > start)';
	}
	return null;
}

function validateRowBounds(rowStart: unknown, rowEnd: unknown): string | null {
	if (
		typeof rowStart !== 'number' ||
		typeof rowEnd !== 'number' ||
		!Number.isInteger(rowStart) ||
		!Number.isInteger(rowEnd) ||
		rowStart < 1 ||
		rowEnd > 17 ||
		rowEnd <= rowStart
	) {
		return 'Invalid row bounds (integers 1-17, end > start)';
	}
	return null;
}

function validatePageIndex(pageIndex: unknown): string | null {
	if (typeof pageIndex !== 'number' || !Number.isInteger(pageIndex) || pageIndex < 0) {
		return 'page_index must be a non-negative integer';
	}
	return null;
}

export const GET: RequestHandler = async ({ url }) => {
	const page = url.searchParams.get('page');

	const notes =
		page !== null ? await getNotesByPage(parseInt(page, 10)) : await getAllNotes();

	return json(notes);
};

export const DELETE: RequestHandler = async () => {
	if (!dev) {
		return json({ error: 'Not allowed in production' }, { status: 403 });
	}
	clearMemoryStore();
	return json({ cleared: true });
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// 1. Check IP cooldown (skip when KV not configured, e.g. local dev)
	// Prefer Vercel's platform-set header (not spoofable), fall back to clientAddress
	const ip =
		request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
		getClientAddress();
	const cooldownKey = `guestbook:cooldown:${ip}`;

	const cooldown = await getCooldown(cooldownKey);
	if (cooldown) {
		return json(
			{
				error:
					'Thank you for writing in my guest book, come back again later to write more!'
			},
			{ status: 429 }
		);
	}

	// 2. Parse and validate body
	const body = await request.json();
	const { text, author, page_index, row_start, row_end, col_start, col_end } = body;

	const textError = validateText(text);
	if (textError) return json({ error: textError }, { status: 400 });

	const authorError = validateAuthor(author);
	if (authorError) return json({ error: authorError }, { status: 400 });

	const colError = validateColumnBounds(col_start, col_end);
	if (colError) return json({ error: colError }, { status: 400 });

	const rowError = validateRowBounds(row_start, row_end);
	if (rowError) return json({ error: rowError }, { status: 400 });

	const pageError = validatePageIndex(page_index);
	if (pageError) return json({ error: pageError }, { status: 400 });

	// 3. Shrink bounds to minimum area that fits the text
	const shrunk = shrinkBounds(text, author, {
		row_start,
		row_end,
		col_start,
		col_end
	});

	// 4. Detect profanity using sticker manifest pool
	const stickerIds = stickerManifest.stickers.map((s) => s.id);
	const profanityFlags = detectProfanity(text, stickerIds);

	// 5. Atomic overlap check + insert (prevents TOCTOU race)
	const note = await insertNoteIfNoOverlap({
		page_index,
		row_start: shrunk.row_start,
		row_end: shrunk.row_end,
		col_start: shrunk.col_start,
		col_end: shrunk.col_end,
		text,
		author,
		profanity_flags: profanityFlags
	});

	if (!note) {
		return json({ error: 'This area overlaps with an existing note' }, { status: 409 });
	}

	// 6. Set cooldown (5 minutes) — silently no-ops when KV not configured
	await setCooldown(cooldownKey, Date.now(), 300);

	return json(note, { status: 201 });
};
