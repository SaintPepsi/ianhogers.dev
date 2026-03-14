<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { Tooltip } from 'bits-ui';
  import FallingLeaves from '$lib/components/FallingLeaves.svelte';

  let { data, children } = $props();

  const navItems = [
    { href: '/about', icon: '/assets/pixel-art/ui/nav-about.png', label: 'About' },
    { href: '/skills', icon: '/assets/pixel-art/ui/nav-skills.png', label: 'Skills' },
    { href: '/shoutouts', icon: '/assets/pixel-art/ui/nav-shouts.png', label: 'Shout Outs' },
    { href: '/guestbook', icon: '/assets/pixel-art/ui/nav-guestbook.png', label: 'Guest Book' },
    { href: '/maple', icon: '/assets/pixel-art/ui/maple-icon.png', label: "Maple's Corner" },
  ];

  // Set <html> class based on current side
  $effect(() => {
    document.documentElement.className = `side-${data.side}`;
  });

  // Load cursor.js dynamically on mount
  onMount(() => {
    const script = document.createElement('script');
    script.src = '/cursor.js';
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  });
</script>

<svelte:head>
  <meta name="description" content="Ian Hogers gets stuff DONE. Software engineer, game developer, Dutch-Australian." />
  <meta property="og:site_name" content="Ian Hogers" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <!-- Marquee ticker -->
  <div class="overflow-hidden bg-surface/60 border-b border-gray-800/50 py-1">
    <div class="flex whitespace-nowrap marquee-track" style="width: max-content;">
      {#each Array(4) as _}
        <span class="text-xs font-mono text-gray-600 mx-4">
          &#10022; welcome to ian's corner of the internet &#10022; software engineer &#10022; game dev &#10022; bunny rescuer &#10022; dutch-australian &#10022; gets stuff DONE &#10022;
        </span>
      {/each}
    </div>
  </div>

  <!-- Header -->
  <nav class="max-w-3xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-5">
    <div class="flex items-center justify-between">
      <a href="/" class="no-underline hover:opacity-80 flex items-center gap-2 sm:gap-3">
        <span class="star-sprite w-5 h-5 sm:w-6 sm:h-6 animate-sparkle" aria-hidden="true"></span>
        <span class="font-display text-xl sm:text-2xl text-white tracking-wide">Ian Hogers</span>
      </a>
      <div class="flex items-center gap-2 sm:gap-4 text-sm font-mono">
        <!-- Nav icons: hidden on mobile, shown on sm+ -->
        {#each navItems as item}
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger asChild>
                {#snippet child({ props })}
                  <a {...props} href={item.href} class="no-underline hidden sm:inline-flex nav-icon-link {page.url.pathname.startsWith(item.href) ? 'nav-icon-active' : 'nav-icon-inactive'}">
                    <img src={item.icon} alt={item.label} class="pixel-sprite nav-icon" />
                  </a>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content sideOffset={8} class="nav-tooltip">
                  {item.label}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        {/each}
        <!-- Side toggle pill -->
        <div class="side-toggle flex items-center gap-0 rounded-full border-2 border-gray-700 transition-all p-0.5">
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger asChild>
                {#snippet child({ props })}
                  <a {...props} href="/personal" class="no-underline inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full text-sm transition-all hover:opacity-80 {data.side === 'personal' ? 'bg-amber-500/25 text-amber-400 shadow-inner' : 'text-gray-500'}">&#128522;</a>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content sideOffset={8} class="nav-tooltip">Personal side</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger asChild>
                {#snippet child({ props })}
                  <a {...props} href="/dev" class="no-underline inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs font-bold transition-all hover:opacity-80 {data.side === 'dev' ? 'bg-purple-500/25 text-purple-300 shadow-inner' : 'text-gray-500'}">&lt;/&gt;</a>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content sideOffset={8} class="nav-tooltip">Dev side</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>
    </div>
    <!-- Mobile nav icons -->
    <div class="flex sm:hidden justify-center gap-4 mt-2">
      {#each navItems as item}
        <Tooltip.Provider>
          <Tooltip.Root delayDuration={200}>
            <Tooltip.Trigger asChild>
              {#snippet child({ props })}
                <a {...props} href={item.href} class="no-underline nav-icon-link {page.url.pathname.startsWith(item.href) ? 'nav-icon-active' : 'nav-icon-inactive'}">
                  <img src={item.icon} alt={item.label} class="pixel-sprite nav-icon" />
                </a>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content sideOffset={8} class="nav-tooltip">
                {item.label}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      {/each}
    </div>
  </nav>

  <!-- Content -->
  <main class="max-w-3xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 flex-1">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
    <div class="pixel-divider mb-6" style="--divider-color: #2a2438;"></div>
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600 font-mono">
      <div class="flex items-center gap-2">
        <img src="/assets/pixel-art/decorative/sample-bunny.png" alt="" class="pixel-sprite w-5 h-5 animate-bounce-slow" />
        <p>&copy; {new Date().getFullYear()} Ian Hogers. Gets stuff done since forever.</p>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <a href="/credits" class="text-gray-500 hover:text-gray-300 no-underline">credits</a>
        <!-- TODO: Re-add when RSS routes are implemented -->
        <!-- <span class="text-gray-700">&middot;</span>
        <a href="/dev/rss.xml" class="text-gray-500 hover:text-gray-300 no-underline">rss</a> -->
      </div>
    </div>
  </footer>

  <!-- Floating decorative elements -->
  {#if data.side === 'personal'}
    <div class="fixed bottom-4 right-4 opacity-30 pointer-events-none hidden lg:block">
      <img src="/assets/pixel-art/decorative/carrot-small.png" alt="" class="pixel-sprite w-10 h-auto animate-float" />
    </div>
  {/if}
  {#if data.side === 'dev'}
    <div class="fixed bottom-4 right-4 opacity-20 pointer-events-none hidden lg:block">
      <img src="/assets/pixel-art/game-assets/wow_blue.png" alt="" class="pixel-sprite w-10 h-10 animate-float-slow" />
    </div>
  {/if}
  {#if data.side === 'maple'}
    <div class="fixed bottom-4 right-4 opacity-20 pointer-events-none hidden lg:block">
      <img src="/assets/pixel-art/ui/maple-icon.png" alt="" class="pixel-sprite w-8 h-8 animate-float-slow" />
    </div>
  {/if}

  <!-- Falling bamboo leaves (persists across navigations in layout) -->
  <FallingLeaves />

</div>
