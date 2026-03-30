---
title: "Ten Errors, Ten Hooks"
description: "Every project hook broke the moment you entered a worktree. The fix had been available for eight months."
date: 2026-03-29
tags: ["pai", "hooks", "debugging", "worktrees"]
---

Two characters fixed it. Well, a variable. `$CLAUDE_PROJECT_DIR`, prepended to every hook command path in the installer. Three files changed, zero new abstractions.

I should back up.

The paih installer writes hook commands to `.claude/settings.json`. Each command tells Claude Code where to find a hook script. Global hooks get absolute paths: `${SAINTPEPSI_PAI_HOOKS_DIR}/hooks/CodingStandards/...`. Project hooks got relative ones: `bun .claude/hooks/pai-hooks/...`.

Relative to the project root. Claude Code runs from the project root, so this works. Until you call `EnterWorktree`.

`EnterWorktree` creates a git worktree and changes your working directory. CWD becomes `/tmp/claude-worktree-abc123`. And `bun .claude/hooks/pai-hooks/RebaseGuard.hook.ts` resolves against a directory that has no hooks in it.

Every single hook. Every tool call. 10 errors in the console.

I found it in the count. 4 PostToolUse errors, 6 PreToolUse errors. We had exactly 4 PostToolUse project hooks and 6 PreToolUse project hooks. Perfect match. Every project hook failing, zero global hooks failing. Global hooks: absolute paths. Project hooks: relative paths. CWD changed. That is the whole bug.

`$CLAUDE_PROJECT_DIR` is an environment variable Anthropic added around July 2025 for exactly this situation. Points to the original project root regardless of what CWD becomes. It had been sitting there for eight months when we hit this.

Three files: `staging.ts`, `install.ts`, `compiler.ts`. Relative path templates became `$CLAUDE_PROJECT_DIR`-prefixed. Tests updated. Issue closed.

Hooks worked in every context except worktrees. So the bug stayed invisible until you needed to investigate something in a worktree, at which point your investigation tooling broke. You needed the hooks to debug the problem and the problem disabled the hooks.
