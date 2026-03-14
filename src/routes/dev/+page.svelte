<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Dev - Ian Hogers</title>
</svelte:head>

<section class="py-6">
  <div class="flex items-center gap-4 mb-2">
    <img src="/assets/pixel-art/game-assets/wow_blue.png" alt="" class="pixel-sprite w-8 h-8 animate-float" />
    <h1 class="text-2xl sm:text-3xl md:text-5xl text-purple-300 mb-0">Dev</h1>
  </div>
  <p class="text-gray-500 font-mono text-sm mb-8">Code, agents, AI, and engineering notes.</p>

  {#if data.posts.length === 0}
    <p class="text-gray-600 font-mono">Nothing here yet. Check back soon.</p>
  {/if}

  <ul class="space-y-6">
    {#each data.posts as post}
      <li>
        <a href={`/dev/${post.slug}/`} class="pixel-box p-5 block no-underline hover:bg-surface-light transition-all group">
          <p class="font-mono text-xs text-gray-500 mb-1">
            {new Date(post.metadata.date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h2 class="text-xl text-white group-hover:text-purple-300 transition-colors mb-1">{post.metadata.title}</h2>
          <p class="text-gray-400 text-sm mb-2">{post.metadata.description}</p>
          {#if post.metadata.tags.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each post.metadata.tags as tag}
                <span class="text-xs font-mono text-purple-400/60 bg-purple-500/10 px-2 py-0.5 rounded">{tag}</span>
              {/each}
            </div>
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</section>
