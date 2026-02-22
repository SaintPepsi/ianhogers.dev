export const prerender = false;

import type { APIRoute } from "astro";
import { kv } from "@vercel/kv";
import { getNotesByPage, getAllNotes, insertNoteIfNoOverlap, clearMemoryStore } from "../../../components/guestbook/lib/db";
import { detectProfanity } from "../../../components/guestbook/lib/profanity";
import { shrinkBounds } from "../../../components/guestbook/lib/shrinkBounds";
import type { StickerManifest } from "../../../components/guestbook/lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const GET: APIRoute = async ({ url }) => {
  const page = url.searchParams.get("page");

  try {
    const notes = page !== null
      ? await getNotesByPage(parseInt(page, 10))
      : await getAllNotes();

    return new Response(JSON.stringify(notes), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch guestbook notes:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch notes" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async () => {
  if (import.meta.env.PROD) {
    return new Response(JSON.stringify({ error: "Not allowed in production" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  clearMemoryStore();
  return new Response(JSON.stringify({ cleared: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // 1. Check IP cooldown (skip when KV not configured, e.g. local dev)
    // Prefer Vercel's platform-set header (not spoofable), fall back to clientAddress
    const ip =
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      clientAddress;
    const cooldownKey = `guestbook:cooldown:${ip}`;

    try {
      const cooldown = await kv.get(cooldownKey);
      if (cooldown) {
        return new Response(
          JSON.stringify({
            error:
              "Thank you for writing in my guest book, come back again later to write more!",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    } catch {
      // KV not available (local dev) — skip cooldown
    }

    // 2. Parse and validate body
    const body = await request.json();
    const { text, author, page_index, row_start, row_end, col_start, col_end } =
      body;

    if (
      typeof text !== "string" ||
      text.length < 1 ||
      text.length > 280
    ) {
      return new Response(
        JSON.stringify({ error: "Text must be between 1 and 280 characters" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      typeof author !== "string" ||
      author.length < 1 ||
      author.length > 100
    ) {
      return new Response(
        JSON.stringify({
          error: "Author must be between 1 and 100 characters",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      typeof col_start !== "number" ||
      typeof col_end !== "number" ||
      !Number.isInteger(col_start) ||
      !Number.isInteger(col_end) ||
      col_start < 1 ||
      col_end > 10 ||
      col_end <= col_start
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid column bounds (integers 1-10, end > start)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      typeof row_start !== "number" ||
      typeof row_end !== "number" ||
      !Number.isInteger(row_start) ||
      !Number.isInteger(row_end) ||
      row_start < 1 ||
      row_end > 17 ||
      row_end <= row_start
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid row bounds (integers 1-17, end > start)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      typeof page_index !== "number" ||
      !Number.isInteger(page_index) ||
      page_index < 0
    ) {
      return new Response(
        JSON.stringify({ error: "page_index must be a non-negative integer" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Shrink bounds to minimum area that fits the text
    const shrunk = shrinkBounds(text, author, {
      row_start,
      row_end,
      col_start,
      col_end,
    });

    // 4. Load sticker manifest and detect profanity
    const manifestPath = join(
      process.cwd(),
      "public",
      "assets",
      "stickers",
      "manifest.json",
    );
    let stickerIds: string[] = [];
    try {
      const manifestRaw = readFileSync(manifestPath, "utf-8");
      const manifest: StickerManifest = JSON.parse(manifestRaw);
      stickerIds = manifest.stickers.map((s) => s.id);
    } catch {
      // If manifest doesn't exist yet, proceed with empty pool
    }

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
      profanity_flags: profanityFlags,
    });

    if (!note) {
      return new Response(
        JSON.stringify({ error: "This area overlaps with an existing note" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

    // 7. Set cooldown (5 minutes) — skip when KV not configured
    try {
      await kv.set(cooldownKey, Date.now(), { ex: 300 });
    } catch {
      // KV not available (local dev) — skip cooldown
    }

    return new Response(JSON.stringify(note), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to create guestbook note:", error);
    const message = (error as Error)?.message === "Database not configured"
      ? "Database not configured — set DATABASE_URL"
      : "Failed to create note";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
