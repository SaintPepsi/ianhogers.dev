<script lang="ts">
  import { allCategories, progressToNextLevel, levelDescription } from '$lib/data/skills';

  const totalLevel = allCategories.reduce((sum, cat) => sum + cat.skills.reduce((s, sk) => s + sk.level, 0), 0);

  const abbreviations: Record<string, string> = {
    "TypeScript": "TS",
    "Node.js": "Node",
    "PHP": "PHP",
    "Laravel": "Lara",
    "Svelte": "Sve",
    "Rust": "Rs",
    "SQL": "SQL",
  };

  function formatHours(h: number): string {
    if (h >= 100) return Math.round(h).toLocaleString();
    if (h < 1) return h.toString();
    return h.toFixed(1);
  }
</script>

<svelte:head>
  <title>Skills - Ian Hogers</title>
  <meta name="description" content="RuneScape-style skills grid" />
</svelte:head>

<div class="space-y-8">
  <div class="text-center mb-8">
    <h1 class="text-3xl sm:text-4xl mb-2">Skills</h1>
    <p class="text-gray-500 font-mono text-sm">hours in, levels out</p>
  </div>

  {#each allCategories as category}
    <section>
      <h2 class="text-xl sm:text-2xl mb-4">{category.title}</h2>
      <div class="pixel-box pixel-box-amber p-4 sm:p-6">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {#each category.skills as skill}
            {@const progress = progressToNextLevel(skill.hours)}
            {@const desc = levelDescription(skill.level)}
            {@const hoursDisplay = formatHours(skill.hours)}
            <div class="skill-tile group relative bg-bg/60 border border-surface-light hover:border-amber-500/50 p-3 cursor-pointer transition-colors">
              <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  {#if skill.icon}
                    <img src={skill.icon} alt="" width="20" height="20" class="shrink-0" style="image-rendering: pixelated; object-fit: contain;" />
                  {:else}
                    <span class="font-display text-gray-500 text-xs shrink-0">{abbreviations[skill.name] || skill.name}</span>
                  {/if}
                  <span class="text-xs sm:text-sm text-white truncate">{skill.name}</span>
                </div>
                <span class="font-mono text-amber-400 font-bold text-sm sm:text-base shrink-0">{skill.level}</span>
              </div>
              <!-- Tooltip -->
              <div class="skill-tooltip hidden group-hover:block absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-surface-light p-3 shadow-lg" style="min-width: 200px;">
                <div class="text-xs text-gray-400 font-mono mb-1">
                  {#if progress.isMax}
                    {hoursDisplay} hrs
                  {:else}
                    {hoursDisplay} / {formatHours(progress.nextHours)} hrs
                  {/if}
                </div>
                <div class="text-xs text-gray-500 mb-2">{desc}</div>
                <!-- XP Bar -->
                <div class="h-3 bg-bg border border-surface-light overflow-hidden">
                  <div
                    class="h-full transition-all"
                    style="width: {progress.percent}%; background-color: #f59e0b;"
                  ></div>
                </div>
                <div class="text-xs font-mono mt-1 text-right" style="color: #f59e0b;">
                  {#if progress.isMax}
                    MAX
                  {:else}
                    {progress.percent}% to level {progress.current + 1}
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/each}

  <!-- Total Level -->
  <div class="pixel-box pixel-box-amber p-4 text-center">
    <span class="text-gray-400 font-mono text-sm">Total Level: </span>
    <span class="font-mono text-amber-400 font-bold text-2xl">{totalLevel}</span>
  </div>
</div>

<style>
  .skill-tile {
    image-rendering: pixelated;
  }
  .skill-tooltip {
    image-rendering: auto;
  }
  /* Keep tooltips visible on the edges */
  .grid > :nth-child(odd):last-child .skill-tooltip,
  .grid > :nth-child(3n) .skill-tooltip {
    left: auto;
    right: 0;
  }
</style>
