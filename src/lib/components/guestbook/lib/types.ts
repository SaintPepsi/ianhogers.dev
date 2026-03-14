export interface GuestbookNote {
  id: string;
  page_index: number;
  row_start: number;
  row_end: number;
  col_start: number;
  col_end: number;
  text: string;
  author: string;
  profanity_flags: ProfanityFlag[];
  created_at: string;
}

export interface ProfanityFlag {
  word: string;
  charStart: number;
  charEnd: number;
  stickerPool: string[];
}

export interface StickerManifestEntry {
  id: string;
  src: string;
  width: number;
  height: number;
}

export interface StickerManifest {
  stickers: StickerManifestEntry[];
}
