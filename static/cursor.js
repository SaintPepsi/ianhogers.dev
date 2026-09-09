// Spritesheet cursor: interaction_hand.png (128x16, 8 frames of 16x16)
// Frames 0-2: click animation, Frames 0-3: pointer wiggle, Frames 4-6: grab/drag
// Uses background-position shifting on a single sprite sheet (no per-frame image reloads)
(function() {
  // Prevent double-init (View Transitions re-run inline scripts)
  if (window.__pixelCursorInit) return;
  window.__pixelCursorInit = true;

  const FRAME_SIZE = 16;
  const FRAME_COUNT = 8;
  const DISPLAY_SIZE = FRAME_SIZE * 2;
  const POINTER_FRAMES = [0, 1, 2, 3];
  const CLICK_DOWN_FRAMES = [0, 1, 2];
  const CLICK_UP_FRAMES = [2, 1, 0];
  const GRAB_DOWN_FRAMES = [4, 5, 6];
  const GRAB_UP_FRAMES = [6, 5, 4];
  const ANIM_SPEED = 150;
  const CLICK_SPEED = 75;
  const SPRITE_URL = '/assets/pixel-art/ui/interaction_hand.png';

  let currentFrames = POINTER_FRAMES;
  let frameIndex = 0;
  let animating = false;
  let animInterval = null;
  let isOverClickable = false;
  let isOverDraggable = false;
  let isGrabbing = false;
  let isReleasingClick = false;
  let releaseIsDrag = false;
  let ready = false;
  let lastX = -100;
  let lastY = -100;

  // Hide the default cursor globally
  const style = document.createElement('style');
  style.id = 'pixel-cursor-style';
  style.textContent = '*, *::before, *::after, *::scroll-button(*), *::scroll-marker, *::scroll-marker-group { cursor: none !important; }';
  if (!document.getElementById('pixel-cursor-style')) {
    document.head.appendChild(style);
  }

  // Create cursor element — uses sprite sheet directly with background-position
  const cursorEl = document.createElement('div');
  cursorEl.id = 'pixel-cursor';
  cursorEl.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: ${DISPLAY_SIZE}px;
    height: ${DISPLAY_SIZE}px;
    pointer-events: none;
    z-index: 99999;
    image-rendering: pixelated;
    display: none;
    transform: translate(${lastX}px, ${lastY}px);
    will-change: transform;
    background-image: url(${SPRITE_URL});
    background-size: ${DISPLAY_SIZE * FRAME_COUNT}px ${DISPLAY_SIZE}px;
    background-repeat: no-repeat;
  `;

  // schedulePositionUpdate function removed - direct positioning now used

  function ensureCursorInDOM() {
    // Re-append if removed by View Transition swap
    if (!document.getElementById('pixel-cursor')) {
      document.body.appendChild(cursorEl);
    }
    if (!document.getElementById('pixel-cursor-style')) {
      document.head.appendChild(style);
    }
  }

  document.body.appendChild(cursorEl);

  // Preload sprite sheet, then show cursor
  var sheet = new Image();
  sheet.onload = function() {
    ready = true;
    drawFrame(0);
    cursorEl.style.display = 'block';
  };
  sheet.src = SPRITE_URL;

  function drawFrame(frameIdx) {
    cursorEl.style.backgroundPosition = (-frameIdx * DISPLAY_SIZE) + 'px 0';
  }

  function startAnim(frames, loop, speed) {
    stopAnim();
    currentFrames = frames;
    frameIndex = 0;
    animating = true;
    drawFrame(currentFrames[0]);
    animInterval = setInterval(function() {
      frameIndex++;
      if (frameIndex >= currentFrames.length) {
        if (loop) {
          frameIndex = 0;
        } else {
          // Hold on last frame
          stopAnim();
          return;
        }
      }
      drawFrame(currentFrames[frameIndex]);
    }, speed || ANIM_SPEED);
  }

  function stopAnim() {
    if (animInterval) clearInterval(animInterval);
    animating = false;
    animInterval = null;
  }

  function updateState() {
    if (isGrabbing && isOverDraggable) {
      // Drag down: grab hand frames
      if (!animating || currentFrames !== GRAB_DOWN_FRAMES) startAnim(GRAB_DOWN_FRAMES, false, CLICK_SPEED);
    } else if (isGrabbing) {
      // Click down (default for everything): pointer click frames
      if (!animating || currentFrames !== CLICK_DOWN_FRAMES) startAnim(CLICK_DOWN_FRAMES, false, CLICK_SPEED);
    } else if (isReleasingClick) {
      // Release animation — grab or click depending on what was pressed
      var upFrames = releaseIsDrag ? GRAB_UP_FRAMES : CLICK_UP_FRAMES;
      if (!animating || currentFrames !== upFrames) {
        startAnim(upFrames, false, CLICK_SPEED);
        setTimeout(function() {
          isReleasingClick = false;
          releaseIsDrag = false;
          updateState();
        }, upFrames.length * CLICK_SPEED);
      }
    } else if (isOverClickable) {
      if (!animating || currentFrames !== POINTER_FRAMES) startAnim(POINTER_FRAMES, true);
    } else {
      stopAnim();
      if (ready) drawFrame(0);
    }
  }

  document.addEventListener('mousemove', function(e) {
    lastX = e.clientX;
    lastY = e.clientY;
    ensureCursorInDOM();
    cursorEl.style.transform = 'translate(' + lastX + 'px,' + lastY + 'px)';
    clearTimeout(bridgeLeaveTimer);
    lastPageMoveAt = performance.now();
    if (ready && cursorEl.style.display === 'none') cursorEl.style.display = 'block';

    var el = document.elementFromPoint(e.clientX, e.clientY);
    var clickable = el && (
      el.matches('a, button, [role="button"], input[type="submit"], select, label[for], [onclick]') ||
      el.closest('a, button, [role="button"]')
    );
    var draggable = el && (
      el.matches('[data-drag-cursor]') ||
      el.closest('[data-drag-cursor]')
    );

    var changed = false;
    if (clickable !== isOverClickable) { isOverClickable = clickable; changed = true; }
    if (draggable !== isOverDraggable) { isOverDraggable = draggable; changed = true; }
    if (changed) updateState();
  });

  document.addEventListener('mousedown', function() {
    isGrabbing = true;
    isReleasingClick = false;
    updateState();
  });

  document.addEventListener('mouseup', function() {
    isGrabbing = false;
    isReleasingClick = true;
    releaseIsDrag = isOverDraggable;
    updateState();
  });

  document.addEventListener('mouseleave', function() {
    cursorEl.style.display = 'none';
  });

  // Iframes swallow pointer events, so the sprite would freeze at the frame's edge.
  // Hide it on entry; a cooperating frame (see the bridge below) brings it back.
  document.addEventListener('mouseover', function(e) {
    if (e.target && e.target.tagName === 'IFRAME') cursorEl.style.display = 'none';
  });

  // Cursor bridge: an embedded page posts { type: 'pixel-cursor', kind, x, y, clickable, draggable }
  // with coordinates relative to its own viewport. Offset by the frame's position and drive
  // the same state machine the page's own mouse events use.
  function frameForSource(source) {
    // Walk up to the window that is a direct child of ours (games can be nested in embeds).
    var w = source;
    try { while (w && w.parent !== window && w.parent !== w) w = w.parent; } catch (err) { return null; }
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === w) return frames[i];
    }
    return null;
  }

  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || d.type !== 'pixel-cursor') return;
    var frame = frameForSource(e.source);
    if (!frame) return;

    if (d.kind === 'leave') {
      // The frame's leave lands just after our own mousemove when the pointer crosses back
      // onto the page. Hide only if no page mousemove follows shortly.
      if (performance.now() - lastPageMoveAt < 150) return;
      clearTimeout(bridgeLeaveTimer);
      bridgeLeaveTimer = setTimeout(function() { cursorEl.style.display = 'none'; }, 120);
      return;
    }

    var rect = frame.getBoundingClientRect();
    lastX = rect.left + d.x;
    lastY = rect.top + d.y;
    ensureCursorInDOM();
    cursorEl.style.transform = 'translate(' + lastX + 'px,' + lastY + 'px)';
    if (ready) cursorEl.style.display = 'block';

    if (d.kind === 'down') {
      isGrabbing = true;
      isReleasingClick = false;
    } else if (d.kind === 'up') {
      isGrabbing = false;
      isReleasingClick = true;
      releaseIsDrag = isOverDraggable;
    }

    var changed = d.kind !== 'move';
    if (!!d.clickable !== isOverClickable) { isOverClickable = !!d.clickable; changed = true; }
    if (!!d.draggable !== isOverDraggable) { isOverDraggable = !!d.draggable; changed = true; }
    if (changed) updateState();
  });
  document.addEventListener('mouseenter', function() {
    if (ready) cursorEl.style.display = 'block';
  });

  // Touch support — cursor follows finger
  let touchHideTimeout = null;
  var bridgeLeaveTimer = null;
  var lastPageMoveAt = 0;

  document.addEventListener('touchstart', function(e) {
    const t = e.touches[0];
    lastX = t.clientX;
    lastY = t.clientY;
    ensureCursorInDOM();
    cursorEl.style.transform = 'translate(' + lastX + 'px,' + lastY + 'px)';
    if (ready) cursorEl.style.display = 'block';
    isGrabbing = true;
    updateState();
    clearTimeout(touchHideTimeout);
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    const t = e.touches[0];
    lastX = t.clientX;
    lastY = t.clientY;
    cursorEl.style.transform = 'translate(' + lastX + 'px,' + lastY + 'px)';
    clearTimeout(touchHideTimeout);
  }, { passive: true });

  document.addEventListener('touchend', function() {
    isGrabbing = false;
    updateState();
    // Hide cursor after a short delay when finger lifts
    touchHideTimeout = setTimeout(function() {
      cursorEl.style.display = 'none';
    }, 800);
  });

  // Re-attach cursor after Astro View Transition page swap
  document.addEventListener('astro:after-swap', function() {
    ensureCursorInDOM();
    cursorEl.style.transform = `translate(${lastX}px, ${lastY}px)`;
    if (ready) cursorEl.style.display = 'block';
  });
})();
