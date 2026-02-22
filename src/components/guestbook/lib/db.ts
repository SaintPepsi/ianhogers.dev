import { neon } from "@neondatabase/serverless";
import type { GuestbookNote } from "./types";

// In-memory store for local dev (no DATABASE_URL)
const memoryStore: GuestbookNote[] = [];

/** Clear all in-memory notes (for test cleanup) */
export function clearMemoryStore(): void {
  memoryStore.length = 0;
}

export function getDb() {
  const url = import.meta.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export async function getNotesByPage(
  pageIndex: number,
): Promise<GuestbookNote[]> {
  const sql = getDb();
  if (!sql) {
    return memoryStore
      .filter((n) => n.page_index === pageIndex)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const rows = await sql`
    SELECT * FROM guestbook_notes
    WHERE page_index = ${pageIndex}
    ORDER BY created_at
  `;
  return rows as unknown as GuestbookNote[];
}

export async function getAllNotes(): Promise<GuestbookNote[]> {
  const sql = getDb();
  if (!sql) {
    return [...memoryStore].sort(
      (a, b) => a.page_index - b.page_index || a.created_at.localeCompare(b.created_at),
    );
  }
  const rows = await sql`
    SELECT * FROM guestbook_notes
    ORDER BY page_index, created_at
  `;
  return rows as unknown as GuestbookNote[];
}

/**
 * Atomically check for overlap and insert a note.
 * Returns the new note on success, or null if the area overlaps an existing note.
 *
 * Uses INSERT ... WHERE NOT EXISTS on Postgres for atomic TOCTOU-safe insertion.
 * In-memory path is single-threaded so check+insert is inherently atomic.
 */
export async function insertNoteIfNoOverlap(
  note: Omit<GuestbookNote, "id" | "created_at">,
): Promise<GuestbookNote | null> {
  const sql = getDb();
  if (!sql) {
    const overlapping = memoryStore.some(
      (n) =>
        n.page_index === note.page_index &&
        n.row_start < note.row_end &&
        n.row_end > note.row_start &&
        n.col_start < note.col_end &&
        n.col_end > note.col_start,
    );
    if (overlapping) return null;

    const newNote: GuestbookNote = {
      ...note,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    memoryStore.push(newNote);
    return newNote;
  }

  // Atomic: INSERT only if no overlapping note exists
  const rows = await sql`
    INSERT INTO guestbook_notes (
      page_index, row_start, row_end, col_start, col_end,
      text, author, profanity_flags
    )
    SELECT
      ${note.page_index}, ${note.row_start}, ${note.row_end},
      ${note.col_start}, ${note.col_end},
      ${note.text}, ${note.author},
      ${JSON.stringify(note.profanity_flags)}
    WHERE NOT EXISTS (
      SELECT 1 FROM guestbook_notes
      WHERE page_index = ${note.page_index}
        AND row_start < ${note.row_end}
        AND row_end > ${note.row_start}
        AND col_start < ${note.col_end}
        AND col_end > ${note.col_start}
    )
    RETURNING *
  `;
  return rows.length > 0 ? (rows[0] as unknown as GuestbookNote) : null;
}
