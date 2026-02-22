---
title: "Math.random()"
description: "A conversation about determinism changed how I think about AI coding. Then I found PAI."
date: 2026-02-22
tags: ["ai", "agents", "pai", "workflow", "claude-code"]
---

A tech lead on my team said something that stuck with me. We were talking about AI agents, how they work, whether they're actually reliable. His take was simple: "It's `Math.random()`."

He was right. Programming is deterministic. You write a function, it does the thing, every time. LLMs are not that. Sometimes the output is brilliant. Sometimes it hallucinates a test that just wraps everything in an if-true so it passes. You prompt the same thing twice and get two different results. That's the fundamental tension, and most people either ignore it or complain about it.

I went home thinking about that conversation. And it led me somewhere I didn't expect.

## The wrapper I almost ignored

I'd seen [PAI](https://github.com/danielmiessler/PAI) floating around before. First impression: someone wrapped Claude and made it look pretty. Cool, I guess. Not for me.

But the creator had a video where he talked about the philosophy behind it. Not just what it does, but why it's built the way it's built. I half-watched it the first time. Didn't think much of it.

Then that conversation about determinism happened.

I went back to the video. Watched it properly. And suddenly I was hearing something different. This wasn't a wrapper. This was a structured system for making LLM outputs consistent. Deterministic steps that the model follows every single time. Observe the problem. Think about it. Plan. Build. Execute. Verify. Learn. Every task, same structure, same rigour.

That's when it clicked.

## What I was already trying to build

Here's the thing. I'd been chasing this exact idea for over a year.

Back in mid-2025, I was building [spiral-core](https://github.com/SaintPepsi/spiral-core). An AI agent orchestration system in Rust. The vision was exactly this: you pour in a prompt, an agent evaluates whether it's too vague, asks clarifying questions, then delegates to a mini team. A project manager, a developer, a QA agent. All coordinating, all structured.

I burned out before I finished it. The code was solid but my mental health wasn't.

Then I moved to [OpenClaw](https://openclaw.ai) and started using that for agent orchestration. One conversation stream, multiple projects, sub-agents handling the work. And it was good. Really good. But something was still off.

I was burning through tokens. The outputs were inconsistent. Sometimes brilliant, sometimes garbage. I tried [Obra superpowers](https://github.com/nichochar/obra-ai), which gives you a structured pattern: brainstorm, then plan in a new session, then execute with skills. It added stability. But it still wasn't complete.

So I built my own skill. A complete pipeline, end to end. And it was overbaked. The model would go through everything but forget things halfway through. I'd tweak the skill and suddenly it would stop doing things I expected. Back and forth, never really knowing what was actually optimising the prompting. That's the frustrating part. It's hard.

OpenClaw is a shotgun. Powerful, but scattered. PAI is a sniper. Precise, deliberate, same process every time.

## Day one

I set up PAI yesterday. Played with it a bit, realised the potential. Today I've been using it properly and it's been fantastic.

The difference is structural. When you prompt Claude Code directly, or through most wrappers, the model decides what to do. Maybe it'll plan first. Maybe it won't. Maybe it'll verify its work. Maybe it'll just say "done" and move on. You're trusting a non-deterministic system to be deterministic. That's the gap my tech lead was talking about.

PAI closes that gap. Every task goes through the same phases. It maps out ideal state criteria before it touches code. It thinks about what could go wrong. It plans. It builds. It runs verification. It learns. And because the structure is deterministic, even though the model inside isn't, the outputs are dramatically more consistent.

I feel like I have more control over what's happening. More understanding of how it's going to operate. With raw Claude Code, if I'm not watching, it might do something halfway through that I don't like. With PAI, I know it's going through the structure. I'm confident that when it reaches the end, there'll be notes for me to read, tests for me to run, verification to check. I can just go with that.

## The anxiety thing

I've written before about ADHD and anxiety-driven development. The constant checking. The inability to walk away. The context-switching headache.

The structure PAI provides actually helps with that. Not because it's magic, but because it's predictable. I know what phase it's in. I know what's coming next. I don't have to hover over it wondering if it's about to do something weird, because the system constrains the path. That predictability is calming in a way I didn't expect from a developer tool.

## The hard parts

The UI is overwhelming when you first open it. There's a lot going on and I didn't know what half of it meant. Some features, like the learning system, are scaffolded but not fully implemented yet. The creator has talked about having all the infrastructure for gathering learning data but not yet having the optimisation loop that uses it. That's interesting to know, and honest, which I appreciate.

It's still early. This is day one for me. I'm not writing from the other side. I'm writing from the beginning.

## Build things

One of PAI's principles is that because your agent has terminal access, you should build CLIs. Structured command-line tools that give agents rich, typed information to work with. So I did.

I built [PAI-tools](https://github.com/SaintPepsi/pai-tools), a TypeScript CLI with hard-typed structured commands. Right now it has one tool: `orchestrate`. It reads all the GitHub issues on a repository, figures out their dependencies and ordering, then systematically works through them one by one. Branching off master or an existing branch, actioning each issue, moving to the next. I'm testing it now on a [roguelike card game](https://rogue-like-cards.vercel.app/) I'm working on.

I built that on day one. One prompt to create a structured skill, and it worked.

## The actual point

I talk to a lot of developers who are skeptical about AI agents. They think it's hype. They've tried it, gotten garbage outputs, and written it off.

Those people are falling behind. Not because the models are perfect. They're not. But the tools being built around the models are advancing incredibly fast. Maybe the software engineering benchmarks plateau at 85% for a couple of years. That's fine. The tooling doesn't care about benchmarks. The tooling is solving the real problems: consistency, structure, verification, reliability.

And here's what I'd tell anyone frustrated with their current AI workflow: try things. Don't stick with one tool and decide that's your forever setup. Engage with the community. See where innovation is happening. See what people are complaining about and what they're solving. Often you'll find people linking their own implementations, their own skills, their own approaches. Maybe that sparks an idea for your own workflow.

If you think of a skill that would help you, just make it. It takes one prompt. If it helps your work, that's all the justification you need.

I went from dismissing PAI as a wrapper to rebuilding how I think about AI-assisted development. All because a tech lead said "`Math.random()`" and I couldn't stop thinking about it.
