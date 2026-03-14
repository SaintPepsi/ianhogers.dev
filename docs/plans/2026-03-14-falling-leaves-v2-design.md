# Falling Leaves v2: Animation, Spawn Rate, and Scroll Modal

Redesign of the falling bamboo leaves feature. Addresses three areas: leaf animation feel, spawn rate/lifecycle, and poem card modal design.

## 1. Animation: Lazy Float

**Problem:** Current animation has visible "stops" at each keyframe and a rigid symmetric sway pattern. Feels robotic, not organic.

**Solution:** Lazy floating style with smooth continuous descent and wide gentle arcs.

- Duration: 18-30s (randomized per leaf)
- Drift: +/-4-6dvw horizontal movement
- Timing: `ease-in-out` across all keyframes (no jarring transitions)
- Keyframes: 8-10 points for organic, non-repeating curves
- Rotation: gentle +/-10deg synced to drift direction
- No perceptible pauses between keyframe waypoints

## 2. Spawn Rate and Lifecycle

**Problem:** Current behavior spawns 8 leaves at once in a burst, loops forever.

**Solution:** Gradual trickle spawn tied to poem count.

- No initial burst. Leaves trickle in one at a time.
- Random 1-5 second interval between spawns
- Total leaves = total poems (10). Each leaf represents one unique poem.
- Settled leaves (at bottom) fade out after ~30s if not clicked.
- A faded leaf spawns a replacement (still draws from same poem pool).
- Once all 10 poems have been read (clicked), no more leaves spawn for the session.
- `sessionStorage` tracks poems-read count to enforce the cap.

## 3. Scroll Modal with Wax Seal

**Problem:** Current poem card is a basic pixel-box with the bamboo stem sprite and italic text. Doesn't feel special.

**Solution:** Parchment scroll card using pixel-art UI pack sprites with wax seal accent.

### Scroll Frame
- Uses 9-slice `border-image` from `UI_Paper_Frame_Vertical` sprites (from Complete UI Essential Pack v2.4, Paper Theme)
- Two variants to compare in browser:
  - `scroll-frame-01.png` (32x96, clean border)
  - `scroll-frame-02.png` (32x96, slightly more ornate edge)
- CSS `border-image-slice` preserves pixel-art corners while stretching middle
- `image-rendering: pixelated` for crisp scaling
- Max-width: 240px

### Seal
- Reuses `btn-seal.png` (red wax seal from guestbook, `src/components/guestbook/WriteMode.svelte:200`)
- Centered on top border, overlapping 50% above the card
- Inside a 64px circle with green pixel-dash border and dark bg fill
- The bamboo stem sprite (`bamboo-stem.png`) sits below the seal inside the card

### Content
- Poem text: italic, `#d1d5db`, `line-height: 1.6`
- Close button (X) top-right corner

### Behavior (unchanged)
- Opens at click position (centered on mobile < 480px)
- Backdrop click or Escape key closes
- Closing spawns replacement leaf (if poems remain)
- `poem-appear` animation on open

## Assets

Sprites copied from UI pack to project:
- `public/assets/pixel-art/ui/scroll-frame-01.png` — Paper_Frame_01_Vertical (32x96)
- `public/assets/pixel-art/ui/scroll-frame-02.png` — Paper_Frame_02_Vertical (32x96)

Existing assets reused:
- `public/assets/pixel-art/ui/btn-seal.png` — red wax seal (from guestbook)
- `public/assets/pixel-art/decorative/bamboo-stem.png` — bamboo icon (item737)

## Files Changed

- `src/components/FallingLeaves.svelte` — animation keyframes, spawn logic, modal markup/CSS
- `tests/e2e/falling-leaves.spec.ts` — update tests for new behavior
