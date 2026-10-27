import { describe, expect, it } from "vitest";
import { AUDIO_FIXTURE_EXERCISES, LISTEN_SPECS, listenLetterItem } from "../../../scripts/fixtures/audio-items";
import { bindingFor, sharedRecordingUnit } from "@/features/audio-playback/bindings";
import { decidePlayback } from "@/features/audio-playback/policy";
import { isPlaybackRole, PLAYBACK_ROLES, variantHasRecording } from "@/features/audio-playback/roles";
import { mimeSupported } from "@/features/audio-playback/support";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import type { ExerciseItem } from "@/features/exercises/items";
import { SUPPORT_POLICIES } from "@/features/exercises/core/support";
import { AUDIO_MIME_TYPES } from "@/features/audio-library/limits";
import type { SupportLevel } from "@/types/learning";

const LEVELS: readonly SupportLevel[] = [3, 2, 1, 0];
const listen = (letter: string) => listenLetterItem(LISTEN_SPECS[letter]!, 0);

describe("khe nào dùng bản ghi giáo viên", () => {
  it("chỉ nghe âm (stimulus + model); mọi biến thể khác không có bản ghi giáo viên để phát", () => {
    expect(PLAYBACK_ROLES).toEqual(["stimulus", "model"]);
    expect(variantHasRecording("listen_letter", "stimulus")).toBe(true);
    expect(variantHasRecording("listen_letter", "model")).toBe(true);
    for (const variant of Object.keys(VARIANTS).filter((id) => id !== "listen_letter")) {
      for (const role of PLAYBACK_ROLES) expect(variantHasRecording(variant, role), `${variant}/${role}`).toBe(false);
    }
    expect(isPlaybackRole("stimulus")).toBe(true);
    expect(isPlaybackRole("instruction")).toBe(false);
    expect(isPlaybackRole("../x")).toBe(false);
  });

  it("biến thể nghe âm thật sự là bài mà chính sách yêu cầu âm thanh kích thích (khớp PRD A7)", () => {
    expect(VARIANTS.listen_letter.audioPolicy.required).toContain("stimulus");
    expect(VARIANTS.listen_letter.audioPolicy.stimulusContent).toBe("phoneme");
  });
});

describe("ràng buộc câu ↔ bản ghi (bindingFor)", () => {
  it("lấy âm của phương án ĐÚNG và cách đọc từ chính khe âm thanh của câu", () => {
    expect(bindingFor(listen("b"), "stimulus")).toEqual({
      unitKind: "phoneme",
      unitText: "b",
      fallbackUnitText: null,
      expectedLabel: "bờ",
    });
    expect(bindingFor(listen("k"), "model")).toMatchObject({ unitText: "k", expectedLabel: "ca" });
  });

  it("y dùng chung bản ghi của i (nếu GV chưa tách); i thì không có phương án dự phòng", () => {
    expect(sharedRecordingUnit("y")).toBe("i");
    expect(sharedRecordingUnit("i")).toBeNull();
    expect(sharedRecordingUnit("b")).toBeNull();
    expect(bindingFor(listen("y"), "stimulus")).toMatchObject({
      unitText: "y",
      fallbackUnitText: "i",
      expectedLabel: "i",
    });
    expect(bindingFor(listen("i"), "stimulus")?.fallbackUnitText).toBeNull();
  });

  it("biến thể khác / khe khác / thiếu dữ liệu → null (không phát gì)", () => {
    const base = listen("b");
    expect(bindingFor({ ...base, variant: "visual_match" } as ExerciseItem, "stimulus")).toBeNull();
    expect(
      bindingFor({ ...base, audio: { instruction: base.audio.instruction } } as ExerciseItem, "stimulus"),
    ).toBeNull();
    expect(bindingFor({ ...base, answer: { optionId: "zzz" } } as unknown as ExerciseItem, "stimulus")).toBeNull();
    const noUnit = { ...base, content: { options: [{ id: "o1", text: "b" }] } } as unknown as ExerciseItem;
    expect(bindingFor(noUnit, "stimulus")).toBeNull();
  });

  it("đáp án trình duyệt thấy (view) không đủ để suy ra âm: binding cần `answer` mà trình duyệt không bao giờ có", () => {
    const item = listen("b");
    const view = { variant: item.variant, content: item.content, audio: item.audio };
    expect(bindingFor({ ...view, answer: undefined }, "stimulus")).toBeNull();
  });

  it("mọi câu của fixture đều có ràng buộc hợp lệ", () => {
    for (const item of AUDIO_FIXTURE_EXERCISES.flatMap((exercise) => exercise.items)) {
      expect(bindingFor(item, "stimulus"), item.id).not.toBeNull();
    }
  });
});

describe("chính sách phát (AD-35) — dùng lại decideBeforeGrading/decideAfterGrading", () => {
  const listenPolicy = VARIANTS.listen_letter.audioPolicy;

  it("nghe âm: âm kích thích phát được ở MỌI mức H3–H0 trước khi chấm (đó là nhiệm vụ)", () => {
    for (const supportLevel of LEVELS) {
      expect(decidePlayback({ policy: listenPolicy, role: "stimulus", supportLevel, graded: false })).toEqual({
        ok: true,
      });
    }
  });

  it("đọc mẫu: chỉ SAU khi chấm; trước khi chấm bị từ chối kể cả khi đã nghe âm kích thích", () => {
    for (const supportLevel of LEVELS) {
      expect(decidePlayback({ policy: listenPolicy, role: "model", supportLevel, graded: false })).toEqual({
        ok: false,
        reason: "NOT_GRADED",
      });
      expect(decidePlayback({ policy: listenPolicy, role: "model", supportLevel, graded: true })).toEqual({ ok: true });
    }
  });

  it("biến thể không dùng âm mẫu sau chấm → từ chối dù đã chấm", () => {
    const policy = { ...listenPolicy, modelAfterGrading: false };
    expect(decidePlayback({ policy, role: "model", supportLevel: 3, graded: true })).toEqual({
      ok: false,
      reason: "NOT_PERMITTED",
    });
  });

  it("khe bị cấm trước khi chấm (bài đọc từ/câu) không phát ở mọi mức; khe 'gợi ý' bị từ chối (fail-closed ở R10.3a)", () => {
    for (const variant of ["word_to_picture", "read_sentence", "read_word"].filter((id) => id in VARIANTS)) {
      const policy = VARIANTS[variant as keyof typeof VARIANTS].audioPolicy;
      if (!["word", "sentence"].includes(policy.stimulusContent)) continue;
      for (const supportLevel of LEVELS) {
        const decision = decidePlayback({ policy, role: "stimulus", supportLevel, graded: false });
        expect(decision.ok, `${variant} H${supportLevel}`).toBe(false);
      }
    }
    // Tên tranh ở H1 là "hint": cho phép khi trẻ bấm nhưng R10.3a chưa có đường ghi nhận → từ chối.
    const naming = VARIANTS.picture_onset.audioPolicy;
    expect(decidePlayback({ policy: naming, role: "stimulus", supportLevel: 1, graded: false })).toEqual({
      ok: false,
      reason: "HINT_ONLY",
    });
    expect(decidePlayback({ policy: naming, role: "stimulus", supportLevel: 0, graded: false })).toEqual({
      ok: false,
      reason: "NOT_PERMITTED",
    });
  });

  it("quét mọi biến thể: bài ĐỌC (đọc từ, đọc câu) không bao giờ phát kích thích trước khi chấm, ở mọi mức", () => {
    const reading = Object.entries(VARIANTS).filter(
      ([, definition]) => definition.audioPolicy.objectiveKind === "reading",
    );
    expect(reading.length).toBeGreaterThan(0);
    for (const [id, definition] of reading) {
      for (const supportLevel of LEVELS) {
        expect(
          decidePlayback({ policy: definition.audioPolicy, role: "stimulus", supportLevel, graded: false }).ok,
          `${id} H${supportLevel}`,
        ).toBe(false);
      }
    }
    expect(Object.keys(SUPPORT_POLICIES)).toHaveLength(4);
  });

  it("biến thể không có bản ghi giáo viên không thể đi qua đường phát dù chính sách cho phép khe đó (ràng buộc nằm ở bindingFor)", () => {
    for (const [id, definition] of Object.entries(VARIANTS)) {
      if (id === "listen_letter") continue;
      expect(variantHasRecording(id, "stimulus"), id).toBe(false);
      expect(definition.audioPolicy.objectiveKind === "listening", id).toBe(false);
    }
  });
});

describe("khả năng phát định dạng (không chuyển mã, chỉ báo)", () => {
  const only =
    (...supported: string[]) =>
    (type: string) =>
      supported.includes(type) ? "maybe" : "";

  it("không phát được gì → mọi định dạng đều không hỗ trợ", () => {
    for (const mime of AUDIO_MIME_TYPES) expect(mimeSupported(mime, only())).toBe(false);
  });

  it("Safari kiểu cũ: M4A/MP3/WAV phát được, WebM/Opus thì không", () => {
    const safari = only('audio/mp4; codecs="mp4a.40.2"', "audio/mpeg", "audio/wav");
    expect(mimeSupported("audio/mp4", safari)).toBe(true);
    expect(mimeSupported("audio/mpeg", safari)).toBe(true);
    expect(mimeSupported("audio/wav", safari)).toBe(true);
    expect(mimeSupported("audio/webm", safari)).toBe(false);
    expect(mimeSupported("audio/ogg", safari)).toBe(false);
  });

  it("Chromium: WebM/Opus phát được; định dạng lạ luôn không hỗ trợ", () => {
    expect(mimeSupported("audio/webm", only('audio/webm; codecs="opus"'))).toBe(true);
    expect(mimeSupported("audio/x-unknown", () => "probably")).toBe(false);
  });
});
