/**
 * MapleAudioRegen Contract — Auto-regenerate audio when maple articles change.
 *
 * PostToolUse hook that fires after Edit/Write of src/content/maple/*.md files.
 * Checks Kokoro TTS availability, then spawns audio generation in background.
 *
 * Follows PAI HookContract conventions (Deps injection, accepts/execute, Result pattern)
 * but is self-contained — no cross-repo imports to ~/.claude/hooks/core/.
 */

// ─── Minimal Result Type (matches PAI core/result.ts) ────────────────────────

interface Ok<T> {
  ok: true;
  value: T;
}

interface Err<E> {
  ok: false;
  error: E;
}

type Result<T, E> = Ok<T> | Err<E>;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id?: string;
}

interface ContinueOutput {
  type: "continue";
  continue: true;
  additionalContext?: string;
}

interface HookError {
  message: string;
}

const MAPLE_PATTERN = /src\/content\/maple\/([^/]+)\.md$/;

// ─── Deps ────────────────────────────────────────────────────────────────────

export interface MapleAudioRegenDeps {
  checkHealth: (url: string) => Promise<boolean>;
  spawnRegen: (projectDir: string, slug: string) => void;
  stderr: (msg: string) => void;
  projectDir: string;
}

// ─── Pure Functions ──────────────────────────────────────────────────────────

function getFilePath(input: HookInput): string | null {
  if (typeof input.tool_input !== "object" || input.tool_input === null) return null;
  return (input.tool_input.file_path as string) ?? null;
}

function extractSlug(filePath: string): string | null {
  const match = filePath.match(MAPLE_PATTERN);
  return match ? match[1] : null;
}

// ─── Contract ────────────────────────────────────────────────────────────────

const defaultDeps: MapleAudioRegenDeps = {
  checkHealth: async (url: string): Promise<boolean> => {
    const resp = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    return resp?.ok ?? false;
  },

  spawnRegen: (projectDir: string, slug: string): void => {
    Bun.spawn(
      ["bun", `${projectDir}/scripts/generate-maple-audio.ts`, slug, "--force"],
      { cwd: projectDir, stdout: "ignore", stderr: "ignore" },
    ).unref();
  },

  stderr: (msg) => process.stderr.write(msg + "\n"),

  projectDir: import.meta.dir.replace(/\/scripts\/hooks\/contracts$/, ""),
};

export const MapleAudioRegen = {
  name: "MapleAudioRegen",
  event: "PostToolUse" as const,

  accepts(input: HookInput): boolean {
    const filePath = getFilePath(input);
    if (!filePath) return false;
    return MAPLE_PATTERN.test(filePath);
  },

  async execute(
    input: HookInput,
    deps: MapleAudioRegenDeps,
  ): Promise<Result<ContinueOutput, HookError>> {
    const filePath = getFilePath(input)!;
    const slug = extractSlug(filePath)!;

    const kokoroUrl = "http://127.0.0.1:8889";
    const isHealthy = await deps.checkHealth(kokoroUrl);

    if (!isHealthy) {
      deps.stderr(
        `[MapleAudioRegen] Kokoro TTS not running, skipping audio regen for "${slug}"`,
      );
      return ok({ type: "continue", continue: true });
    }

    deps.spawnRegen(deps.projectDir, slug);

    return ok({
      type: "continue",
      continue: true,
      additionalContext: `Audio narration for "${slug}" is regenerating in the background.`,
    });
  },

  defaultDeps,
};
