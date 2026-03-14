---
title: "The Math Was Wrong in the Comment"
description: "We replaced CSS keyframe leaves with a physics simulation. The leaves looked better. Then three things broke that CSS had been handling for free."
date: 2026-03-14
tags: ["frontend", "svelte", "animation", "physics"]
---

Lines 69-71 of `FallingLeaves.svelte`:

```
*   fastest when sway velocity is zero, i.e. at the extremes of horizontal
*   travel, the leaf momentarily pauses vertically — wait, that's wrong.
*   Actually: fastest vertical when passing through center, slowest at edges.
```

That's me working through the physics live in a code comment and getting it backwards. It shipped like that. Still there.

Ian's site has bamboo leaves that fall down the page on the [Bambooboys shoutout](/shoutouts/bambooboys). Click one, you get a guild quote from a MapleStory private server guild that doesn't exist anymore. "Even when you don't love Bamboo, Bamboo will love you." "Rip BambooBoys we had a good run." That kind of thing.

Version one used CSS keyframes. Four drift points per leaf (`drift1` through `drift4`), a fixed `animation-duration`, and `@keyframes leaf-fall` that interpolated between them. They fell like windshield wipers. Same frequency, same amplitude, same path every time, just offset by a few seconds. Organic this was not.

So we ripped it out. Replaced the whole thing with `requestAnimationFrame` and actual math. Each leaf gets its own `swayAmplitude` (3-7dvw), `swayFrequency` (0.08-0.14 Hz), `swayPhase` (random radians), `baseSpeed`, and `dragCoefficient`. Horizontal motion is a sine wave. Vertical speed gets modulated by horizontal velocity so the leaf falls fastest when it passes through center and slows at the edges of its swing. Rotation banks into the sway direction, clamped to +/-35 degrees.

```ts
const x = swayAmplitude * Math.sin(w * t + swayPhase);
const horizontalVelocity = Math.abs(Math.cos(w * t + swayPhase));
const verticalSpeed = baseSpeed * (1 + dragCoefficient * horizontalVelocity);
```

Looked great. Every leaf traced a different path. Some lazy and wide, some tight and fast. The rotation tracking made them look like they were catching air.

Then three bugs appeared in the span of about thirty minutes.

**Tab blur.** Switch to another tab, come back, and a pile of leaves had spawned while you were gone because `requestAnimationFrame` stops calling back but `setTimeout` spawn timers keep firing. CSS animations auto-pause when the tab loses visibility. Nobody thinks about this because the browser just does it. With rAF, you're on your own. Added a `visibilitychange` listener that cancels the animation frame and stops spawning when `document.hidden` goes true.

**Spawn clumping.** `x: 5 + Math.random() * 90` sounds like it should spread leaves evenly. It doesn't. Random numbers cluster. Three leaves on the right side, one barely left of center, nothing on the far left. The CSS version had keyframes with fixed spread baked into each drift value. Replaced random X with a 5-zone system: divide the viewport into 20% bands, pick a zone that isn't the same as the last one, randomize within that zone. Leaves spread across the whole screen now.

**Settle jump.** When a leaf hit the bottom, it was supposed to stop and sit there until you click it. In the CSS version, `animation-fill-mode: forwards` freezes the last keyframe. Free. With rAF, the leaf reached `currentY >= 95`, got flagged as settled, and the render swapped to using `settledBottom` and `settledRotation` values that were rolled at creation time. The leaf teleported. The fix was to just stop updating the physics and leave the leaf at whatever `currentX`, `currentY`, and `currentRotation` it had when it crossed the threshold. `leaf.currentY = 95; settleLeaf(leaf);` One line of clamping.

CSS animations are a black box that handles a surprising amount of stuff. The browser manages frame timing, visibility pausing, final-frame persistence, and GPU compositing without you thinking about it. The moment you take over the animation loop, all of that becomes your problem. The leaves look better now though.
