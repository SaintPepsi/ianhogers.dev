# Language & Skills Grid - RuneScape Style

## XP Curve (based on RS, mapped to hours)

| Level | Hours | Meaning |
|-------|-------|---------|
| 99 | ~55,000 | Lifetime native / mastery |
| 92 | ~27,500 | Halfway to 99 (~15 years daily) |
| 80 | ~10,000 | Fluent professional |
| 60 | ~3,000 | Solid conversational |
| 40 | ~1,000 | Getting by, beyond basics |
| 20 | ~200 | Beginner, basics |
| 1 | ~10 | "I know how to say beer" |

Level 92 is the halfway point, just like real RuneScape.

## Ian's Languages (spoken)

| Language | Estimated Hours | Level | Notes |
|----------|----------------|-------|-------|
| Dutch | TBD | TBD | Native, grew up in NL, reduced use after moving to AU |
| English | TBD | TBD | Daily use in Australia, work language |
| Portuguese (BR) | TBD | TBD | TBD |

## Ian's Languages (programming)

| Language | Estimated Hours | Level | Notes |
|----------|----------------|-------|-------|
| JavaScript/TypeScript | ~15 years | TBD | Primary language, professional |
| C# | ~100 hrs | TBD | Dabbled |
| Rust | TBD | TBD | spiral-core project |
| Svelte | TBD | TBD | Multiple packages published |
| PHP/Laravel | TBD | TBD | Katana built on this? |
| GDScript | TBD | TBD | Glint Potential |
| CSS | TBD | TBD | |
| SQL | TBD | TBD | |
| HTML | TBD | TBD | |

## How to update

Ian can message Lordgenome with hour updates like:
- "Add 8 hours to JavaScript"
- "I've done about 500 hours of Rust total"
- "Set PHP to 6000 hours"

Lordgenome will:
1. Update this file with the new totals
2. Recalculate the level based on the XP curve
3. Update the website's data file (once built)

## Level calculation formula

Using a simplified RS-style exponential curve:
- level = floor(log(hours * 100) / log(1.1))
- Capped at 99
- Minimum level 1 (if any hours at all)

(Formula TBD - will refine when implementing to make sure the breakpoints above feel right)

## Visual Design (concept)

- Grid layout like RS skills tab (dark panel, gold borders)
- Each skill has a pixel art icon
- Skill name + level number
- Hover shows: hours logged, XP bar to next level, proficiency description
- "Total Level" at the bottom (sum of all levels)
- Spoken languages and programming languages in separate sections (or mixed like RS mixes combat/gathering/artisan)
- Pixel art style, fits the Neocities vibe

**Status: CONCEPT - not yet implemented. Waiting for Ian to fill in hour estimates.**
