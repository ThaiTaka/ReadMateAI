"use client";

import type { Response } from "@/features/exercises/core/primitives";
import type { ExerciseItem } from "@/features/exercises/items";
import { runtimeOf } from "@/features/exercises/runtime-registry";
import { BuildSyllablePlayer } from "@/features/exercises/types/build-syllable/Player";
import { FillBlankPlayer } from "@/features/exercises/types/fill-blank/Player";
import { IdentifyUnitPlayer } from "@/features/exercises/types/identify-unit/Player";
import { LetterSoundPlayer } from "@/features/exercises/types/letter-sound/Player";
import { SentenceReadingPlayer } from "@/features/exercises/types/sentence-reading/Player";
import { WordPicturePlayer } from "@/features/exercises/types/word-picture/Player";
import type { PlayerProps } from "@/features/exercises/ui/player-types";
import type { QuestionView } from "../types";

type ViewPlayerProps = Omit<PlayerProps<ExerciseItem>, "view"> & { view: QuestionView };

/**
 * Player của sáu dạng bài (GĐ4 — một dạng bài một khuôn, CLAUDE.md §7.8) cho chế độ CÓ ĐIỂM: chỉ nhận `view` từ máy
 * chủ (không có đáp án). Đáp án tới qua `reveal` khi câu đã đóng.
 */
export function ViewPlayer({ view, ...rest }: ViewPlayerProps) {
  switch (view.type) {
    case "letter_sound":
      return <LetterSoundPlayer view={view} {...rest} />;
    case "build_syllable":
      return <BuildSyllablePlayer view={view} {...rest} />;
    case "identify_unit":
      return <IdentifyUnitPlayer view={view} {...rest} />;
    case "fill_blank":
      return <FillBlankPlayer view={view} {...rest} />;
    case "word_picture":
      return <WordPicturePlayer view={view} {...rest} />;
    case "sentence_reading":
      return <SentenceReadingPlayer view={view} {...rest} />;
  }
}

/**
 * `emptyResponse`/`isComplete` của runtime GĐ4 chỉ đọc `variant` và `content` (đã kiểm ở tests/unit/scoring) — gọi
 * được với `view` mà không cần đáp án. Không bao giờ gọi `grade`/`reveal`/`hints` ở đây: việc đó chỉ ở máy chủ.
 */
export function emptyResponseFor(view: QuestionView): Response | null {
  const asItem = view as unknown as ExerciseItem;
  return runtimeOf(asItem).emptyResponse(asItem);
}

export function isCompleteFor(view: QuestionView, response: Response | null): boolean {
  const asItem = view as unknown as ExerciseItem;
  return runtimeOf(asItem).isComplete(asItem, response);
}
