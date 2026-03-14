<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Life - Ian Hogers</title>
</svelte:head>

<section class="py-6">
  <div class="flex items-center gap-4 mb-2">
    <img src="/assets/pixel-art/decorative/sample-bunny.png" alt="" class="pixel-sprite w-8 h-8 animate-bounce-slow" />
    <h1 class="text-2xl sm:text-3xl md:text-5xl text-amber-400 mb-0">Life</h1>
  </div>
  <p class="text-gray-500 font-mono text-sm mb-8">Cooking, baking, bunnies, voice acting, and everything else.</p>

  {#if data.posts.length === 0}
    <p class="text-gray-600 font-mono">Nothing here yet. Check back soon.</p>
  {/if}

  <ul class="space-y-6">
    {#each data.posts as post}
      <li>
        <a href={`/personal/${post.slug}/`} class="pixel-box p-5 block no-underline hover:bg-surface-light transition-all group">
          <p class="font-mono text-xs text-gray-500 mb-1">
            {new Date(post.metadata.date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h2 class="text-xl text-white group-hover:text-amber-400 transition-colors mb-1">{post.metadata.title}</h2>
          <p class="text-gray-400 text-sm mb-2">{post.metadata.description}</p>
          {#if post.metadata.tags.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each post.metadata.tags as tag}
                <span class="text-xs font-mono text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded">{tag}</span>
              {/each}
            </div>
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</section>
