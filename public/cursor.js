// Spritesheet cursor: interaction_hand.png (128x16, 8 frames of 16x16)
// Frames 0-3: pointer wiggle (hover on clickable), Frames 4-7: grab animation
(function() {
  const FRAME_SIZE = 16;
  const TOTAL_FRAMES = 8;
  const POINTER_FRAMES = [0, 1, 2, 3];
  const GRAB_FRAMES = [4, 5, 6, 7];
  const ANIM_SPEED = 150; // ms per frame

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

  // Hide the default cursor globally
  const style = document.createElement('style');
  style.textContent = '* { cursor: none !important; }';
  document.head.appendChild(style);

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
  `;
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

  function startAnim(frames) {
    stopAnim();
    currentFrames = frames;
    frameIndex = 0;
    animating = true;
    drawFrame(currentFrames[0]);
    animInterval = setInterval(function() {
      frameIndex = (frameIndex + 1) % currentFrames.length;
      drawFrame(currentFrames[frameIndex]);
    }, ANIM_SPEED);
  }

  function stopAnim() {
    if (animInterval) clearInterval(animInterval);
    animating = false;
    animInterval = null;
  }

  function updateState() {
    if (isGrabbing) {
      if (!animating || currentFrames !== GRAB_FRAMES) startAnim(GRAB_FRAMES);
    } else if (isOverClickable) {
      if (!animating || currentFrames !== POINTER_FRAMES) startAnim(POINTER_FRAMES);
    } else {
      stopAnim();
      if (ready) drawFrame(0); // static first frame
    }
  }

  document.addEventListener('mousemove', function(e) {
    cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

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
})();
