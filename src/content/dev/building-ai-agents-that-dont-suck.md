---
title: "Building AI Agents That Don't Suck"
description: "Notes on what actually works when you're wiring up LLMs to do useful things."
date: 2026-02-17
tags: ["ai", "agents", "engineering"]
draft: false
---

Everyone's building agents right now. Most of them are bad. Here's what I've learned so far about making ones that actually work.

## Keep the loop tight

The more steps between "user wants a thing" and "the thing happens," the more chances for failure. Every tool call is a coin flip. Reduce the flips.

## Don't trust the model's confidence

LLMs will confidently tell you they've done something they haven't. Always verify outputs programmatically. If the model says it wrote a file, check that the file exists and has the right content.

## Error handling is the whole game

The happy path is easy. The interesting engineering is in what happens when the model hallucinates a function name, returns malformed JSON, or gets stuck in a loop. Build recovery into everything.

## Start dumb, get smart

Your first version should be embarrassingly simple. One model, one tool, one loop. Get that working perfectly before you add retrieval, planning, multi-agent orchestration, or whatever the latest paper says you need.

That's it for now. More notes as I break things and fix them.
