import { describe, test, expect } from 'bun:test';

/**
 * Tests for CodeBlockEnhancer logic.
 * The component is client-side DOM manipulation, so we test the pure functions
 * (language detection, extension mapping, filename generation) in isolation.
 */

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

function getExtension(lang: string): string {
  return langExtensions[lang] ?? (lang || 'txt');
}

function buildFilename(slug: string, index: number, lang: string): string {
  const ext = getExtension(lang);
  return `${slug}-${index + 1}.${ext}`;
}

function getLangFromClassList(classes: string[]): string {
  const match = classes.find(c => c.startsWith('language-'));
  return match ? match.replace('language-', '') : '';
}

describe('language extension mapping', () => {
  test('bash variants all map to .sh', () => {
    expect(getExtension('bash')).toBe('sh');
    expect(getExtension('shell')).toBe('sh');
    expect(getExtension('sh')).toBe('sh');
    expect(getExtension('zsh')).toBe('sh');
  });

  test('typescript variants map to .ts', () => {
    expect(getExtension('typescript')).toBe('ts');
    expect(getExtension('ts')).toBe('ts');
  });

  test('javascript variants map to .js', () => {
    expect(getExtension('javascript')).toBe('js');
    expect(getExtension('js')).toBe('js');
  });

  test('python variants map to .py', () => {
    expect(getExtension('python')).toBe('py');
    expect(getExtension('py')).toBe('py');
  });

  test('yaml variants normalize', () => {
    expect(getExtension('yaml')).toBe('yaml');
    expect(getExtension('yml')).toBe('yaml');
  });

  test('dockerfile variants', () => {
    expect(getExtension('dockerfile')).toBe('dockerfile');
    expect(getExtension('docker')).toBe('dockerfile');
  });

  test('direct mappings pass through', () => {
    expect(getExtension('svelte')).toBe('svelte');
    expect(getExtension('html')).toBe('html');
    expect(getExtension('css')).toBe('css');
    expect(getExtension('xml')).toBe('xml');
    expect(getExtension('json')).toBe('json');
    expect(getExtension('sql')).toBe('sql');
    expect(getExtension('rust')).toBe('rs');
    expect(getExtension('go')).toBe('go');
    expect(getExtension('toml')).toBe('toml');
  });

  test('unknown language uses lang as extension', () => {
    expect(getExtension('ruby')).toBe('ruby');
    expect(getExtension('cpp')).toBe('cpp');
  });

  test('empty language falls back to txt', () => {
    expect(getExtension('')).toBe('txt');
  });
});

describe('filename generation', () => {
  test('builds filename from slug, index, and language', () => {
    expect(buildFilename('i-thought-i-was-cursed', 0, 'bash')).toBe('i-thought-i-was-cursed-1.sh');
    expect(buildFilename('i-thought-i-was-cursed', 2, 'typescript')).toBe('i-thought-i-was-cursed-3.ts');
    expect(buildFilename('hello-world', 0, 'xml')).toBe('hello-world-1.xml');
  });

  test('uses 1-based index in filename', () => {
    expect(buildFilename('test', 0, 'js')).toBe('test-1.js');
    expect(buildFilename('test', 4, 'js')).toBe('test-5.js');
  });

  test('handles unknown language gracefully', () => {
    expect(buildFilename('test', 0, 'haskell')).toBe('test-1.haskell');
  });

  test('handles empty language', () => {
    expect(buildFilename('test', 0, '')).toBe('test-1.txt');
  });
});

describe('language detection from class list', () => {
  test('extracts language from language- prefix', () => {
    expect(getLangFromClassList(['language-typescript'])).toBe('typescript');
    expect(getLangFromClassList(['language-bash'])).toBe('bash');
  });

  test('ignores non-language classes', () => {
    expect(getLangFromClassList(['highlight', 'code', 'language-python'])).toBe('python');
  });

  test('returns empty string when no language class', () => {
    expect(getLangFromClassList(['highlight', 'code'])).toBe('');
    expect(getLangFromClassList([])).toBe('');
  });

  test('uses first language class if multiple exist', () => {
    expect(getLangFromClassList(['language-ts', 'language-typescript'])).toBe('ts');
  });
});
