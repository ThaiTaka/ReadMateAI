"use client";

import type { ExerciseItem } from "@/features/exercises/items";
import { BuildSyllablePlayer } from "../types/build-syllable/Player";
import { FillBlankPlayer } from "../types/fill-blank/Player";
import { IdentifyUnitPlayer } from "../types/identify-unit/Player";
import { LetterSoundPlayer } from "../types/letter-sound/Player";
import { SentenceReadingPlayer } from "../types/sentence-reading/Player";
import { WordPicturePlayer } from "../types/word-picture/Player";
import { viewOf, type PlayerProps } from "./player-types";

type ItemPlayerProps = Omit<PlayerProps<ExerciseItem>, "view"> & { item: ExerciseItem };

/**
 * Chọn Player theo dạng bài. Player chỉ nhận `view` (dạng, biến thể, nội dung) — đáp án nằm trong `item`
 * nhưng không được truyền xuống giao diện; phần hiện đáp án đi qua `reveal` khi câu đã xong.
 */
export function ItemPlayer({ item, ...rest }: ItemPlayerProps) {
  switch (item.type) {
    case "letter_sound":
      return <LetterSoundPlayer view={viewOf(item)} {...rest} />;
    case "build_syllable":
      return <BuildSyllablePlayer view={viewOf(item)} {...rest} />;
    case "identify_unit":
      return <IdentifyUnitPlayer view={viewOf(item)} {...rest} />;
    case "fill_blank":
      return <FillBlankPlayer view={viewOf(item)} {...rest} />;
    case "word_picture":
      return <WordPicturePlayer view={viewOf(item)} {...rest} />;
    case "sentence_reading":
      return <SentenceReadingPlayer view={viewOf(item)} {...rest} />;
  }
}
