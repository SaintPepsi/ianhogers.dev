<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let selection: {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  };
  export let pageIndex: number;

  const dispatch = createEventDispatcher();
  const MAX_CHARS = 280;

  let text = '';
  let author = '';
  let textareaEl: HTMLTextAreaElement;
  let authorInputEl: HTMLInputElement;
  let showConfirmDiscard = false;

  $: charCount = text.length;
  $: charRemaining = MAX_CHARS - charCount;
  $: hasAuthor = author.trim().length > 0;

  onMount(() => {
    const savedAuthor = localStorage.getItem('guestbook-author');
    if (savedAuthor) {
      author = savedAuthor;
      setTimeout(() => textareaEl?.focus(), 0);
    } else {
      setTimeout(() => authorInputEl?.focus(), 0);
    }
  });

  function saveAuthor() {
    if (author.trim()) {
      localStorage.setItem('guestbook-author', author.trim());
    }
  }

  function handleSubmit() {
    if (!text.trim() || !author.trim()) return;
    saveAuthor();
    dispatch('submit', {
      text: text.trim(),
      author: author.trim(),
    });
  }

  function handleCancel() {
    if (text.trim()) {
      showConfirmDiscard = true;
    } else {
      dispatch('cancel');
    }
  }

  function confirmDiscard() {
    showConfirmDiscard = false;
    dispatch('cancel');
  }

  function cancelDiscard() {
    showConfirmDiscard = false;
    textareaEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  function handleAuthorKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      saveAuthor();
      textareaEl?.focus();
    }
  }
</script>

<div
  class="write-mode"
  style="
    grid-row: {selection.rowStart} / {selection.rowEnd};
    grid-column: {selection.colStart} / {selection.colEnd};
  "
  on:keydown={handleKeydown}
>
  {#if showConfirmDiscard}
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <p class="confirm-text">Discard this note?</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-yes" on:click={confirmDiscard}>
            Yes
          </button>
          <button class="confirm-btn confirm-no" on:click={cancelDiscard}>
            No
          </button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Author handle (top-left) — mirrors final note layout -->
    <div class="author-row">
      <span class="author-dash">-</span>
      <input
        class="author-input"
        type="text"
        placeholder="name"
        maxlength="40"
        bind:value={author}
        bind:this={authorInputEl}
        on:keydown={handleAuthorKeydown}
        on:blur={saveAuthor}
      />
    </div>

    <!-- Close button (top-right) -->
    <button class="close-btn" on:click={handleCancel} title="Close">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="2" y="4" width="2" height="2" fill="currentColor"/>
        <rect x="4" y="6" width="2" height="2" fill="currentColor"/>
        <rect x="6" y="4" width="2" height="2" fill="currentColor"/>
        <rect x="4" y="2" width="2" height="2" fill="currentColor"/>
        <rect x="8" y="2" width="2" height="2" fill="currentColor"/>
        <rect x="2" y="8" width="2" height="2" fill="currentColor"/>
        <rect x="8" y="8" width="2" height="2" fill="currentColor"/>
      </svg>
    </button>

    <!-- Content textarea (center) -->
    <textarea
      class="note-textarea"
      bind:value={text}
      bind:this={textareaEl}
      maxlength={MAX_CHARS}
      placeholder="Write your note..."
    ></textarea>

    <!-- Bottom bar: submit left, char count right -->
    <div class="bottom-bar">
      <button
        class="submit-btn"
        on:click={handleSubmit}
        disabled={!text.trim() || !hasAuthor}
        title="Sign your note"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="10" width="2" height="2" fill="currentColor"/>
          <rect x="4" y="8" width="2" height="2" fill="currentColor"/>
          <rect x="6" y="6" width="2" height="2" fill="currentColor"/>
          <rect x="8" y="4" width="2" height="2" fill="currentColor"/>
          <rect x="10" y="2" width="2" height="2" fill="currentColor"/>
          <rect x="0" y="12" width="4" height="2" fill="currentColor"/>
        </svg>
      </button>
      <span class="char-count" class:warning={charRemaining < 30}>
        {charRemaining}
      </span>
    </div>
  {/if}
</div>

<style>
  .write-mode {
    position: relative;
    display: flex;
    flex-direction: column;
    border: 2px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.06);
    z-index: 20;
    padding: 4px;
    overflow: hidden;
  }

  /* Author handle — top-left, mirrors final note appearance */
  .author-row {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .author-dash {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.6em;
    color: hsl(45.71deg 69.23% 30%);
    image-rendering: pixelated;
  }

  .author-input {
    border: none;
    border-bottom: 1px dashed hsl(45.71deg 69.23% 50%);
    background: transparent;
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.6em;
    color: hsl(45.71deg 69.23% 30%);
    padding: 1px 2px;
    outline: none;
    width: 60%;
    image-rendering: pixelated;
  }

  .author-input::placeholder {
    color: #b0a898;
  }

  .author-input:focus {
    border-bottom-color: #3b82f6;
  }

  .close-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #8a7e72;
    cursor: pointer;
    padding: 0;
    z-index: 5;
    image-rendering: pixelated;
  }

  .close-btn:hover {
    color: #ef4444;
  }

  .note-textarea {
    flex: 1;
    width: 100%;
    border: none;
    background: transparent;
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.9rem;
    color: #333;
    text-align: center;
    resize: none;
    outline: none;
    padding: 4px;
    line-height: 1.4;
    image-rendering: pixelated;
  }

  .note-textarea::placeholder {
    color: #b0a898;
  }

  .bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .submit-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #6b8e5a;
    cursor: pointer;
    padding: 0;
    image-rendering: pixelated;
    transition: color 0.15s;
  }

  .submit-btn:hover:not(:disabled) {
    color: #4a7a3a;
  }

  .submit-btn:disabled {
    color: #c8c0b4;
    cursor: not-allowed;
  }

  .char-count {
    font-size: 0.5rem;
    color: #b0a898;
    font-family: 'Grand9KPixel', monospace;
    image-rendering: pixelated;
  }

  .char-count.warning {
    color: #ef4444;
  }

  /* Confirm discard dialog */
  .confirm-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 240, 232, 0.9);
    z-index: 30;
  }

  .confirm-dialog {
    text-align: center;
  }

  .confirm-text {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.7rem;
    color: #333;
    margin-bottom: 8px;
    image-rendering: pixelated;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .confirm-btn {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.6rem;
    border: none;
    padding: 2px 12px;
    cursor: pointer;
    transition: background 0.15s;
    image-rendering: pixelated;
  }

  .confirm-yes {
    background: #ef4444;
    color: #fff;
  }

  .confirm-yes:hover {
    background: #dc2626;
  }

  .confirm-no {
    background: #d4ccc0;
    color: #333;
  }

  .confirm-no:hover {
    background: #c8c0b4;
  }
</style>
