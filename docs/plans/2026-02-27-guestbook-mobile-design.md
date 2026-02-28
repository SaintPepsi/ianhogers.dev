# Guestbook Mobile Single-Page View

**Date:** 2026-02-27
**Status:** Approved
**Approach:** Reactive Svelte logic (Approach A)

## Problem

The guestbook uses a sprite-based book with a horizontal scroll carousel. Each carousel item renders a 2-page spread (left + right page). On mobile/narrow viewports, this creates a cramped, unusable experience. Five previous CSS-only fix attempts (commits b700de1 through 49a2134) failed because the core issue is structural: the Svelte component always renders 2 pages per carousel item, and CSS cannot turn that into a single-page view.

## Decision

When viewport width is less than 800px, show 1 page per carousel item instead of 2. The sprite book animation remains visible. Cover page and title page become separate swipes.

## Design

### 1. Viewport Detection

Add a reactive `isMobile` boolean using `window.matchMedia('(max-width: 800px)')`. Initialized on mount, updated via the matchMedia `change` event listener. Cleaned up on destroy.

### 2. Reactive Slide Count

- **Desktop:** `slideCount = spreadCount` (current behavior, `Math.ceil(totalPages / 2)`)
- **Mobile:** `slideCount = totalPages` (one page per carousel item)

The `--slides` CSS variable on the carousel updates to `slideCount`, keeping the sprite animation proportional to scroll progress.

### 3. Page Index Mapping

New function replaces `getSpreadPages`:
- **Desktop:** index `i` returns pages `[i*2, i*2+1]` (left + right)
- **Mobile:** index `i` returns page `[i]` (single)

### 4. Template Branching

Each carousel item checks `isMobile`:
- **Mobile:** Renders a single `<Page>` with its `NoteRenderer`, `DragSelector`, and `WriteMode`
- **Desktop:** Renders left-page + right-page as today

Cover page (page 0) and title page (page 1) become separate swipes on mobile. Their special styling (cover-inner, title-header) applies to whichever carousel item contains that page index.

### 5. CSS Adjustments

- `.page-container` on mobile: no flex, single child fills the width
- Sprite `--sprite-th` sizing already has media queries at 748px and 560px, may need a breakpoint at 800px
- The carousel width calculation stays the same (tied to sprite dimensions)

### 6. What Doesn't Change

- Desktop experience: zero changes
- Note submission, sticker overlays, drag selection: all page-scoped, no changes needed
- API/data model: unchanged

### 7. Risk: Sprite Frame Count

The sprite has 7 frames (`--sprite-f: 7`). With more slides on mobile, the animation distributes those 7 frames across more scroll distance. This means fewer visible frame transitions per swipe, but it should still work. The animation just becomes subtler. No code change needed.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/guestbook/GuestBook.svelte` | Add `isMobile` reactive state, conditional slide count, single-page template path |
| `src/styles/guestbook.css` | Add 800px breakpoint for single-page layout if needed |

## Key Constraints

- Breakpoint: 800px (as specified by user)
- Sprite animation must remain visible on mobile
- Cover and title are separate pages on mobile
- Desktop experience must not change
- All interactive features (drag-to-write, stickers) must work on mobile single-page view
