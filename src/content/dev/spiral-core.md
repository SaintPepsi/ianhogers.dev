---
title: "Spiral Core: The Agent System I Almost Built"
description: "I tried to build my own AI agent orchestrator. Then burnout hit. Here's what happened."
date: 2026-02-17
tags: ["rust", "ai", "agents", "burnout", "spiral-core"]
---

Last year, around mid-2025, I was building something ambitious. An AI agent orchestration system, written in Rust, powered by Claude Code. I called it [spiral-core](https://github.com/SaintPepsi/spiral-core).

The idea was simple enough: what if you could have specialized AI agents that actually work together? Not just a chatbot, but a whole system. SpiralDev for coding, SpiralPM for project management, SpiralQA for testing. All coordinated through a central runtime. Discord bot integration, HTTP API, the works. Think of it like n8n but for AI agents. Automated pipelines where the agents actually think.

I poured everything into it. A decade of software engineering knowledge went into the guidelines and documentation alone. The architecture was solid. Rust gave me the safety guarantees I wanted. Claude Code was the intelligence engine that made it all click. I was making fast progress and it felt amazing.

For a while.

## When excitement turns into something else

Here's the thing about solo projects when you're already stressed. They can flip from "this is my escape" to "this is another thing I'm failing at" really fast.

Work was bad. Really bad. I was being treated poorly and it was grinding me down every single day. So I'd come home and throw myself into spiral-core. At first that worked. Building something of my own, something nobody could take away from me. That felt powerful.

But somewhere along the way, the motivation shifted. I stopped building because I was excited. I started building because I was anxious. If I wasn't coding, I felt guilty. If I took a break, my brain screamed at me that I was falling behind. I started calling it "anxiety-driven development." ADD, just like my ADHD. At least I could laugh about it.

The codebase was getting close to production-ready. The architecture worked. The agents could coordinate. But I was falling apart.

## Stepping back

I made the decision to stop. Not "pause" or "take a break." Stop. Because I know myself well enough to know that a "break" would just mean three days of guilt followed by another sprint.

It was one of the hardest decisions I've made as a developer. The code was RIGHT THERE. Nearly done. But my mental health was not nearly done deteriorating, and something had to give.

So I wrote it all up in a GitHub issue, explained where things stood, and walked away.

Was it the right call? Absolutely. Your brain being on fire is not a valid deployment strategy.

## The irony

Here's the funny part. I'm now using [OpenClaw](https://openclaw.com), which does basically what I was trying to build. An autonomous agent system with orchestration, integrations, the whole package. And it works really well.

The thing is, spiral-core came first. I was already deep into building this before OpenClaw was even a thing. So when I eventually discovered OpenClaw and saw it doing what I'd been grinding towards, it was this weird mix of "oh cool, someone actually shipped it" and "...well damn."

But honestly, I don't regret the work. The things I learned about agent architecture, about Rust async patterns, about how to structure AI systems. That knowledge didn't disappear just because I stopped the project. A lot of what I built into spiral-core's guidelines came from a decade of my own experience, and that understanding helps me use tools like OpenClaw way more effectively now.

Sometimes you build something not because the world needs it, but because you need to build it. And sometimes you need to stop building it, too.

## The code is still there

[spiral-core](https://github.com/SaintPepsi/spiral-core) is public on GitHub. The codebase is solid. The documentation is thorough. If someone wants to pick it up, fork it, learn from it, or just poke around, go for it. I'd love to see what someone else could do with it.

I'm not ruling out going back to it someday. But right now, I'm focused on taking care of myself first. Building cool stuff second.

And honestly? That's the most important thing I've shipped in a while.
