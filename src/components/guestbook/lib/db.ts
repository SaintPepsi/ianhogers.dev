import { neon } from "@neondatabase/serverless";
import type { GuestbookNote } from "./types";

export function getDb() {
  const url = import.meta.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export async function getNotesByPage(
  pageIndex: number,
): Promise<GuestbookNote[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql`
    SELECT * FROM guestbook_notes
    WHERE page_index = ${pageIndex}
    ORDER BY created_at
  `;
  return rows as unknown as GuestbookNote[];
}

export async function getAllNotes(): Promise<GuestbookNote[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql`
    SELECT * FROM guestbook_notes
    ORDER BY page_index, created_at
  `;
  return rows as unknown as GuestbookNote[];
}

export async function insertNote(
  note: Omit<GuestbookNote, "id" | "created_at">,
): Promise<GuestbookNote> {
  const sql = getDb();
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    INSERT INTO guestbook_notes (
      page_index, row_start, row_end, col_start, col_end,
      text, author, profanity_flags
    ) VALUES (
      ${note.page_index}, ${note.row_start}, ${note.row_end},
      ${note.col_start}, ${note.col_end},
      ${note.text}, ${note.author},
      ${JSON.stringify(note.profanity_flags)}
    )
    RETURNING *
  `;
  return rows[0] as unknown as GuestbookNote;
}

export async function checkOverlap(
  pageIndex: number,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  const rows = await sql`
    SELECT 1 FROM guestbook_notes
    WHERE page_index = ${pageIndex}
      AND row_start < ${rowEnd}
      AND row_end > ${rowStart}
      AND col_start < ${colEnd}
      AND col_end > ${colStart}
    LIMIT 1
  `;
  return rows.length > 0;
}
