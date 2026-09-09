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
  },
];
