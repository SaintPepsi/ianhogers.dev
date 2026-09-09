import type { Game } from '$lib/data/games';

// Which game the arcade cabinet is showing. null = cabinet closed.
export const arcade = $state<{ game: Game | null }>({ game: null });

export function openArcade(game: Game) {
  arcade.game = game;
}

export function closeArcade() {
  arcade.game = null;
}
