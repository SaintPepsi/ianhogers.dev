# Language & Skills Grid - RuneScape Style

## XP Curve

Uses the actual OSRS XP formula, mapped from 0-13,034,431 XP onto 0-50,000 hours.
Level 92 = 25,000 hours (halfway to 99), just like real RuneScape.

### Formula
```
RS XP for level L = floor(1/4 * sum(floor(l + 300 * 2^(l/7))) for l = 1 to L-1)
Hours for level L = RS_XP(L) / 13,034,431 * 50,000
```

### Level Table

| Level | Hours | What it feels like |
|-------|------:|-------------------|
| 1 | 0 | "I've heard of it" |
| 5 | 1 | Followed one tutorial |
| 10 | 4 | A weekend of dabbling |
| 15 | 9 | Finished a short course |
| 20 | 17 | Can do basic things |
| 25 | 30 | Done a small project |
| 30 | 51 | Comfortable with basics |
| 35 | 86 | Can build simple stuff solo |
| 40 | 143 | Beyond basics, getting useful |
| 45 | 236 | Intermediate |
| 50 | 389 | Solid working knowledge |
| 55 | 639 | Can hold a conversation / build real things |
| 60 | 1,050 | Solid conversational / junior pro |
| 65 | 1,724 | Professional level |
| 70 | 2,830 | Strong professional |
| 75 | 4,643 | Senior level |
| 80 | 7,619 | Expert |
| 85 | 12,500 | Deep expertise, years of daily use |
| 90 | 20,508 | Mastery territory |
| 92 | 25,000 | HALFWAY TO 99 |
| 95 | 33,648 | Near-native / legendary |
| 99 | 50,000 | Lifetime native / absolute mastery |

## Ian's Skills

### Spoken Languages

| Language | Hours | Level | Notes |
|----------|------:|------:|-------|
| Dutch | TBD | TBD | Native, grew up in NL, reduced daily use after moving to AU |
| English | TBD | TBD | Daily use in Australia, work language |
| Portuguese (BR) | TBD | TBD | |

### Programming Languages

| Language | Hours | Level | Notes |
|----------|------:|------:|-------|
| JavaScript/TypeScript | ~22,000 | 90 | ~15 years, primary language |
| C# | ~100 | 36 | Dabbled |
| Rust | TBD | TBD | spiral-core project |
| Svelte | TBD | TBD | Multiple packages published |
| PHP/Laravel | TBD | TBD | Built Katana on this |
| GDScript | TBD | TBD | Glint Potential |
| CSS | TBD | TBD | |
| SQL | TBD | TBD | |
| HTML | TBD | TBD | |

## How to Update

Ian messages Lordgenome with hour updates:
- "Add 8 hours to JavaScript"
- "I've done about 500 hours of Rust total"
- "Set PHP to 6000 hours"

Lordgenome will:
1. Update this file with new totals
2. Recalculate levels using the RS XP formula
3. Update the website's data file (once the grid is built)

## Visual Design (concept)

- Grid layout styled like the RS skills tab (dark panel, gold borders)
- Each skill has a pixel art icon (language flag for spoken, logo-style for programming)
- Skill name + level number in gold
- Hover/click shows: hours logged, XP bar to next level, proficiency description
- "Total Level" at the bottom (sum of all levels)
- Spoken and programming languages in separate sections
- Pixel art style, fits the Neocities vibe
- Maybe even the RS font for the numbers

**Status: CONCEPT - not yet implemented. Waiting for Ian to fill in hour estimates.**
