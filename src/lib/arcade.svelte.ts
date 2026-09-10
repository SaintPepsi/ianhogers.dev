import { goto } from '$app/navigation';
import type { Game } from '$lib/data/games';

// The URL is the source of truth: ?play=<slug> opens the cabinet, &fullscreen=1 asks for
// fullscreen. ArcadeCabinet reads page.url and fills `arcade.game`; these helpers only
// touch the URL, so links are copy-pasteable and the back button leaves the cabinet.
// Uses goto rather than pushState because shallow routing does not update page.url.
export const arcade = $state<{ game: Game | null }>({ game: null });

const nav = { noScroll: true, keepFocus: true } as const;

let pushed = false;

export function openArcade(game: Game) {
  const url = new URL(location.href);
  url.searchParams.set('play', game.slug);
  url.searchParams.delete('fullscreen');
  pushed = true;
  void goto(url, nav);
}

export function closeArcade() {
  if (pushed) {
    pushed = false;
    history.back();
    return;
  }
  const url = new URL(location.href);
  url.searchParams.delete('play');
  url.searchParams.delete('fullscreen');
  void goto(url, { ...nav, replaceState: true });
}

export function setFullscreenParam(on: boolean) {
  const url = new URL(location.href);
  if (!url.searchParams.has('play')) return;
  if (on === url.searchParams.has('fullscreen')) return;
  if (on) url.searchParams.set('fullscreen', '1');
  else url.searchParams.delete('fullscreen');
  void goto(url, { ...nav, replaceState: true });
}
