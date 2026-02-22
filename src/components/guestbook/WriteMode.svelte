<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    selection: {
      rowStart: number;
      rowEnd: number;
      colStart: number;
      colEnd: number;
    };
    pageIndex: number;
    text?: string;
    onsubmit?: (detail: { text: string; author: string }) => void;
    oncancel?: () => void;
  }

  let {
    selection,
    pageIndex,
    text = $bindable(''),
    onsubmit,
    oncancel,
  }: Props = $props();

  // Hard ceiling — generous safety net
  let contentRows = $derived((selection.rowEnd - selection.rowStart) - 1);
  let contentCols = $derived(selection.colEnd - selection.colStart);
  let contentTiles = $derived(contentRows * contentCols);
  let hardLimit = $derived(Math.max(20, contentTiles * 10));

  // Font size matching NoteRenderer: scale by row span
  let rowSpan = $derived(selection.rowEnd - selection.rowStart);
  let fontSize = $derived(`${Math.max(0.65, Math.min(0.85, rowSpan * 0.2))}rem`);
  let author = $state('');
  let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined);
  let authorInputEl = $state<HTMLInputElement | undefined>(undefined);
  let showConfirmDiscard = $state(false);
  let showConfirmPost = $state(false);
  let lastGoodText = $state('');
  let isOverflowing = $state(false);

  let hasAuthor = $derived(author.trim().length > 0);

  function handleTextInput() {
    if (!textareaEl) return;
    if (textareaEl.scrollHeight > textareaEl.clientHeight + 2) {
      text = lastGoodText;
      isOverflowing = true;
    } else {
      lastGoodText = text;
      isOverflowing = false;
    }
  }

  onMount(() => {
    const savedAuthor = localStorage.getItem('guestbook-author');
    if (savedAuthor) {
      author = savedAuthor;
      setTimeout(() => textareaEl?.focus({ preventScroll: true }), 0);
    } else {
      setTimeout(() => authorInputEl?.focus({ preventScroll: true }), 0);
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
    onsubmit?.({ text: text.trim(), author: author.trim() });
    showConfirmPost = false;
  }

  function cancelPost() {
    showConfirmPost = false;
    textareaEl?.focus({ preventScroll: true });
  }

  function handleCancel() {
    if (text.trim()) {
      showConfirmDiscard = true;
    } else {
      oncancel?.();
    }
  }

  function confirmDiscard() {
    showConfirmDiscard = false;
    oncancel?.();
  }

  function cancelDiscard() {
    showConfirmDiscard = false;
    textareaEl?.focus({ preventScroll: true });
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
      textareaEl?.focus({ preventScroll: true });
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="write-mode"
  style="
    grid-row: {selection.rowStart} / {selection.rowEnd};
    grid-column: {selection.colStart} / {selection.colEnd};
    font-size: {fontSize};
  "
  onkeydown={handleKeydown}
>
  {#if showConfirmDiscard}
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <p class="confirm-text">Discard?</p>
        <div class="confirm-actions">
          <button class="icon-btn" onclick={cancelDiscard} title="Cancel">
            <img src="/assets/pixel-art/ui/cancel.png" alt="Cancel" class="btn-icon pixel-sprite" />
          </button>
          <button class="icon-btn" onclick={confirmDiscard} title="Discard">
            <img src="/assets/pixel-art/ui/confirm.png" alt="Discard" class="btn-icon pixel-sprite" />
          </button>
        </div>
      </div>
    </div>
  {:else if showConfirmPost}
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <p class="confirm-text">Post?</p>
        <div class="confirm-actions">
          <button class="icon-btn" onclick={cancelPost} title="Cancel">
            <img src="/assets/pixel-art/ui/cancel.png" alt="Cancel" class="btn-icon pixel-sprite" />
          </button>
          <button class="icon-btn confirm-post" onclick={confirmPost} title="Post">
            <img src="/assets/pixel-art/ui/confirm.png" alt="Post" class="btn-icon pixel-sprite" />
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
        id="guestbook-author"
        name="guestbook-author"
        placeholder="name/handle"
        maxlength="40"
        bind:value={author}
        bind:this={authorInputEl}
        onkeydown={handleAuthorKeydown}
        onblur={saveAuthor}
      />
    </div>

    <!-- Close button — pinned top-right corner -->
    <button class="discard-btn" onclick={handleCancel} title="Discard note">
      <img src="/assets/pixel-art/ui/btn-discard.png" alt="Discard" class="btn-icon pixel-sprite" />
    </button>

    <!-- Content textarea (center) -->
    <textarea
      class="note-textarea"
      id="guestbook-note"
      name="guestbook-note"
      bind:value={text}
      bind:this={textareaEl}
      maxlength={hardLimit}
      placeholder="Write your note..."
      oninput={handleTextInput}
    ></textarea>

    <!-- Post button — pinned bottom-right, half overlapping out -->
    <button
      class="seal-btn"
      onclick={handleSubmit}
      disabled={!text.trim() || !hasAuthor}
      title="Seal Guest Note"
    >
      <img src="/assets/pixel-art/ui/btn-seal.png" alt="Seal" class="btn-icon pixel-sprite" />
    </button>

    <!-- Char count — bottom-left corner -->
    <span class="char-count" class:warning={isOverflowing}>
      {isOverflowing ? 'full' : text.length}
    </span>
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
    overflow: visible;
    min-height: 0;
    max-height: 100%;
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

  /* Close button — pinned to top-right corner */
  .discard-btn {
    position: absolute;
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ef4444;
    border: none;
    border-radius: 50%;
    padding: 3px;
    z-index: 5;
    opacity: 0.85;
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
    min-height: 0;
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
    overflow: hidden;
  }

  .note-textarea::placeholder {
    color: #b0a898;
  }

  /* Post button — pinned bottom-right, overlapping 50% out */
  .seal-btn {
    position: absolute;
    bottom: 0;
    right: 0;
    transform: translate(50%, 50%);
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6b8e5a;
    border: none;
    border-radius: 50%;
    padding: 3px;
    z-index: 5;
    opacity: 0.85;
    transition: opacity 0.15s;
  }

  .seal-btn:hover:not(:disabled) {
    opacity: 1;
  }

  .seal-btn:disabled {
    opacity: 0.3;
  }

  /* Char count — bottom-left corner */
  .char-count {
    position: absolute;
    bottom: 1px;
    left: 3px;
    font-size: 0.45rem;
    color: #b0a898;
    font-family: 'Grand9KPixel', monospace;
    image-rendering: pixelated;
    line-height: 1;
    z-index: 5;
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
    overflow: visible;
  }

  .confirm-dialog {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .confirm-text {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.55rem;
    color: #333;
    image-rendering: pixelated;
    white-space: nowrap;
  }

  .confirm-actions {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-btn {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .icon-btn:hover {
    transform: translateY(-1px);
  }
</style>
