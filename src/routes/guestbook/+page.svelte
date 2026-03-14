<script>
  import GuestBook from '$lib/components/guestbook/GuestBook.svelte';
  import '$lib/styles/guestbook.css';
</script>

<svelte:head>
  <title>guestbook | Ian Hogers</title>
  <meta name="description" content="Leave a note in Ian's pixel-art guestbook." />
</svelte:head>

<div class="guestbook-wrapper">
  <GuestBook />
</div>

<div class="text-center mt-4 mb-8">
  <p class="text-xs text-gray-600" style="font-family: 'Grand9KPixel', monospace; letter-spacing: 0.05em;">
    book animation by <a href="https://codepen.io/Maseone" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-gray-400">Maseone</a>
  </p>
</div>

<style>
  .guestbook-wrapper {
    display: flex;
    justify-content: center;
    min-height: 70vh;
    padding: 2rem 0;
  }
  @media (max-width: 640px) {
    .guestbook-wrapper {
      padding: 0;
    }
    .guestbook-wrapper :global(.main) {
      padding: 0;
    }
  }
</style>
