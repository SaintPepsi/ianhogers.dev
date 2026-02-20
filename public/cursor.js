// Spritesheet cursor: interaction_hand.png (128x16, 8 frames of 16x16)
// Frames 0-3: pointer wiggle (hover on clickable), Frames 4-7: grab animation
// Persists across Astro View Transitions
(function() {
  // Prevent double-init (View Transitions re-run inline scripts)
  if (window.__pixelCursorInit) return;
  window.__pixelCursorInit = true;

  const FRAME_SIZE = 16;
  const POINTER_FRAMES = [0, 1, 2, 3];
  const GRAB_FRAMES = [4, 5, 6];
  const ANIM_SPEED = 150;
  const GRAB_SPEED = 75;

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_SIZE;
  canvas.height = FRAME_SIZE;
  const ctx = canvas.getContext('2d');

  const sheet = new Image();
  sheet.src = '/assets/pixel-art/ui/interaction_hand.png';

  let currentFrames = POINTER_FRAMES;
  let frameIndex = 0;
  let animating = false;
  let animInterval = null;
  let isOverClickable = false;
  let isGrabbing = false;
  let ready = false;
  let lastX = -100;
  let lastY = -100;

  // Hide the default cursor globally
  const style = document.createElement('style');
  style.id = 'pixel-cursor-style';
  style.textContent = '* { cursor: none !important; }';
  if (!document.getElementById('pixel-cursor-style')) {
    document.head.appendChild(style);
  }

  // Create cursor element
  const cursorEl = document.createElement('div');
  cursorEl.id = 'pixel-cursor';
  cursorEl.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: ${FRAME_SIZE * 2}px;
    height: ${FRAME_SIZE * 2}px;
    pointer-events: none;
    z-index: 99999;
    image-rendering: pixelated;
    display: none;
    transform: translate(${lastX}px, ${lastY}px);
  `;

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

  sheet.onload = function() {
    ready = true;
    drawFrame(0);
    cursorEl.style.display = 'block';
  };

  function drawFrame(frameIdx) {
    ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    ctx.drawImage(sheet, frameIdx * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
    cursorEl.style.backgroundImage = `url(${canvas.toDataURL()})`;
    cursorEl.style.backgroundSize = 'contain';
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
    if (isGrabbing) {
      if (!animating || currentFrames !== GRAB_FRAMES) startAnim(GRAB_FRAMES, false, GRAB_SPEED);
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
    cursorEl.style.transform = `translate(${lastX}px, ${lastY}px)`;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const clickable = el && (
      el.matches('a, button, [role="button"], input[type="submit"], select, label[for], [onclick]') ||
      el.closest('a, button, [role="button"]') ||
      getComputedStyle(el).cursor === 'pointer'
    );

    if (clickable !== isOverClickable) {
      isOverClickable = clickable;
      updateState();
    }
  });

  document.addEventListener('mousedown', function() {
    isGrabbing = true;
    updateState();
  });

  document.addEventListener('mouseup', function() {
    isGrabbing = false;
    updateState();
  });

  document.addEventListener('mouseleave', function() {
    cursorEl.style.display = 'none';
  });
  document.addEventListener('mouseenter', function() {
    if (ready) cursorEl.style.display = 'block';
  });

  // Touch support — cursor follows finger
  let touchHideTimeout = null;

  document.addEventListener('touchstart', function(e) {
    const t = e.touches[0];
    lastX = t.clientX;
    lastY = t.clientY;
    ensureCursorInDOM();
    cursorEl.style.transform = `translate(${lastX}px, ${lastY}px)`;
    if (ready) cursorEl.style.display = 'block';
    isGrabbing = true;
    updateState();
    clearTimeout(touchHideTimeout);
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    const t = e.touches[0];
    lastX = t.clientX;
    lastY = t.clientY;
    cursorEl.style.transform = `translate(${lastX}px, ${lastY}px)`;
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
