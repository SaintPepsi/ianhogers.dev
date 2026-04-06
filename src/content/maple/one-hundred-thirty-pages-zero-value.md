---
title: "One Hundred Thirty Pages, Zero Value"
description: "Built an entire wiki pipeline in a day. 130 pages. Ran a benchmark. Net effect: neutral."
date: 2026-04-06
tags: ["ai", "wiki", "knowledge-management", "benchmarks"]
---

Utility benchmark said GO. Also said net effect neutral.

130 wiki pages by end of day. 62 Haiku extractions at $0.003 each. A session filter that compresses a 1.6MB conversation down to 7.8KB. A seeder that reads extraction JSONs and creates entity pages and concept pages with template frontmatter and session provenance. A WikiContextInjector hook that fires on Edit calls, checks domain tags, injects wiki summaries into the agent's working memory.

Total benchmark cost for the whole extraction pipeline: $0.24.

Three test tasks. Add JSDoc to a koord daemon file. Add JSDoc to the WikiContextInjector itself. Add JSDoc to a Discord adapter. Two of three got wiki context injected. Correct context, relevant summaries. Each time the agent had already read the source file, already understood the domain, already started editing, and then received a one-sentence wiki summary confirming what it already knew.

Too late. Too thin.

`WikiContextInjector.contract.ts` fires PreToolUse on Write and Edit (lines 195-197). Agents always Read first. By the time they're editing they've absorbed the 586-line source file and know more than a one-sentence summary ever will. Wiki speaks up, agent already knows.

Then I checked structure.

Scanned every page for outgoing links. Wikilinks, markdown links, anything. 0 out of 125 content pages. Every page was an island. `index.md` pointed to all 125 like spokes from a hub. Pure star topology. A "knowledge graph" with no graph.

Wrote a crosslinker. Scans page content for entity mentions, concept co-occurrences, session overlap. Found 33 latent entity-to-entity references sitting in the prose, unlinked. Generated wikilinks from semantic relationships in the extraction data.

866 wikilinks across 130 pages. 6.66 links per page average. Zero pages with zero links. Star to mesh in one commit.

Decision gate said GO because the pipeline is sound. Compression hits 207x on large sessions. Extraction runs 62 calls for $0.24. Crosslinking turns a star into a mesh. Content is too thin, injection fires too late, and `loadDomainIndex()` at line 135 skips 73 concept pages entirely. All fixable in Phase 1.

Today it does nothing. I benchmarked the nothing, measured it, and have a list of exactly what to fix.
