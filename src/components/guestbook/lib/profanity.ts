import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import type { ProfanityFlag } from "./types";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function detectProfanity(
  text: string,
  currentStickerPool: string[],
): ProfanityFlag[] {
  const matches = matcher.getAllMatches(text, true);

  return matches.map((match) => {
    const word = text.slice(match.startIndex, match.endIndex + 1);
    return {
      word,
      charStart: match.startIndex,
      charEnd: match.endIndex + 1,
      stickerPool: [...currentStickerPool],
    };
  });
}
