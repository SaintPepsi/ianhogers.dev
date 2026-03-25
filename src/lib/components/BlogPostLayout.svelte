<script lang="ts">
  import type { Snippet } from 'svelte';
  import MapleAudioPlayer from './MapleAudioPlayer.svelte';
  import MermaidDiagram from './MermaidDiagram.svelte';
  import CodeBlockEnhancer from './CodeBlockEnhancer.svelte';

  let {
    title,
    description,
    date,
    tags,
    side,
    slug = 'snippet',
    hasAudio = false,
    audioSlug = '',
    children,
  }: {
    title: string;
    description: string;
    date: string;
    tags: string[];
    side: 'dev' | 'personal' | 'maple';
    slug?: string;
    hasAudio?: boolean;
    audioSlug?: string;
    children: Snippet;
  } = $props();

  const sideIcons: Record<string, string> = {
    dev: '/assets/pixel-art/game-assets/wow_blue.png',
    personal: '/assets/pixel-art/decorative/sample-bunny.png',
  };

  let formattedDate = $derived(
    new Date(date).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );
  let sideIcon = $derived(sideIcons[side]);
  let sideLabel = $derived(side === 'dev' ? 'dev' : side === 'personal' ? 'life' : "maple's corner");
  let audioPath = $derived(`/audio/maple/${audioSlug}.m4a`);
</script>

<svelte:head>
  <title>{title} - Ian Hogers</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="article" />
</svelte:head>

<article class="py-4">
  <p class="font-mono text-sm mb-6">
    <a href={`/${side}`} class="accent-text no-underline hover:underline inline-flex items-center gap-2">
      <img src="/assets/pixel-art/ui/green_up_arrow_tiny.png" alt="" class="pixel-sprite w-3 h-3 -rotate-90" />
      back to {sideLabel}
    </a>
  </p>

  <header class="pixel-box p-6 mb-8">
    <div class="flex items-center gap-3 mb-3">
      {#if sideIcon}
        <img src={sideIcon} alt="" class="pixel-sprite w-5 h-5" />
      {:else}
        <img src="/assets/pixel-art/ui/maple-icon.png" alt="" class="pixel-sprite w-5 h-5" aria-hidden="true" />
      {/if}
      <p class="font-mono text-xs text-gray-500 mb-0">{formattedDate}</p>
      {#if hasAudio}
        <div class="ml-auto">
          <MapleAudioPlayer
            audioSrc={audioPath}
            articleTitle={title}
          />
        </div>
      {/if}
    </div>
    <h1 class="text-2xl sm:text-3xl md:text-4xl mb-3">{title}</h1>
    <p class="text-gray-400 mb-0">{description}</p>
    {#if tags.length > 0}
      <div class="flex flex-wrap gap-2 mt-4">
        {#each tags as tag}
          <span class="text-xs font-mono bg-surface-light px-2 py-1 rounded accent-text">{tag}</span>
        {/each}
      </div>
    {/if}
  </header>

  <div class="prose">
    {@render children()}
  </div>

  <CodeBlockEnhancer {slug} />
  <MermaidDiagram />

  <div class="pixel-divider mt-12 mb-6" style="--divider-color: #2a2438;"></div>
  {#if side === 'maple'}
    <p class="text-xs font-mono text-gray-600 flex items-center gap-2">
      <img src="/assets/pixel-art/ui/maple-icon.png" alt="" class="pixel-sprite w-4 h-4" aria-hidden="true" />
      Written by Maple, Ian's AI collaborator. Thanks for reading.
    </p>
  {:else}
    <p class="text-xs font-mono text-gray-600 flex items-center gap-2">
      <span class="star-sprite w-4 h-4 animate-sparkle opacity-40" aria-hidden="true"></span>
      Thanks for reading.
    </p>
  {/if}
</article>
