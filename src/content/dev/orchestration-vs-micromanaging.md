---
title: "Three Tabs and a Headache"
description: "How I went from babysitting AI agents to just talking."
date: 2026-02-20
tags: ["ai", "agents", "orchestration", "workflow"]
---

Three separate Claude instances running on different projects. I'm tabbing between them. I think I'm keeping up. I slept poorly. My head is hurting. The insomnia has been bad this week and I'm running on coffee and stubbornness.

One agent is rewriting a component. Another is fixing tests I broke yesterday. The third is... I alt-tab to it and I genuinely can't remember what I asked it to do. I re-read the context. Thirty seconds gone. I tab back to the first one and it's made a decision I disagree with. I correct it, tab to the second, and the tests are failing for a different reason now.

This is me orchestrating. Except it's not orchestrating. It's just stress with extra screens.

## The part nobody talks about

Everyone writes about AI agents like they're magic. "Just prompt it and walk away." Cool. Except my brain won't let me walk away. ADHD means I need to check. Anxiety means I need to verify. And the combination means I'm context-switching every forty-five seconds, retaining nothing, and somehow ending the day exhausted despite the AI doing most of the actual work.

The bandwidth isn't the AI's. It's mine. I'm the bottleneck. I'm the slow, anxious, sleep-deprived router trying to keep three fast machines pointed in the right direction.

## What actually helped

I stopped being the router.

Instead of managing three separate agents, I set up [OpenClaw](https://openclaw.ai), an agent orchestration platform that lets you talk to one persistent agent over Telegram, Discord, whatever. Just... talking. Like a conversation. "The border is clipping on the website." "Token usage feels high, look into it." "Write an article about this." "Oh and the cursor is broken on mobile."

All different projects. All different concerns. One stream of consciousness. I didn't open a new tab. I didn't frame a careful prompt. I just said what was on my mind and it got handled.

The first time it clicked, the relief was physical. Like putting down a bag I didn't realise I was carrying.

## Anyway here's Wonderwall

This week I sat down and just started talking. Fixed a CSS border bug that had been annoying me. Got token usage data that explained why my bill felt wrong. Added skills to my website. Wrote this article. Fixed cursor behaviour on mobile. All in one sitting, one conversation, no tab-switching.

I didn't plan that session. I didn't write a task list. I just brought up whatever was on my mind, and things happened. OpenClaw figured out which project, which files, which context. It spawned sub-agents for the heavy lifting. I just kept thinking out loud.

That's what it's supposed to feel like. Not managing. Just thinking.

## I'm still bad at this

I want to be real. I'm not writing this from the other side. I'm writing this from the middle.

Some days I nail it. Thoughts flow, things get built, I barely think about the process. Other days I fall straight back into old habits. Too many tabs. Scoping too loosely. Watching an agent loop for fifteen minutes because I forgot to set a limit.

I still burn through tokens running Opus when Sonnet would do the job. I still catch myself hovering over outputs when I should be doing literally anything else.

But I can feel the difference now. I know when I'm orchestrating and when I'm babysitting. That awareness didn't exist six months ago. Back then it was all babysitting and I didn't even know it.

## The bill

Here's the part that stings.

OpenClaw runs on tokens. Every message, every sub-agent, every heartbeat check. Tokens. And when you're running Opus on a 200k context window, those tokens are not cheap. That's the trade-off you accept. Convenience costs.

But then I hit "API LIMIT REACHED." On a MAX 20x subscription. I hadn't even been using it that hard. I figured I was being wasteful. Running Opus when I should've been on Sonnet, not scoping sub-agents tightly enough, the usual.

Turns out it was a [bug](https://github.com/openclaw/openclaw/pull/20597).

A recent update started injecting per-message metadata into the system prompt. Things like message IDs that change on every single turn. Anthropic's prompt caching is prefix-based, so if the system prompt changes, the entire cache gets invalidated. Every message was rewriting 100,000+ tokens from scratch instead of the normal 1,000-2,000 token delta. Daily cache-write costs went from around $0.44 to over $84. On a single user. Running normally.

I wasn't burning tokens. The platform was. Silently, on every turn, for days.

The frustration isn't the money. Well, it's partly the money. But it's the feeling of hitting a wall and blaming yourself, only to find out the floor was on fire the whole time. I was adjusting my behaviour, switching to Sonnet for things that needed Opus, cutting back on heartbeats, scoping agents more carefully. All good habits, sure. But none of it would have mattered because the real cost was invisible.

The fix is in review and it's a clean one. Move the volatile data out of the system prompt, keep the cache stable. Simple. The kind of bug that's obvious in hindsight and invisible until someone notices the numbers don't add up.

Still a good experiment. I learned more about how token economics actually work in one frustrating afternoon than I would have in a month of normal usage. But it's a real reminder: when you're building on top of someone else's platform, their bugs become your budget.

## The point

I'm not here to tell anyone how to use AI agents. I'm still figuring it out myself. But the shift from "I manage the agents" to "I talk and things happen" changed how my days feel. Less dread. Less tab-switching. Less of that specific headache you get from context-switching all day.

On the days it clicks, I finish work and I'm not exhausted. That's new. That's worth writing about.

I'm not there every day yet. But on the days it clicks, it really clicks.
