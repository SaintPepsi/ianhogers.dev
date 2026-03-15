#!/usr/bin/env bun
/**
 * Generate audio narration for Maple articles using Kokoro TTS.
 *
 * Usage:
 *   bun scripts/generate-maple-audio.ts                  # generate for all articles
 *   bun scripts/generate-maple-audio.ts hello-world      # generate for specific article
 *   bun scripts/generate-maple-audio.ts --force           # regenerate even if audio exists
 *
 * Requires:
 *   - Kokoro TTS server running on port 8889
 *   - afconvert (macOS built-in) for WAV to M4A conversion
 */

import { join } from 'path';

// --- Dependency injection ---

interface ScriptDeps {
  kokoroUrl: string;
  kokoroVoice: string;
  articlesDir: string;
  outputDir: string;
  readDir: (path: string) => string[];
  readFile: (path: string) => string;
  writeFile: (path: string, data: Buffer) => void;
  fileExists: (path: string) => boolean;
  fileSize: (path: string) => number;
  removeFile: (path: string) => void;
  execCommand: (cmd: string) => void;
  log: (msg: string) => void;
  error: (msg: string) => void;
}

function createDefaultDeps(config: { kokoroUrl: string; kokoroVoice: string }): ScriptDeps {
  const fs = require('fs') as typeof import('fs');
  const child = require('child_process') as typeof import('child_process');

  return {
    kokoroUrl: config.kokoroUrl,
    kokoroVoice: config.kokoroVoice,
    articlesDir: join(import.meta.dir, '..', 'src', 'content', 'maple'),
    outputDir: join(import.meta.dir, '..', 'static', 'audio', 'maple'),
    readDir: (path) => fs.readdirSync(path, 'utf-8') as string[],
    readFile: (path) => fs.readFileSync(path, 'utf-8'),
    writeFile: (path, data) => fs.writeFileSync(path, data),
    fileExists: (path) => fs.existsSync(path),
    fileSize: (path) => fs.statSync(path).size,
    removeFile: (path) => fs.unlinkSync(path),
    execCommand: (cmd) => child.execSync(cmd, { stdio: 'pipe' }),
    log: (msg) => console.log(msg),
    error: (msg) => console.error(msg),
  };
}

// --- Markdown to plain text ---

function extractTitle(md: string): string {
  const match = md.match(/^---[\s\S]*?title:\s*"([^"]+)"[\s\S]*?---/m);
  return match ? match[1] : '';
}

function extractDescription(md: string): string {
  const match = md.match(/^---[\s\S]*?description:\s*"([^"]+)"[\s\S]*?---/m);
  return match ? match[1] : '';
}

/** Make code/symbols speakable by converting to natural language */
function makeCodeSpeakable(text: string): string {
  return text
    // Function calls: Math.sin(x) → "Math dot sin of x"
    .replace(/(\w+)\.(\w+)\(([^)]*)\)/g, (_m, obj: string, fn: string, args: string) => {
      const speakableArgs = args ? ` of ${args}` : '';
      return `${obj} dot ${fn}${speakableArgs}`;
    })
    // Standalone function calls: sin(wt) → "sin of wt"
    .replace(/(\w+)\(([^)]*)\)/g, (_m, fn: string, args: string) => {
      const speakableArgs = args ? ` of ${args}` : '';
      return `${fn}${speakableArgs}`;
    })
    // Arrow functions: => → "arrow"
    .replace(/=>/g, 'arrow')
    // Comparison/assignment operators (before individual chars)
    .replace(/===/g, ' equals ')
    .replace(/!==/g, ' not equals ')
    .replace(/>=/g, ' greater than or equal to ')
    .replace(/<=/g, ' less than or equal to ')
    // Curly braces — strip entirely
    .replace(/[{}]/g, '')
    // Strip comment markers (leading * or //)
    .replace(/^\s*\*\s+/gm, '')
    .replace(/^\s*\/\/\s*/gm, '')
    // Arithmetic operators: only * between word/number characters
    .replace(/(\w)\s*\*\s*(\w)/g, '$1 times $2')
    .replace(/\+/g, ' plus ')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1 divided by $2')  // only between numbers
    .replace(/\//g, ' ')  // other slashes become spaces (paths, etc)
    // Assignment
    .replace(/(?<![!><=])=(?![>=])/g, ' equals ')
    // Semicolons — strip
    .replace(/;/g, '')
    // Parentheses that survived function call replacement
    .replace(/\(/g, ' ')
    .replace(/\)/g, ' ')
    // Square brackets
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    // Clean up multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripMarkdown(md: string): string {
  const withoutFrontmatter = md.replace(/^---[\s\S]*?---\n*/m, '');

  return withoutFrontmatter
    .replace(/```\w*\n([\s\S]*?)```/g, (_match, content: string) => makeCodeSpeakable(content.trim()))
    .replace(/`([^`]+)`/g, (_match, content: string) => makeCodeSpeakable(content))
    // Convert number-number ranges to "number to number" for natural speech
    .replace(/(\d+)-(\d+)/g, '$1 to $2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^---+$/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^\|.*\|$/gm, '')
    .replace(/^[-|:\s]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --- Kokoro TTS ---

async function checkKokoro(deps: ScriptDeps): Promise<boolean> {
  const resp = await fetch(`${deps.kokoroUrl}/health`, { signal: AbortSignal.timeout(3000) })
    .catch(() => null);
  return resp?.ok ?? false;
}

async function generateAudio(text: string, deps: ScriptDeps): Promise<ArrayBuffer> {
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const audioChunks: ArrayBuffer[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const preview = paragraph.slice(0, 50) + (paragraph.length > 50 ? '...' : '');
    deps.log(`  [${i + 1}/${paragraphs.length}] "${preview}"`);

    const resp = await fetch(`${deps.kokoroUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: paragraph, voice: deps.kokoroVoice }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Kokoro error on paragraph ${i + 1}: ${resp.status} - ${errorText}`);
    }

    audioChunks.push(await resp.arrayBuffer());
  }

  return concatenateWav(audioChunks, deps);
}

function concatenateWav(chunks: ArrayBuffer[], deps: ScriptDeps): ArrayBuffer {
  if (chunks.length === 0) return new ArrayBuffer(0);
  if (chunks.length === 1) return chunks[0];

  const pcmChunks = chunks.map((chunk, i) => {
    const view = new DataView(chunk);
    if (view.getUint32(0, false) !== 0x52494646) {
      deps.log(`  Warning: chunk ${i} doesn't have RIFF header, including as-is`);
      return new Uint8Array(chunk);
    }
    return new Uint8Array(chunk, 44);
  });

  const totalPcmLength = pcmChunks.reduce((sum, c) => sum + c.length, 0);

  const header = new Uint8Array(chunks[0], 0, 44);
  const result = new Uint8Array(44 + totalPcmLength);
  result.set(header, 0);

  let offset = 44;
  for (const pcm of pcmChunks) {
    result.set(pcm, offset);
    offset += pcm.length;
  }

  const view = new DataView(result.buffer);
  view.setUint32(4, 36 + totalPcmLength, true);
  view.setUint32(40, totalPcmLength, true);

  return result.buffer;
}

// --- Main ---

async function main(deps: ScriptDeps) {
  const args = Bun.argv.slice(2);
  const force = args.includes('--force');
  const targetSlug = args.find(a => !a.startsWith('--'));

  deps.log('Checking Kokoro TTS server...');
  const available = await checkKokoro(deps);
  if (!available) {
    deps.error('Kokoro TTS server not available at ' + deps.kokoroUrl);
    deps.error('Start it with: cd ~/.claude/VoiceServer && ./start.sh');
    process.exit(1);
  }
  deps.log('Kokoro is ready.\n');

  const files = deps.readDir(deps.articlesDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');

    if (targetSlug && slug !== targetSlug) continue;

    const outputPath = join(deps.outputDir, `${slug}.m4a`);

    if (!force && deps.fileExists(outputPath)) {
      deps.log(`✓ ${slug} — audio exists, skipping (use --force to regenerate)`);
      continue;
    }

    deps.log(`▸ ${slug}`);

    const markdown = deps.readFile(join(deps.articlesDir, file));
    const title = extractTitle(markdown);
    const description = extractDescription(markdown);
    const body = stripMarkdown(markdown);
    const headerParts = [title, description].filter(Boolean).map(s => s.endsWith('.') ? s : `${s}.`);
    const plainText = [...headerParts, body].join('\n\n');
    deps.log(`  ${title ? `"${title}" — ` : ''}${plainText.length} chars of text`);

    deps.log('  Generating audio...');
    const wavData = await generateAudio(plainText, deps);
    deps.log(`  Generated ${(wavData.byteLength / 1024 / 1024).toFixed(1)}MB WAV`);

    const tempWav = join(deps.outputDir, `${slug}.wav`);
    deps.writeFile(tempWav, Buffer.from(wavData));

    // Resample 24kHz to 44.1kHz (required for AAC encoding)
    const tempWav44k = join(deps.outputDir, `${slug}-44k.wav`);
    deps.log('  Resampling to 44.1kHz...');
    deps.execCommand(`afconvert -f WAVE -d LEI16@44100 "${tempWav}" "${tempWav44k}"`);

    deps.log('  Converting to M4A (64kbps AAC)...');
    deps.execCommand(`afconvert -f m4af -d aac -b 64000 "${tempWav44k}" "${outputPath}"`);

    deps.removeFile(tempWav);
    deps.removeFile(tempWav44k);

    const m4aSize = deps.fileSize(outputPath);
    deps.log(`  ✓ ${(m4aSize / 1024 / 1024).toFixed(1)}MB M4A written\n`);
  }

  deps.log('Done.');
}

const deps = createDefaultDeps({
  kokoroUrl: Bun.env.KOKORO_URL || 'http://127.0.0.1:8889',
  kokoroVoice: Bun.env.KOKORO_VOICE || 'bf_emma',
});

main(deps).catch(err => {
  deps.error(`Fatal error: ${err}`);
  process.exit(1);
});
