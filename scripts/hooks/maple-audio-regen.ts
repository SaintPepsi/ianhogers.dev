#!/usr/bin/env bun
/**
 * Thin hook shell for MapleAudioRegen contract.
 * Reads stdin, runs contract pipeline, formats output.
 */

import { MapleAudioRegen } from "@scripts/hooks/contracts/MapleAudioRegen";

const CONTINUE = JSON.stringify({ continue: true });

function formatOutput(result: { type: "continue"; continue: true; additionalContext?: string }): string {
  if (result.additionalContext !== undefined) {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: result.additionalContext,
      },
    });
  }
  return CONTINUE;
}

async function main(): Promise<void> {
  const raw = await Bun.stdin.text();
  if (!raw.trim()) {
    process.stdout.write(CONTINUE);
    return;
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("tool_input" in parsed)) {
    process.stdout.write(CONTINUE);
    return;
  }

  if (!MapleAudioRegen.accepts(parsed)) {
    process.stdout.write(CONTINUE);
    return;
  }

  const result = await MapleAudioRegen.execute(parsed, MapleAudioRegen.defaultDeps);

  if (!result.ok) {
    process.stderr.write(`[MapleAudioRegen] error: ${result.error.message}\n`);
    process.stdout.write(CONTINUE);
    return;
  }

  process.stdout.write(formatOutput(result.value));
}

main().catch(() => {
  process.stdout.write(CONTINUE);
});
