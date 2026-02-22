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

  // Dynamic char limit: tiles minus 1 row (for name/handle), times ~3 chars per tile
  $: contentRows = (selection.rowEnd - selection.rowStart) - 1;
  $: contentCols = selection.colEnd - selection.colStart;
  $: contentTiles = contentRows * contentCols;
  $: maxChars = Math.max(12, contentTiles * 3);

  // Font size matching NoteRenderer: scale by row span
  $: rowSpan = selection.rowEnd - selection.rowStart;
  $: fontSize = `${Math.max(0.6, Math.min(1.2, rowSpan * 0.25))}rem`;

  let text = '';
  let author = '';
  let textareaEl: HTMLTextAreaElement;
  let authorInputEl: HTMLInputElement;
  let showConfirmDiscard = false;
  let showConfirmPost = false;

  $: charCount = text.length;
  $: charRemaining = maxChars - charCount;
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
    showConfirmPost = true;
  }

  function confirmPost() {
    saveAuthor();
    dispatch('submit', {
      text: text.trim(),
      author: author.trim(),
    });
    showConfirmPost = false;
  }

  function cancelPost() {
    showConfirmPost = false;
    textareaEl?.focus();
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
    font-size: {fontSize};
  "
  on:keydown={handleKeydown}
>
  {#if showConfirmDiscard}
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <img src="/assets/pixel-art/ui/btn-discard.png" alt="" class="confirm-icon pixel-sprite" />
        <p class="confirm-text">Discard this note?</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-yes" on:click={confirmDiscard}>Yes</button>
          <button class="confirm-btn confirm-no" on:click={cancelDiscard}>No</button>
        </div>
      </div>
    </div>
  {:else if showConfirmPost}
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <img src="/assets/pixel-art/ui/btn-seal.png" alt="" class="confirm-icon pixel-sprite" />
        <p class="confirm-text">Post guest note?</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-post" on:click={confirmPost}>Post</button>
          <button class="confirm-btn confirm-no" on:click={cancelPost}>Back</button>
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
        placeholder="name/handle"
        maxlength="40"
        bind:value={author}
        bind:this={authorInputEl}
        on:keydown={handleAuthorKeydown}
        on:blur={saveAuthor}
      />
    </div>

    <!-- Discard button (top-right) -->
    <button class="discard-btn" on:click={handleCancel} title="Discard note">
      <img src="/assets/pixel-art/ui/btn-discard.png" alt="Discard" class="btn-icon pixel-sprite" />
    </button>

    <!-- Content textarea (center) -->
    <textarea
      class="note-textarea"
      bind:value={text}
      bind:this={textareaEl}
      maxlength={maxChars}
      placeholder="Write your note..."
    ></textarea>

    <!-- Bottom bar: seal button left, char count corner-right -->
    <div class="bottom-bar">
      <button
        class="seal-btn"
        on:click={handleSubmit}
        disabled={!text.trim() || !hasAuthor}
        title="Seal Guest Note"
      >
        <img src="/assets/pixel-art/ui/btn-seal.png" alt="Seal" class="btn-icon pixel-sprite" />
      </button>
      <span class="char-count" class:warning={charRemaining < 10}>
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
    padding: 3px;
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

  /* Discard button (top-right) */
  .discard-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    z-index: 5;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .discard-btn:hover {
    opacity: 1;
  }

  .btn-icon {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
  }

  /* Content textarea (center) — font matches final note rendering */
  .note-textarea {
    flex: 1;
    width: 100%;
    border: none;
    background: transparent;
    font-family: 'Grand9KPixel', monospace;
    font-size: 1em;
    color: #333;
    text-align: center;
    resize: none;
    outline: none;
    padding: 2px;
    line-height: 1.4;
    image-rendering: pixelated;
  }

  .note-textarea::placeholder {
    color: #b0a898;
  }

  /* Bottom bar */
  .bottom-bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .seal-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .seal-btn:hover:not(:disabled) {
    opacity: 1;
  }

  .seal-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .char-count {
    font-size: 0.45rem;
    color: #b0a898;
    font-family: 'Grand9KPixel', monospace;
    image-rendering: pixelated;
    line-height: 1;
  }

  .char-count.warning {
    color: #ef4444;
  }

  /* Confirm overlay (shared by discard and post) */
  .confirm-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 240, 232, 0.92);
    z-index: 30;
  }

  .confirm-dialog {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .confirm-icon {
    width: 24px;
    height: 24px;
    image-rendering: pixelated;
  }

  .confirm-text {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.55rem;
    color: #333;
    image-rendering: pixelated;
  }

  .confirm-actions {
    display: flex;
    gap: 6px;
    justify-content: center;
  }

  .confirm-btn {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.5rem;
    border: none;
    padding: 2px 10px;
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

  .confirm-post {
    background: #6b8e5a;
    color: #fff;
  }

  .confirm-post:hover {
    background: #4a7a3a;
  }

  .confirm-no {
    background: #d4ccc0;
    color: #333;
  }

  .confirm-no:hover {
    background: #c8c0b4;
  }
</style>
