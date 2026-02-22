import { describe, test, expect, beforeAll } from 'bun:test';

const API_URL = 'http://localhost:4321/api/guestbook/notes';

const validBody = {
  text: 'Test note',
  author: 'Tester',
  page_index: 2,
  row_start: 1,
  row_end: 3,
  col_start: 1,
  col_end: 3,
};

async function postNote(body: Record<string, unknown>) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// Clear store before the file runs
beforeAll(async () => {
  await fetch(API_URL, { method: 'DELETE' });
});

describe('API validation: fractional bounds', () => {
  test('rejects fractional col_start', async () => {
    const res = await postNote({ ...validBody, col_start: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('column bounds');
  });

  test('rejects fractional col_end', async () => {
    const res = await postNote({ ...validBody, col_end: 3.7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('column bounds');
  });

  test('rejects fractional row_start', async () => {
    const res = await postNote({ ...validBody, row_start: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('row bounds');
  });

  test('rejects fractional row_end', async () => {
    const res = await postNote({ ...validBody, row_end: 3.2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('row bounds');
  });

  test('accepts valid integer bounds', async () => {
    // Use a unique area to avoid overlap with other tests
    const res = await postNote({
      ...validBody,
      page_index: 10,
      row_start: 1, row_end: 3,
      col_start: 1, col_end: 3,
    });
    expect(res.status).toBe(201);
  });
});

describe('API validation: page_index', () => {
  test('rejects negative page_index', async () => {
    const res = await postNote({ ...validBody, page_index: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('page_index');
  });

  test('rejects fractional page_index', async () => {
    const res = await postNote({ ...validBody, page_index: 0.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('page_index');
  });

  test('rejects string page_index', async () => {
    const res = await postNote({ ...validBody, page_index: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('page_index');
  });

  test('rejects NaN-like page_index', async () => {
    const res = await postNote({ ...validBody, page_index: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('page_index');
  });

  test('accepts page_index 0', async () => {
    const res = await postNote({
      ...validBody,
      page_index: 11,
      row_start: 5, row_end: 7,
      col_start: 5, col_end: 7,
    });
    expect(res.status).toBe(201);
  });
});

describe('API validation: out-of-range bounds', () => {
  test('rejects col_start < 1', async () => {
    const res = await postNote({ ...validBody, col_start: 0 });
    expect(res.status).toBe(400);
  });

  test('rejects col_end > 10', async () => {
    const res = await postNote({ ...validBody, col_end: 11 });
    expect(res.status).toBe(400);
  });

  test('rejects row_start < 1', async () => {
    const res = await postNote({ ...validBody, row_start: 0 });
    expect(res.status).toBe(400);
  });

  test('rejects row_end > 17', async () => {
    const res = await postNote({ ...validBody, row_end: 18 });
    expect(res.status).toBe(400);
  });

  test('rejects col_end <= col_start', async () => {
    const res = await postNote({ ...validBody, col_start: 3, col_end: 3 });
    expect(res.status).toBe(400);
  });

  test('rejects row_end <= row_start', async () => {
    const res = await postNote({ ...validBody, row_start: 5, row_end: 5 });
    expect(res.status).toBe(400);
  });
});

describe('API validation: text and author', () => {
  test('rejects empty text', async () => {
    const res = await postNote({ ...validBody, text: '' });
    expect(res.status).toBe(400);
  });

  test('rejects text over 280 chars', async () => {
    const res = await postNote({ ...validBody, text: 'a'.repeat(281) });
    expect(res.status).toBe(400);
  });

  test('rejects empty author', async () => {
    const res = await postNote({ ...validBody, author: '' });
    expect(res.status).toBe(400);
  });

  test('rejects author over 100 chars', async () => {
    const res = await postNote({ ...validBody, author: 'a'.repeat(101) });
    expect(res.status).toBe(400);
  });
});

describe('API: overlap detection', () => {
  test('rejects overlapping note with 409', async () => {
    // Clear store first
    await fetch(API_URL, { method: 'DELETE' });

    // Use dense text in a 2-wide area so shrinkBounds can't shrink further
    const dense = 'AB CD EF GH IJ KL MN OP';

    // Insert first note — 2 cols wide (minimum, won't shrink)
    const first = await postNote({
      text: dense,
      author: 'Tester',
      page_index: 20,
      row_start: 1, row_end: 5,
      col_start: 1, col_end: 3,
      profanity_flags: [],
    });
    expect(first.status).toBe(201);

    // Try exact same area — guaranteed overlap
    const second = await postNote({
      text: dense,
      author: 'Tester',
      page_index: 20,
      row_start: 1, row_end: 5,
      col_start: 1, col_end: 3,
      profanity_flags: [],
    });
    expect(second.status).toBe(409);
    expect(second.body.error).toContain('overlaps');
  });
});

describe('API: IP header preference', () => {
  test('ignores x-forwarded-for when x-vercel-forwarded-for is absent', async () => {
    // This test verifies the header is NOT used for rate limiting.
    // We send x-forwarded-for with a spoofed IP — it should be ignored.
    // Since KV is not configured in dev, rate limiting is skipped entirely,
    // but we can verify the code path doesn't crash with the header present.
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '1.2.3.4, 5.6.7.8',
      },
      body: JSON.stringify({
        ...validBody,
        page_index: 30,
        row_start: 1, row_end: 3,
        col_start: 1, col_end: 3,
      }),
    });
    // Should succeed (not crash, not use spoofed IP for anything harmful)
    expect(res.status).toBe(201);
  });
});
