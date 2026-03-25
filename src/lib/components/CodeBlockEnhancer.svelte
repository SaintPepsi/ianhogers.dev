<script lang="ts">
  import { onMount } from 'svelte';

  let { slug = 'snippet' }: { slug?: string } = $props();

  const langExtensions: Record<string, string> = {
    bash: 'sh',
    shell: 'sh',
    sh: 'sh',
    zsh: 'sh',
    typescript: 'ts',
    ts: 'ts',
    javascript: 'js',
    js: 'js',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    xml: 'xml',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    python: 'py',
    py: 'py',
    rust: 'rs',
    go: 'go',
    toml: 'toml',
    dockerfile: 'dockerfile',
    docker: 'dockerfile',
    markdown: 'md',
    md: 'md',
    plaintext: 'txt',
    text: 'txt',
  };

  function getLang(pre: HTMLPreElement): string {
    const code = pre.querySelector('code');
    if (!code) return '';
    const match = Array.from(code.classList).find(c => c.startsWith('language-'));
    return match ? match.replace('language-', '') : '';
  }

  function getExtension(lang: string): string {
    return langExtensions[lang] ?? (lang || 'txt');
  }

  function getCodeText(pre: HTMLPreElement): string {
    const code = pre.querySelector('code');
    return code?.textContent?.trim() ?? '';
  }

  onMount(() => {
    const proseEl = document.querySelector('.prose');
    if (!proseEl) return;

    const preBlocks = proseEl.querySelectorAll<HTMLPreElement>('pre');

    preBlocks.forEach((pre, index) => {
      const lang = getLang(pre);
      const ext = getExtension(lang);
      const filename = `${slug}-${index + 1}.${ext}`;

      // Wrap pre in a relative container
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Language badge
      if (lang) {
        const badge = document.createElement('span');
        badge.className = 'code-block-lang';
        badge.textContent = lang;
        wrapper.appendChild(badge);
      }

      // Button container
      const buttons = document.createElement('div');
      buttons.className = 'code-block-buttons';

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-block-btn';
      copyBtn.title = 'Copy to clipboard';
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      copyBtn.addEventListener('click', async () => {
        const text = getCodeText(pre);
        await navigator.clipboard.writeText(text);
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        copyBtn.classList.add('code-block-btn-success');
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
          copyBtn.classList.remove('code-block-btn-success');
        }, 2000);
      });

      // Download button
      const dlBtn = document.createElement('button');
      dlBtn.className = 'code-block-btn';
      dlBtn.title = `Download as ${filename}`;
      dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      dlBtn.addEventListener('click', () => {
        const text = getCodeText(pre);
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });

      buttons.appendChild(copyBtn);
      buttons.appendChild(dlBtn);
      wrapper.appendChild(buttons);
    });
  });
</script>
