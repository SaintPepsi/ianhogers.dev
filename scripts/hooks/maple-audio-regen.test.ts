import { describe, test, expect } from "bun:test";
import { join } from "path";
import { MapleAudioRegen } from "@scripts/hooks/contracts/MapleAudioRegen";
import type { MapleAudioRegenDeps } from "@scripts/hooks/contracts/MapleAudioRegen";

// ─── Mock Deps ───────────────────────────────────────────────────────────────

function mockDeps(overrides: Partial<MapleAudioRegenDeps> = {}): MapleAudioRegenDeps {
  return {
    checkHealth: async () => true,
    spawnRegen: () => {},
    stderr: () => {},
    projectDir: "/mock/project",
    ...overrides,
  };
}

function mapleInput(filePath: string) {
  return {
    tool_name: "Edit",
    tool_input: { file_path: filePath },
    session_id: "test",
  };
}

// ─── Contract: accepts() ─────────────────────────────────────────────────────

describe("MapleAudioRegen.accepts", () => {
  test("accepts maple markdown files", () => {
    expect(
      MapleAudioRegen.accepts(mapleInput("src/content/maple/hello-world.md")),
    ).toBe(true);
  });

  test("accepts with absolute path prefix", () => {
    expect(
      MapleAudioRegen.accepts(
        mapleInput("/Users/hogers/Projects/ianhogers.dev/src/content/maple/my-article.md"),
      ),
    ).toBe(true);
  });

  test("rejects non-maple content files", () => {
    expect(
      MapleAudioRegen.accepts(mapleInput("src/content/dev/some-post.md")),
    ).toBe(false);
  });

  test("rejects non-markdown files in maple dir", () => {
    expect(
      MapleAudioRegen.accepts(mapleInput("src/content/maple/hello-world.ts")),
    ).toBe(false);
  });

  test("rejects subdirectories of maple", () => {
    expect(
      MapleAudioRegen.accepts(mapleInput("src/content/maple/drafts/hello-world.md")),
    ).toBe(false);
  });

  test("rejects svelte components", () => {
    expect(
      MapleAudioRegen.accepts(mapleInput("src/components/MapleAudioPlayer.svelte")),
    ).toBe(false);
  });

  test("rejects missing file_path", () => {
    expect(
      MapleAudioRegen.accepts({ tool_name: "Edit", tool_input: {} }),
    ).toBe(false);
  });

  test("rejects null tool_input", () => {
    expect(
      MapleAudioRegen.accepts({ tool_name: "Edit", tool_input: null as unknown as Record<string, unknown> }),
    ).toBe(false);
  });
});

// ─── Contract: execute() ─────────────────────────────────────────────────────

describe("MapleAudioRegen.execute", () => {
  test("spawns regen when Kokoro is healthy", async () => {
    let spawnedSlug = "";
    const deps = mockDeps({
      checkHealth: async () => true,
      spawnRegen: (_dir, slug) => { spawnedSlug = slug; },
    });

    const result = await MapleAudioRegen.execute(
      mapleInput("src/content/maple/hello-world.md"),
      deps,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additionalContext).toContain("hello-world");
    }
    expect(spawnedSlug).toBe("hello-world");
  });

  test("returns continue without regen when Kokoro is down", async () => {
    let spawned = false;
    const stderrMessages: string[] = [];
    const deps = mockDeps({
      checkHealth: async () => false,
      spawnRegen: () => { spawned = true; },
      stderr: (msg) => stderrMessages.push(msg),
    });

    const result = await MapleAudioRegen.execute(
      mapleInput("src/content/maple/hello-world.md"),
      deps,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additionalContext).toBeUndefined();
    }
    expect(spawned).toBe(false);
    expect(stderrMessages.some((m) => m.includes("Kokoro TTS not running"))).toBe(true);
  });

  test("extracts correct slug from path", async () => {
    let spawnedSlug = "";
    const deps = mockDeps({
      spawnRegen: (_dir, slug) => { spawnedSlug = slug; },
    });

    await MapleAudioRegen.execute(
      mapleInput("/Users/hogers/Projects/ianhogers.dev/src/content/maple/stop-hook-standoff.md"),
      deps,
    );

    expect(spawnedSlug).toBe("stop-hook-standoff");
  });

  test("passes projectDir to spawnRegen", async () => {
    let spawnedDir = "";
    const deps = mockDeps({
      projectDir: "/custom/project/dir",
      spawnRegen: (dir) => { spawnedDir = dir; },
    });

    await MapleAudioRegen.execute(
      mapleInput("src/content/maple/test.md"),
      deps,
    );

    expect(spawnedDir).toBe("/custom/project/dir");
  });
});

// ─── Integration tests (subprocess) ─────────────────────────────────────────

const hookPath = join(import.meta.dir, "maple-audio-regen.ts");

async function runHook(stdin: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", hookPath], {
    stdin: new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
    cwd: "/Users/hogers/Projects/ianhogers.dev",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

describe("hook integration", () => {
  test("returns continue for empty stdin", async () => {
    const { stdout } = await runHook("");
    expect(JSON.parse(stdout)).toEqual({ continue: true });
  });

  test("returns continue for non-maple file", async () => {
    const input = JSON.stringify({
      tool_name: "Edit",
      tool_input: { file_path: "/Users/hogers/Projects/ianhogers.dev/src/components/Foo.svelte" },
      session_id: "test",
    });
    const { stdout } = await runHook(input);
    expect(JSON.parse(stdout)).toEqual({ continue: true });
  });

  test("returns continue for malformed JSON", async () => {
    const { stdout } = await runHook("{not valid json");
    expect(JSON.parse(stdout)).toEqual({ continue: true });
  });

  test("returns continue for object without tool_input", async () => {
    const input = JSON.stringify({ tool_name: "Edit", session_id: "test" });
    const { stdout } = await runHook(input);
    expect(JSON.parse(stdout)).toEqual({ continue: true });
  });

  test("handles maple file edit (response depends on Kokoro status)", async () => {
    const input = JSON.stringify({
      tool_name: "Edit",
      tool_input: {
        file_path: "/Users/hogers/Projects/ianhogers.dev/src/content/maple/hello-world.md",
      },
      session_id: "test",
    });
    const { stdout, stderr } = await runHook(input);
    const parsed = JSON.parse(stdout);

    const kokoroRunning = !stderr.includes("Kokoro TTS not running");

    if (kokoroRunning) {
      expect(parsed.hookSpecificOutput.additionalContext).toContain("hello-world");
      expect(parsed.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    } else {
      expect(parsed).toEqual({ continue: true });
      expect(stderr).toContain("hello-world");
    }
  });

  test("exits with code 0 in all cases", async () => {
    const cases = [
      "",
      "not json",
      JSON.stringify({ tool_name: "Edit", session_id: "t" }),
      JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: "src/content/maple/test-slug.md" },
        session_id: "t",
      }),
    ];

    for (const input of cases) {
      const { exitCode } = await runHook(input);
      expect(exitCode).toBe(0);
    }
  });
});
