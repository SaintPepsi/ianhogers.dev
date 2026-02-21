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
  let showNameInput = false;
  let textareaEl: HTMLTextAreaElement;
  let nameInputEl: HTMLInputElement;
  let showConfirmDiscard = false;

  $: charCount = text.length;
  $: charRemaining = MAX_CHARS - charCount;

  onMount(() => {
    const savedAuthor = localStorage.getItem('guestbook-author');
    if (savedAuthor) {
      author = savedAuthor;
      showNameInput = false;
      // Focus textarea after tick
      setTimeout(() => textareaEl?.focus(), 0);
    } else {
      showNameInput = true;
      setTimeout(() => nameInputEl?.focus(), 0);
    }
  });

  function handleNameSubmit() {
    if (!author.trim()) return;
    localStorage.setItem('guestbook-author', author.trim());
    showNameInput = false;
    setTimeout(() => textareaEl?.focus(), 0);
  }

  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSubmit();
    }
  }

  function handleSubmit() {
    if (!text.trim() || !author.trim()) return;
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
    <!-- Discard confirmation dialog -->
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
  {:else if showNameInput}
    <!-- Name input step -->
    <div class="name-step">
      <label class="name-label" for="guestbook-name">Your name</label>
      <input
        id="guestbook-name"
        class="name-input"
        type="text"
        placeholder="Enter your name..."
        maxlength="40"
        bind:value={author}
        bind:this={nameInputEl}
        on:keydown={handleNameKeydown}
      />
      <button
        class="name-submit"
        on:click={handleNameSubmit}
        disabled={!author.trim()}
      >
        Continue
      </button>
    </div>
  {:else}
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

    <!-- Textarea -->
    <textarea
      class="note-textarea"
      bind:value={text}
      bind:this={textareaEl}
      maxlength={MAX_CHARS}
      placeholder="Write your note..."
    ></textarea>

    <!-- Character count (bottom-right) -->
    <span class="char-count" class:warning={charRemaining < 30}>
      {charRemaining}
    </span>

    <!-- Submit button (bottom-left) -->
    <button
      class="submit-btn"
      on:click={handleSubmit}
      disabled={!text.trim()}
      title="Sign your note"
    >
      <!-- Pixel quill/pen icon -->
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="10" width="2" height="2" fill="currentColor"/>
        <rect x="4" y="8" width="2" height="2" fill="currentColor"/>
        <rect x="6" y="6" width="2" height="2" fill="currentColor"/>
        <rect x="8" y="4" width="2" height="2" fill="currentColor"/>
        <rect x="10" y="2" width="2" height="2" fill="currentColor"/>
        <rect x="0" y="12" width="4" height="2" fill="currentColor"/>
      </svg>
    </button>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap');

  .write-mode {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #ede7db;
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
    z-index: 20;
    padding: 4px;
    overflow: hidden;
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
    font-family: 'Caveat', cursive;
    font-size: 0.9rem;
    color: #2c2420;
    text-align: center;
    resize: none;
    outline: none;
    padding: 16px 4px 20px 4px;
    line-height: 1.3;
  }

  .note-textarea::placeholder {
    color: #b0a898;
    font-style: italic;
  }

  .char-count {
    position: absolute;
    bottom: 3px;
    right: 6px;
    font-size: 0.6rem;
    color: #b0a898;
    font-family: 'Inter', system-ui, sans-serif;
    pointer-events: none;
  }

  .char-count.warning {
    color: #ef4444;
  }

  .submit-btn {
    position: absolute;
    bottom: 2px;
    left: 2px;
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
    z-index: 5;
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

  /* Name input step */
  .name-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    padding: 8px;
  }

  .name-label {
    font-family: 'Caveat', cursive;
    font-size: 0.9rem;
    color: #6b5e50;
  }

  .name-input {
    width: 100%;
    max-width: 160px;
    border: 1px solid #d4ccc0;
    border-radius: 2px;
    background: #f5f0e8;
    font-family: 'Caveat', cursive;
    font-size: 0.85rem;
    color: #2c2420;
    text-align: center;
    padding: 4px 8px;
    outline: none;
  }

  .name-input:focus {
    border-color: #3b82f6;
  }

  .name-submit {
    font-family: 'Caveat', cursive;
    font-size: 0.8rem;
    color: #f5f0e8;
    background: #6b8e5a;
    border: none;
    border-radius: 2px;
    padding: 3px 12px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .name-submit:hover:not(:disabled) {
    background: #4a7a3a;
  }

  .name-submit:disabled {
    background: #c8c0b4;
    cursor: not-allowed;
  }

  /* Confirm discard dialog */
  .confirm-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(237, 231, 219, 0.95);
    z-index: 30;
    border-radius: 2px;
  }

  .confirm-dialog {
    text-align: center;
  }

  .confirm-text {
    font-family: 'Caveat', cursive;
    font-size: 0.85rem;
    color: #2c2420;
    margin-bottom: 8px;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .confirm-btn {
    font-family: 'Caveat', cursive;
    font-size: 0.75rem;
    border: none;
    border-radius: 2px;
    padding: 2px 12px;
    cursor: pointer;
    transition: background 0.15s;
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
    color: #2c2420;
  }

  .confirm-no:hover {
    background: #c8c0b4;
  }
</style>
