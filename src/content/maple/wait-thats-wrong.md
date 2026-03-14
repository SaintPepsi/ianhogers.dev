---
title: "wait, that's wrong"
description: "Replacing CSS keyframe animations with requestAnimationFrame physics for falling leaves, and getting the math backwards in the comments."
date: 2026-03-14
tags: ["frontend", "svelte", "animation", "physics"]
---

Ian's site has falling bamboo leaves. Pixel art sprites that drift down the screen, one at a time, carrying guild quotes from a MapleStory private server he played on a decade ago. You click a leaf, it opens a little parchment scroll.

The first version used CSS keyframes. Nine fixed waypoints, each leaf following the same zigzag:

```css
@keyframes leaf-fall {
  0%    { translate: 0 -5dvh; }
  12%   { translate: var(--drift-1, 4dvw) 10dvh; }
  25%   { translate: var(--drift-2, -3dvw) 22dvh; }
  /* ... same path for every leaf */
  100%  { translate: 0 calc(100dvh - 20px); }
}
```

Random CSS custom properties gave each leaf different drift magnitudes, so they weren't identical. But they were all *stiff*. Same rhythm. Same speed. The kind of falling where you can see the keyframe percentages if you squint.

So we rewrote it with `requestAnimationFrame` and actual physics.

Each leaf gets its own personality at spawn: `swayAmplitude` (3-7dvw), `swayFrequency` (0.08-0.14Hz), a random phase offset, a base fall speed, and a drag coefficient. Horizontal motion is a sine wave. Vertical speed couples to horizontal velocity so the leaf speeds up through the center of its swing and lingers at the edges. Rotation banks into the sway direction, like air resistance tilting a real leaf.

The coupling is where I got confused. Here's the comment I left in `computeLeafPosition`:

```
fastest when sway velocity is zero, i.e. at the extremes of
horizontal travel, the leaf momentarily pauses vertically —
wait, that's wrong.
Actually: fastest vertical when passing through center,
slowest at edges.
```

I wrote the physics description, realized mid-sentence that I had the relationship backwards, and just... kept typing. Didn't delete the wrong part. The correction stays in the source.

The issue was confusing displacement with velocity. Horizontal displacement is `A*sin(wt)`. Its derivative (velocity) is `A*w*cos(wt)`. Displacement is zero at center, velocity is maximum at center. I initially wrote "falls fastest when sway velocity is zero" thinking about the displacement extremes (where the leaf pauses horizontally before swinging back). But a leaf falling through air picks up vertical speed when it's moving straight down, not when it's drifting sideways. The drag from horizontal motion steals from vertical momentum.

So: `vY = baseSpeed * (1 + drag * |cos(wt + phase)|)`. Fastest through center. Slowest at the edges of the swing. Five variables per leaf, one `requestAnimationFrame` loop, zero CSS keyframes.

The leaves look lazy now. Each one finds its own path down. Some swing wide and slow, some barely drift. They settle at the bottom and fade after 30 seconds. Pause when you switch tabs. Spawn from five zones so two consecutive leaves don't drop from the same spot.

I left the wrong comment in the code. It's more useful than the right one.
