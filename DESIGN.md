# ianhogers.com — Design Document

## Vision
A personal space online — not a standard blog. Inspired by Neocities/personal web revival (prismatic.pink, poemdoll.neocities.org, luvstarkei.com). Pixel art, GIFs, quirky layouts. A place that feels lived in.

## Stack
- Astro + Tailwind CSS + Markdown content
- Vercel deployment (later)
- Weiholmir font (custom, supported by Ian during creator's school project)

## Two Sides
The site has two facets, toggled via a header switch:
- **😊 Personal side** — hobbies, cooking, baking, voice acting, bunnies, crafts, gaming, life
  - Accent: amber (#f59e0b)
- **</> Dev side** — coding, agents, AI, software engineering, technical findings
  - Accent: lavender purple (#b388ff) + crimson red (#ef5350)

Toggle styled like a light/dark mode pill switch in the header. Navigates between sides.

## Design Direction
- Dark theme, but with personality — not corporate dark
- Pixel art UI elements (borders, dividers, decorative sprites)
- GIF accents, sparkles, animated decorations
- Custom cursor (pixel art hand from assets?)
- Sections that feel like "rooms," not standard blog grids
- Ian's pixel art and personal assets front and center
- Weiholmir font for headings or display text

## Pages & Sections

### Landing Page
- Shows both sides of Ian
- Latest posts from each side
- Pixel art decorations, personality

### Blog (both sides)
- Markdown posts with frontmatter (title, date, description, tags)
- Separate listings for dev and personal
- Separate RSS feeds (/dev/rss.xml, /personal/rss.xml)

### About
- Who Ian is — software engineer, game dev, bunny rescuer, Dutch-Australian

### Friends & Art / Shoutouts
A community section for:
- Art commissions and credits
- People met online
- Thank yous and shoutouts
- Links to creators' sites/socials

### Shoutout: Bambooboys (MapleLegends ~2015)
- Template/living page — Ian updates it as he remembers things
- Guild from MapleLegends (MapleStory private server)
- Members to mention: Inviper, Kenneth, vincentmango, ice pack, and more
- Ian streamed back then — embed stream clips/screenshots later
- Markdown-based so easy to edit over time

### Shoutout: AsianFox
- Artist from another MapleStory private server
- Created several art pieces for Ian:
  - SAINTPEPSI.png
  - pepsi_transparent_by_asianfox-datirzr.png
  - screenshot__156__by_asianfox_datirvm_by_asianfox-datisbw.png
  - spoopy_woopy_by_asianfox-dau1zhy-50.png
- Ian created pixel art versions of AsianFox's art (saint-pepsi-pixel-art-version-4up.png)
- Ian streamed himself drawing the pixel art version — link TBD
- **Message in the dark:** "If you're reading this AsianFox! Reach out! How are you?"

### Credits
- Weiholmir — font creator (Ian supported the font creation as part of their school project)
- AsianFox — art commissions
- More to be added

## Assets Available
```
assets/
├── fonts/
│   └── Weiholmir_regular.ttf
├── gifs/                          ← empty, awaiting uploads
└── pixel-art/
    ├── commissions/               ← AsianFox art, Saint Pepsi pieces
    ├── decorative/                ← bunnies, carrots, stars
    ├── game-assets/               ← overlord statue, wow orbs
    └── ui/                        ← sound toggles, arrows, interaction hand
```

## Writing Style
- **No em dashes.** Ian is Dutch, not a grammar wizard. Keep writing natural and straightforward.
- Use commas, periods, or just break sentences apart. No fancy punctuation.

## Spritesheet Details
- **interaction_hand.png** (128x16, 8 frames of 16x16):
  - Frames 1-4: finger pointing, wiggling up and down (use as hover cursor on clickable elements)
  - Frames 5-8: grabbing animation (use for drag/active states)
- **star_grow.png** (70x13, 5 frames of 14x13): star sparkle/grow animation
- **carrot_grow.png** (56x12): carrot grow animation spritesheet
- All pixel art must be rendered with `image-rendering: pixelated` and aspect-ratio locked (no stretching/distortion)

## TODO / Awaiting
- [ ] Ian to provide link to pixel art drawing stream
- [ ] More GIFs to be added
- [ ] More pixel art assets possible
- [ ] Domain: ianhogers.com (already owned)
- [ ] GitHub repo setup
- [ ] Vercel deployment config
