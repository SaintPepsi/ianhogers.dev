export const prerender = false;

import type { APIRoute } from "astro";
import { kv } from "@vercel/kv";
import { getNotesByPage, getAllNotes, insertNote, checkOverlap } from "../../../components/guestbook/lib/db";
import { detectProfanity } from "../../../components/guestbook/lib/profanity";
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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // 1. Check IP cooldown
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || clientAddress;
    const cooldownKey = `guestbook:cooldown:${ip}`;

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
      col_start < 1 ||
      col_end > 9 ||
      col_end <= col_start
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid column bounds (1-9, end > start)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      typeof row_start !== "number" ||
      typeof row_end !== "number" ||
      row_start < 1 ||
      row_end > 16 ||
      row_end <= row_start
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid row bounds (1-16, end > start)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (typeof page_index !== "number") {
      return new Response(
        JSON.stringify({ error: "page_index is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Check overlap
    const overlapping = await checkOverlap(
      page_index,
      row_start,
      row_end,
      col_start,
      col_end,
    );
    if (overlapping) {
      return new Response(
        JSON.stringify({ error: "This area overlaps with an existing note" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

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

    // 5. Insert note
    const note = await insertNote({
      page_index,
      row_start,
      row_end,
      col_start,
      col_end,
      text,
      author,
      profanity_flags: profanityFlags,
    });

    // 6. Set cooldown (5 minutes)
    await kv.set(cooldownKey, Date.now(), { ex: 300 });

    return new Response(JSON.stringify(note), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to create guestbook note:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create note" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
