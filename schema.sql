CREATE TABLE guestbook_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_index INT NOT NULL,
  row_start INT NOT NULL,
  row_end INT NOT NULL,
  col_start INT NOT NULL,
  col_end INT NOT NULL,
  text TEXT NOT NULL,
  author VARCHAR(100) NOT NULL,
  profanity_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guestbook_page ON guestbook_notes(page_index);
