# Projects Page — Floppy Disk Collection

**Date:** 2026-03-14
**Status:** Approved
**Route:** `/projects` (top-level) + `/projects/[slug]` (detail pages)

## Context

Ian wants a portfolio/showcase page for all his projects — published work, prototypes, experiments, and asset collections. The page uses a retro computing metaphor: floppy disks in a disk case for browsing, with a transition animation that inserts the selected disk into an old beige PC, booting the project on a CRT monitor.

Some projects live on an external hard drive and need to be imported before launch. The page should be designed for easy addition of new projects.

## Design

### Navigation

- New top-level nav item at `/projects`
- Pixel-art floppy disk icon in the nav bar (matching existing nav icon style)
- Added alongside About, Skills, Shoutouts, Guestbook, Maple's Corner

### Listing Page (`/projects/+page.svelte`)

- **Container:** Floppy disk organizer/case as the page frame
- **Disks:** Displayed in a grid, all uniform size (3.5" floppy proportions)
- **Labels:** Grand9KPixel font, colored per-project
  - Project name
  - Type indicator (tool / prototype / experiment / asset / research)
  - Year
- **Hover:** Disk slides up slightly with a subtle glow
- **Sort/filter:** By date created (default) or by type
- **Click:** Triggers transition animation to detail page

### Transition Animation (shelf → computer)

1. Clicked disk lifts out of the case
2. Disk case slides off-screen
3. Old beige PC appears (realistic retro style — chunky case, CRT monitor, keyboard)
4. Floppy inserts into the drive slot
5. CRT monitor flickers on — static/boot sequence
6. Project content loads on the screen
7. For interactive projects: CRT frame expands/dissolves, leaving full-viewport content
8. "Eject" button reverses the animation and returns to the disk case

Implementation: Svelte 5 view transitions or custom crossfade. Build iteratively — static shelf first, then layer animation.

### Detail Page (`/projects/[slug]/+page.svelte`)

- **Header:** Project name, creation date, tech stack tags, status badge
- **Description:** Project overview
- **Preview area** (varies by project type):
  - **Deployed web apps** → iframe to live URL (full-viewport after CRT dissolve)
  - **Standalone HTML files** → iframe to static file in `/static/projects/`
  - **CLI tools / libraries** → screenshot + README excerpt (stays in CRT frame)
  - **Hardware / research** → photo + writeup (stays in CRT frame)
  - **Asset collections** → sample grid preview (stays in CRT frame)
- **Links:** GitHub repo, live demo (where applicable)
- **Back/Eject:** Returns to disk case with reverse animation
- **CRT effects:** Scanline CSS overlay, subtle screen curve via box-shadow

### Data Model

```typescript
// src/lib/data/projects.ts

interface Project {
  slug: string;
  name: string;
  description: string;
  date: string;           // creation date (YYYY-MM-DD)
  tech: string[];          // tech stack tags
  type: 'tool' | 'prototype' | 'experiment' | 'asset' | 'research';
  status: 'active' | 'complete' | 'archived';
  previewType: 'iframe' | 'component' | 'screenshot' | 'grid';
  liveUrl?: string;        // live demo URL (for iframe embed)
  repoUrl?: string;        // GitHub repository URL
  diskColor: string;       // floppy disk label color
  thumbnail?: string;      // screenshot path for non-interactive projects
}
```

### Visual Style

- **CRT monitor:** Realistic retro style (not pixel-art) — wood grain or beige plastic, rounded glass screen, physical buttons/knobs
- **Floppy disks:** Pixel-art style matching site aesthetic, Grand9KPixel font on labels
- **Scanlines:** CSS repeating-linear-gradient overlay on CRT screen
- **Colors:** Site's existing palette — dark background (#121018), surface colors, side-specific accents
- **Animations:** CSS transforms/transitions for disk movement, Svelte transitions for page crossfade

### Known Projects (current inventory)

From `~/Projects/`:
1. **ianhogers.dev** — Personal website (SvelteKit, active)
2. **claude-code-replay** — Conversation log player (Vite/TS, deployed on GitHub Pages)
3. **pai-hooks** — Claude Code hooks library (Bun/TS, active)
4. **draad** — P2P agent messaging framework (TS/Node, active)
5. **claude-on-blackberry** — Claude on a BlackBerry Priv (research, complete)
6. **pixelart-app-icons-small-24x24** — 137 pixel art app icons (asset)
7. **items** — 927 game item sprites (asset)
8. **CSS Sprite-Based Flip Carousel** — CSS scroll-timeline demo (standalone HTML)

Additional projects on external hard drive — TBD.

## Anti-Requirements

- No Netflix-style horizontal scroll rows
- No varied disk sizes — all uniform 3.5" floppy proportions
- No passive TV metaphor — computer metaphor for interactive content
- Don't launch until external drive projects are imported

## Success Criteria

- Projects page is accessible from main nav
- All projects displayed as floppy disks with clear labels
- Clicking a disk navigates to a detail page with project info
- Interactive projects render full-viewport after CRT transition
- Non-interactive projects display within CRT frame with screenshots
- Transition animation feels smooth and retro
- Easy to add new projects by editing the data file
- Visual style consistent with site's pixel-art aesthetic
