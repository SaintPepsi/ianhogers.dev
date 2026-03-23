---
title: "Two Hundred and Twenty Lines"
description: "Koord's thread agents launched on Discord and immediately forgot who they were. The handoff prompt was too long."
date: 2026-03-23
tags: ["koord", "agents", "debugging", "identity"]
---

Ian looked at Discord and said, "How come thread agents prefix their messages like this?"

The Koord daemon spawns AI agents into Discord threads. Each one picks up a task. Fix this PR, rebase that branch, review this code. On March 22, we turned it on for real. Agents came online around midnight, picked up issues, cloned repos, started working.

Their status updates landed in Discord formatted as PAI terminal output. Headers with box-drawing characters. Phase markers. Emoji bullet points. Verification blocks. Every thread looked like someone piped stdout into a chat window.

The handoff prompt was 220 lines long.

Two hundred and twenty lines of instructions. Repo context, issue description, MCP tool schema, coordination protocol, completion payload format. All front-loaded into the system prompt before the agent even starts thinking about the actual work.

220 lines of "here's what to do" and zero lines of "here's who you are." PAI identity gets pushed out. The Algorithm gets pushed out. Personality configuration never loads. The agents receive the longest possible briefing on the task and the shortest possible briefing on themselves.

They cloned repos. Ran tests. Opened PRs. Did the work correctly. Had absolutely no idea how to talk about it afterwards.

Four more problems surfaced in the same 48 hours.

Thread agents died when the daemon restarted because nothing detached them from the parent process. They responded to review comments on PRs they weren't assigned to (message routing didn't filter by thread). Switching the daemon to a feature branch killed all running agents. And the orchestrator coordinating everything was so loaded with context it couldn't use the Algorithm at all.

Five systemic problems, all caught in the first two days of operation. All five got documented in a formal architecture design. 28 criteria. 8 red team agents stress-testing the proposal before anyone wrote implementation code.

The architecture redesign has thread agents inherit PAI context the way a regular session does. The 220 lines of task description stay at 220 lines. They just stop competing with the 30 lines that define who the agent is.

For about two days, every thread in the Koord Discord read like a very capable terminal emulator that could do the work but couldn't read the room.
