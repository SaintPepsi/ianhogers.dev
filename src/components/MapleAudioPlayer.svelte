<script lang="ts">
  import { Tooltip } from 'bits-ui';

  let {
    audioSrc,
    articleTitle = 'this article',
  }: {
    audioSrc: string;
    articleTitle?: string;
  } = $props();

  let audio = $state<HTMLAudioElement | undefined>(undefined);
  let isPlaying = $state(false);
  let isExpanded = $state(false);
  let progress = $state(0);
  let duration = $state(0);
  let currentTime = $state(0);
  let hasError = $state(false);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function togglePlay() {
    if (!audio) return;
    if (hasError) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      isExpanded = true;
    }
  }

  function handleTimeUpdate() {
    if (!audio) return;
    currentTime = audio.currentTime;
    if (isFinite(audio.duration) && audio.duration > 0) {
      duration = audio.duration;
    }
    progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  }

  function handleLoadedMetadata() {
    if (!audio) return;
    if (isFinite(audio.duration) && audio.duration > 0) {
      duration = audio.duration;
    }
  }

  function handleEnded() {
    isPlaying = false;
    progress = 100;
  }

  function handlePlay() {
    isPlaying = true;
  }

  function handlePause() {
    isPlaying = false;
  }

  function handleError() {
    hasError = true;
    isPlaying = false;
  }

  function handleSeek(e: MouseEvent) {
    if (!audio || !isFinite(audio.duration) || audio.duration === 0) return;
    const bar = e.currentTarget as HTMLDivElement;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
  }

  function close() {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    isPlaying = false;
    isExpanded = false;
    progress = 0;
    currentTime = 0;
  }
</script>

<div class="maple-audio-player" class:expanded={isExpanded}>
  <audio
    bind:this={audio}
    src={audioSrc}
    preload="metadata"
    ontimeupdate={handleTimeUpdate}
    onloadedmetadata={handleLoadedMetadata}
    ondurationchange={handleLoadedMetadata}
    onended={handleEnded}
    onplay={handlePlay}
    onpause={handlePause}
    onerror={handleError}
  ></audio>

  {#if !isExpanded}
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger
          onclick={togglePlay}
          class="maple-play-btn"
          disabled={hasError}
        >
          <img
            src="/assets/pixel-art/ui/sound_on.png"
            alt=""
            class="pixel-sprite play-icon"
          />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={8} class="maple-tooltip {hasError ? 'maple-tooltip-error' : ''}">
            {hasError ? 'Audio unavailable' : 'Let Maple read this'}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  {:else}
    <div class="maple-mini-player">
      <button
        class="mini-play-btn"
        onclick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <img
          src={isPlaying ? '/assets/pixel-art/ui/sound_on.png' : '/assets/pixel-art/ui/sound_off.png'}
          alt=""
          class="pixel-sprite mini-icon"
        />
      </button>

      <div class="player-content">
        <div class="player-label">
          <span class="maple-leaf">🍁</span>
          <span class="label-text">{isPlaying ? 'Maple is reading...' : 'Paused'}</span>
        </div>

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="progress-bar" onclick={handleSeek}>
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>

        <div class="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <button
        class="close-btn"
        onclick={close}
        aria-label="Close player"
      >
        ✕
      </button>
    </div>
  {/if}
</div>

<style>
  .maple-audio-player {
    font-family: 'JetBrains Mono', monospace;
    z-index: 50;
  }

  /* Floating play button */
  .maple-play-btn {
    position: relative;
    width: 32px;
    height: 32px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
    image-rendering: pixelated;
    background-color: #1e1a28;
    background-image:
      repeating-linear-gradient(90deg, #fb923c 0px 4px, transparent 4px 8px),
      repeating-linear-gradient(90deg, #fb923c 0px 4px, transparent 4px 8px),
      linear-gradient(#fb923c, #fb923c),
      linear-gradient(#fb923c, #fb923c);
    background-size: 100% 3px, 100% 3px, 3px 100%, 3px 100%;
    background-position: top left, bottom left, top left, top right;
    background-repeat: no-repeat;
    box-shadow: 0 0 20px rgba(251, 146, 60, 0.15), 0 0 40px rgba(251, 146, 60, 0.05);
  }

  .maple-play-btn:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 0 24px rgba(251, 146, 60, 0.3), 0 0 48px rgba(251, 146, 60, 0.1);
  }

  .maple-play-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .play-icon {
    width: 16px;
    height: 16px;
  }


  /* Expanded mini player — always fixed at bottom */
  .maple-mini-player {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 2rem);
    max-width: calc(48rem - 3rem);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background-color: #1e1a28;
    background-image:
      repeating-linear-gradient(90deg, #fb923c 0px 4px, transparent 4px 8px),
      repeating-linear-gradient(90deg, #fb923c 0px 4px, transparent 4px 8px),
      linear-gradient(#fb923c, #fb923c),
      linear-gradient(#fb923c, #fb923c);
    background-size: 100% 3px, 100% 3px, 3px 100%, 3px 100%;
    background-position: top left, bottom left, top left, top right;
    background-repeat: no-repeat;
    box-shadow: 0 0 20px rgba(251, 146, 60, 0.15), 0 0 40px rgba(251, 146, 60, 0.05);
    animation: player-slide-up 0.25s ease;
  }

  @keyframes player-slide-up {
    from { opacity: 0; transform: translateX(-50%) translateY(1rem); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }


  .mini-play-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s;
  }

  .mini-play-btn:hover {
    transform: scale(1.15);
  }

  .mini-icon {
    width: 20px;
    height: 20px;
  }

  .player-content {
    flex: 1;
    min-width: 0;
  }

  .player-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .maple-leaf {
    font-size: 0.75rem;
  }

  .label-text {
    font-size: 0.65rem;
    color: #fb923c;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .progress-bar {
    width: 100%;
    height: 20px;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
  }

  .progress-bar::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 6px;
    background: rgba(251, 146, 60, 0.25);
    image-rendering: pixelated;
  }

  .progress-fill {
    height: 6px;
    background: #fb923c;
    transition: width 0.1s linear;
    image-rendering: pixelated;
    position: relative;
    z-index: 1;
  }

  .progress-fill::after {
    content: '';
    position: absolute;
    right: -5px;
    top: 50%;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    background: #fb923c;
    border: 2px solid #1e1a28;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .progress-bar:hover .progress-fill::after {
    opacity: 1;
  }

  .progress-bar:hover {
    background-color: rgba(251, 146, 60, 0.35);
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-size: 0.6rem;
    color: #9ca3af;
    margin-top: 4px;
  }

  .close-btn {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.1s;
  }

  .close-btn:hover {
    color: #fb923c;
  }
  /* Bits UI tooltip — global because it renders in a portal */
  :global(.maple-tooltip) {
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    background-color: #1e1a28;
    color: #fb923c;
    font-size: 0.75rem;
    padding: 6px 12px;
    pointer-events: none;
    background-image:
      repeating-linear-gradient(90deg, #fb923c 0px 4px, transparent 4px 8px),
      repeating-linear-gradient(90deg, #fb923c 0px 4px, transparent 4px 8px),
      linear-gradient(#fb923c, #fb923c),
      linear-gradient(#fb923c, #fb923c);
    background-size: 100% 2px, 100% 2px, 2px 100%, 2px 100%;
    background-position: top left, bottom left, top left, top right;
    background-repeat: no-repeat;
    animation: maple-tooltip-in 0.15s ease;
    z-index: 200;
  }

  :global(.maple-tooltip-error) {
    color: #ef5350;
  }

  @keyframes maple-tooltip-in {
    from { opacity: 0; transform: translateY(2px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
