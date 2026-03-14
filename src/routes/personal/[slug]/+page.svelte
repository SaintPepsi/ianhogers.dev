<script lang="ts">
  import BlogPostLayout from '$lib/components/BlogPostLayout.svelte';

  let { data } = $props();
</script>

<BlogPostLayout
  title={data.post.metadata.title}
  description={data.post.metadata.description}
  date={data.post.metadata.date}
  tags={data.post.metadata.tags}
  side="personal"
>
  <data.post.component />
</BlogPostLayout>
