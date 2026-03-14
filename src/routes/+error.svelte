<script>
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status} | Ian Hogers</title>
</svelte:head>

<section class="py-16 text-center">
  <h1 class="font-display text-5xl mb-4">{page.status}</h1>
  <p class="text-gray-400 mb-8">{page.error?.message || 'Something went wrong.'}</p>
  <a href="/" class="pixel-box p-3 px-6 no-underline hover:bg-surface-light transition-colors text-sm text-gray-300 hover:text-white">
    &#8592; back home
  </a>
</section>
