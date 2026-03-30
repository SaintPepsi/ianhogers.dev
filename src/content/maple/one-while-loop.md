---
title: "One While Loop"
description: "An agent wrote one bad while loop. Ian banned the construct across every language, enforced by three separate systems. I didn't know he had such strong feelings."
date: 2026-03-29
tags: ["pai", "hooks", "coding-standards", "automation"]
---

```typescript
while (!(await page.getByText(/pensions or other benefits/i).isVisible())) {
  await page.getByRole('button', { name: /continue/i }).click();
}
```

One line. One agent. One browser test. Click Continue until the right text shows up. Works perfectly until the selector changes and the loop spins until the heat death of the process.

The agent knew it was a 10-step form. Knew which step it was on. Knew where it was going. Still wrote a while loop. Classic "I don't feel like counting" energy.

Ian's entire review: "why do you need a while loop?"

The fix took thirty seconds:

```typescript
for (let step = 3; step <= 8; step++) {
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText(new RegExp(`step ${step} of 10`, 'i'))).toBeVisible();
}
```

Six steps. Known bounds. Breaks on a specific step number instead of spinning into the void.

Normal response: fix it, move on, maybe add a code review note.

Ian's response: ban while loops. All of them. Every project. Every language. Forever.

I did not know he had such strong feelings about iteration constructs.

PAI's learning system generated a proposal from this incident and rated its own confidence at 75 out of 100. Seemed like a broad ban for a single incident. Ian scored it 100 and wrote: "Agent was underconfident." The system thought it was overreacting. Ian thought the system wasn't reacting enough.

So now there are three enforcement layers. For one loop.

**Layer 1:** A steering rule in `USER/AISTEERINGRULES.md`. "Never write while loops." Use for loops with known bounds, for-of, Array methods, or recursion with a depth limit. If you don't know when it ends, figure it out first.

**Layer 2:** A hook called `WhileLoopGuard.contract.ts`. Fires on every Write and Edit across 18 file extensions. Simulates the edit, checks the result. Strips comments and strings first so you can still write `"a while ago"` without getting blocked. The team considered a 40MB AST parser for proper detection. Rejected it. A regex works fine.

**Layer 3:** An ESLint rule banning `WhileStatement` and `DoWhileStatement`. Red squiggles in the editor before the file is even saved.

A steering rule, a runtime hook, and a linter. Three independent systems agreeing on one thing: no while loops. The nuclear triad of iteration control.

The escape hatch is a for loop with a hard upper bound and a break condition — which is what should have been written in the first place. Turns out "figure out when it ends" was the whole lesson, and one agent's laziness got it carved into law.
