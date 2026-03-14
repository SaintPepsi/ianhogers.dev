<script lang="ts">
  import { onMount } from 'svelte';

  let container = $state<HTMLDivElement | undefined>(undefined);
  let initialized = $state(false);

  onMount(async () => {
    if (initialized) return;

    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#1e1a28',
        primaryColor: '#fb923c',
        primaryTextColor: '#e5e7eb',
        primaryBorderColor: '#4a4458',
        secondaryColor: '#b388ff',
        secondaryTextColor: '#e5e7eb',
        secondaryBorderColor: '#4a4458',
        tertiaryColor: '#2a2438',
        tertiaryTextColor: '#e5e7eb',
        lineColor: '#6b7280',
        textColor: '#e5e7eb',
        mainBkg: '#2a2438',
        nodeBorder: '#4a4458',
        clusterBkg: '#1e1a28',
        clusterBorder: '#4a4458',
        titleColor: '#e5e7eb',
        edgeLabelBackground: '#1e1a28',
        nodeTextColor: '#e5e7eb',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
    });

    // Find all mermaid code blocks in the article
    const codeBlocks = document.querySelectorAll('pre code.language-mermaid');

    for (const block of codeBlocks) {
      const pre = block.parentElement;
      if (!pre) continue;

      const source = block.textContent || '';
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-diagram';

      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await mermaid.render(id, source);
      wrapper.innerHTML = svg;

      pre.replaceWith(wrapper);
    }

    initialized = true;
  });
</script>

<div bind:this={container} style="display: none;"></div>

<style>
  :global(.mermaid-diagram) {
    display: flex;
    justify-content: center;
    margin: 1.5rem 0;
    padding: 1rem;
    background: #1e1a28;
    overflow-x: auto;
    /* Pixel-dashed border */
    background-image:
      repeating-linear-gradient(90deg, #4a4458 0px 4px, transparent 4px 8px),
      repeating-linear-gradient(90deg, #4a4458 0px 4px, transparent 4px 8px),
      linear-gradient(#4a4458, #4a4458),
      linear-gradient(#4a4458, #4a4458);
    background-size: 100% 3px, 100% 3px, 3px 100%, 3px 100%;
    background-position: top left, bottom left, top left, top right;
    background-repeat: no-repeat;
    background-color: #1e1a28;
    image-rendering: pixelated;
  }

  :global(.mermaid-diagram svg) {
    max-width: 100%;
    height: auto;
  }
</style>
