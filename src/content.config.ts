import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const postSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

const dev = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/dev' }),
  schema: postSchema,
});

const personal = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/personal' }),
  schema: postSchema,
});

export const collections = { dev, personal };
