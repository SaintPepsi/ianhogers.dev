# Scripts

## generate-maple-audio.ts

Generates narration audio files for Maple's Corner articles using [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M).

**What it does:**
1. Reads each `.md` file in `src/content/maple/`
2. Extracts title and description from frontmatter, strips markdown body to plain text
3. Assembles narration text as: "Title. Description. Body..."
4. Sends paragraphs to the Kokoro TTS server (port 8889) for WAV generation
5. Concatenates paragraph WAVs into one file
6. Converts WAV → M4A (AAC 64kbps) via macOS `afconvert`
7. Writes to `public/audio/maple/{slug}.m4a`

**Prerequisites:**
- Kokoro TTS server running (`cd ~/.claude/VoiceServer && ./start.sh`)
- macOS (uses `afconvert` for WAV → M4A conversion)

**Usage:**
```bash
bun scripts/generate-maple-audio.ts                  # all articles
bun scripts/generate-maple-audio.ts hello-world      # specific article
bun scripts/generate-maple-audio.ts --force           # regenerate existing
```

**Voice:** `bf_emma` (British female). Override with `KOKORO_VOICE` env var.

**Output format:** M4A (AAC at 64kbps). A 3–4 minute article is ~1.5–2MB.

**Tests:** `bun test scripts/generate-maple-audio.test.ts`

---

## hooks/ — Claude Code Hooks

Project-specific Claude Code hooks. Follows PAI hook conventions (contract pattern, Deps injection).

### hooks/maple-audio-regen.ts

Thin shell for `MapleAudioRegen` contract. Reads stdin, runs the contract pipeline, formats output.

### hooks/contracts/MapleAudioRegen.ts

PostToolUse contract that auto-regenerates Maple audio when article markdown is edited.

**What it does:**
1. `accepts()` — matches Edit/Write of `src/content/maple/*.md` files
2. `execute()` — checks Kokoro TTS health, spawns `generate-maple-audio.ts {slug} --force` in background
3. Returns continue immediately so the edit is not blocked

**Deps interface (`MapleAudioRegenDeps`):**
- `checkHealth` — pings Kokoro TTS server
- `spawnRegen` — launches audio generation subprocess
- `stderr` — error logging
- `projectDir` — project root for locating scripts

**Configuration:** Project-specific settings at `.claude/settings.json` (committed to repo).

**Behavior:**
- Non-maple files: `accepts()` returns false, hook exits silently
- Kokoro not running: logs warning to stderr, returns continue
- Kokoro running: spawns regen in background, notifies via additionalContext

**Tests:** `bun test scripts/hooks/maple-audio-regen.test.ts`
