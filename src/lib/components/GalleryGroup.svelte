<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    tilt,
    align = 'start',
    area,
    class: className = '',
    children,
  }: {
    title: string;
    tilt?: number;
    align?: 'start' | 'center' | 'end';
    area?: string;
    class?: string;
    children?: Snippet;
  } = $props();

  const groupStyle = $derived(
    [tilt ? `--gg-tilt: ${tilt}deg` : '', area ? `grid-area: ${area}` : '']
      .filter(Boolean)
      .join('; ') || undefined
  );

  const classes = $derived(
    ['gallery-group', tilt ? 'gallery-group--tilted' : '', className]
      .filter(Boolean)
      .join(' ')
  );
</script>

<section class={classes} style={groupStyle}>
  <h3 class="gallery-group-title">{title}</h3>
  <div class="gallery-group-items gallery-group-items--{align}">
    {#if children}
      {@render children()}
    {/if}
  </div>
</section>

<style>
  .gallery-group {
    min-width: 0;
    padding: 0.5rem;
  }

  .gallery-group--tilted {
    transform: rotate(var(--gg-tilt, 0deg));
    transform-origin: center center;
  }

  .gallery-group-title {
    font-family: 'Weiholmir', cursive;
    color: var(--accent, #f59e0b);
    font-size: 1.4rem;
    margin: 0 0 0.75rem 0;
    padding-left: 0.5rem;
    border-left: 3px solid var(--accent, #f59e0b);
  }

  .gallery-group-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
    justify-items: center;
    align-items: start;
  }

  /* Third item spans full width and centers — forms the triangle base */
  .gallery-group-items :global(:nth-child(3)) {
    grid-column: 1 / -1;
    justify-self: center;
  }

  .gallery-group-items--center {
    justify-items: center;
  }
  .gallery-group-items--end {
    justify-items: end;
  }

  /* Reset MDX <p> wrappers if used inside MDX */
  .gallery-group-items :global(> p) {
    margin: 0;
    display: contents;
  }

  @media (max-width: 767px) {
    .gallery-group--tilted {
      transform: none;
    }
    .gallery-group-items {
      grid-template-columns: 1fr;
    }
    .gallery-group-items :global(:nth-child(3)) {
      grid-column: auto;
    }
  }
</style>
