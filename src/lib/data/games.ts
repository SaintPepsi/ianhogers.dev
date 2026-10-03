export type Game = {
  slug: string;
  title: string;
  blurb: string;
  cover: string;
  play: string;
  /** URL that runs the game inside the arcade cabinet. Must allow being framed. */
  embed: string;
  source?: string;
  tags: string[];
  accent: 'crimson' | 'lavender' | 'amber' | 'maple';
  /** The game's own palette colour. Outlines the cabinet title. */
  theme: string;
  hint?: string;
};

export const games: Game[] = [
  {
    slug: 'clank-lit',
    title: 'Clank-lit',
    blurb:
      'You ask an AI agent for a wellness app. It talks you down to "a simple todo app to start", then adds feature after feature, beaming "All 52 tests passing" every time while search, delete and checkboxes quietly stop doing what you asked. Report a bug and it can\'t reproduce it. Maybe you misremembered.',
    cover: '/assets/games/clank-lit.webp',
    play: 'https://saintpepsi.github.io/clank-lit/',
    embed: 'https://saintpepsi.github.io/clank-lit/',
    source: 'https://github.com/SaintPepsi/clank-lit',
    tags: ['interactive piece', 'ai agents', 'gaslighting', 'single html file'],
    accent: 'crimson',
    theme: '#4ade80',
    hint: 'press ` in-game to see which bugs are live',
  },
  {
    slug: 'hey-siri-summarise-this',
    title: 'Hey Siri, Summarise this',
    blurb:
      'A satirical idle game where Siri summarises things you can already read, then summarises the summary. Numbers go up forever. It never gets better. That\'s the joke.',
    cover: '/assets/games/hey-siri-summarise-this.webp',
    play: 'https://sancoca.itch.io/hey-siri-summarise-this',
    embed: 'https://itch.io/embed-upload/17916070?color=1e1a28',
    tags: ['idle game', 'satire', 'itch.io'],
    accent: 'lavender',
    theme: '#2f8fff',
  },
  {
    slug: 'maple-arcade',
    title: "Maple's Arcade",
    blurb:
      'A cabinet of small realtime multiplayer experiments: watch everyone\'s cursors move together, draw on a shared canvas, hop between rooms. Built on my realtime-app-devkit: SpacetimeDB modules in TypeScript, the server always has the last say, clients just paint what it tells them.',
    cover: '/assets/games/maple-arcade.webp',
    play: 'https://realtime-app-devkit-ian-hogers-projects.vercel.app/',
    embed: 'https://realtime-app-devkit-ian-hogers-projects.vercel.app/',
    source: 'https://github.com/SaintPepsi/realtime-app-devkit',
    tags: ['realtime multiplayer', 'spacetimedb', 'sveltekit', 'devkit'],
    accent: 'maple',
    theme: '#ddb7ff',
    hint: 'open it in a second tab to meet yourself',
  },
  {
    slug: 'high-water',
    title: 'High Water',
    blurb:
      'Pick a real country, get its real GDP, and hold back a sea that never stops rising. Three buttons: build the wall higher, develop the economy behind it, or call another nation for help. Every metre the water climbs you pick a boon. None of them save you. The only question is what year it ends.',
    cover: '/assets/games/high-water.webp',
    play: '/games/high-water.html',
    embed: '/games/high-water.html',
    tags: ['3d strategy', 'roguelike', 'three.js', 'single html file'],
    accent: 'amber',
    theme: '#3fa2e6',
    hint: 'B build · D develop · A alert · space pauses',
  },
  {
    slug: 'one-door-urr',
    title: 'One Door Urr..',
    blurb:
      'One door closes, many more open. Every door wants something from you. The same door gets easier each time you go through it, and pays less for it. Some pay nothing however hard you push. Then one slams shut, and all you have to do is look around.',
    cover: '/assets/games/one-door-urr.webp',
    play: '/games/one-door-urr.html',
    embed: '/games/one-door-urr.html',
    tags: ['typing game', 'life', 'three.js', 'single html file'],
    accent: 'amber',
    theme: '#ffb38a',
  },
  {
    slug: 'kino-der-toten',
    title: 'Kino der Toten: Rift Edition',
    blurb:
      "Black Ops' Kino der Toten, rebuilt room by room and rule by rule: the same doors and prices, the Mystery Box and its teddy bear, the perks, the teleporter, Pack-a-Punch, hellhound rounds, crawlers in the roof. One change. The guns are gone. You hold the theatre as Amumu, Katarina or Master Yi, with their actual kits. See what round you reach.",
    cover: '/assets/games/kino-der-toten.webp',
    play: '/games/kino-der-toten/index.html',
    embed: '/games/kino-der-toten/index.html',
    tags: ['round-based zombies', 'league of legends', 'three.js', 'fan tribute'],
    accent: 'crimson',
    theme: '#c8aa6e',
    hint: 'WASD move · click attacks · RMB Shift E R cast · F buys',
  },
];
