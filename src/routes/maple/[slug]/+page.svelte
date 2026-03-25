<script lang="ts">
  import BlogPostLayout from '$lib/components/BlogPostLayout.svelte';
  import type { PostModule } from '$lib/blog';

  let { data } = $props();

  const modules = import.meta.glob('/src/content/maple/*.md', { eager: true }) as Record<string, PostModule>;
  const mod = Object.entries(modules).find(([path]) => path.includes(data.slug));
  const PostContent = mod ? mod[1].default : null;
</script>

<BlogPostLayout
  title={data.metadata.title}
  description={data.metadata.description}
  date={data.metadata.date}
  tags={data.metadata.tags}
  side="maple"
  slug={data.slug}
  hasAudio={data.hasAudio}
  audioSlug={data.slug}
>
  {#if PostContent}
    <PostContent />
  {/if}
</BlogPostLayout>
