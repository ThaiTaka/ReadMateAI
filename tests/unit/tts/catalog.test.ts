import { describe, expect, it } from "vitest";
import { containsForm } from "@/features/exercises/core/leaks";
import { decideBeforeGrading } from "@/features/exercises/core/audio";
import { VARIANT_IDS } from "@/features/exercises/core/module";
import type { SupportLevel } from "@/types/learning";
import { buildTtsScriptCatalog, ttsScriptEntrySchema } from "@/server/tts/catalog";
import { contentHashOf } from "@/server/tts/hash";
import { checkTtsRequest } from "@/server/tts/request";
import { scriptStatusOf } from "@/server/tts/script-review";
import { PROVISIONAL_VOICE } from "@/server/tts/voice";
import { clone, firstItem } from "../exercises/helpers";
import { allItems, approve, exposureOf, fullCatalog, TEST_VOICE, VARIANTS } from "./tts-helpers";

const LEVELS: SupportLevel[] = [3, 2, 1, 0];

describe("TTS Script Catalog — nguồn và hình dạng", () => {
  const staticCatalog = buildTtsScriptCatalog();

  it("lấy câu lệnh của cả 17 biến thể và chuỗi phản hồi cố định, không bịa nội dung", () => {
    const instructionIds = staticCatalog.entries.filter((e) => e.purpose === "instruction").map((e) => e.id);
    expect(instructionIds).toHaveLength(VARIANT_IDS.length);
    for (const id of VARIANT_IDS) {
      const entry = staticCatalog.entries.find((e) => e.id === `instruction:${id}`);
      expect(entry?.text, id).toBe(VARIANTS[id].instruction.spoken.normalize("NFC"));
      expect(entry?.source).toMatchObject({ kind: "variant_instruction", ref: `variant:${id}` });
    }
    expect(staticCatalog.entries.some((e) => e.id === "feedback:correct_title_1")).toBe(true);
    expect(staticCatalog.entries.every((e) => e.purpose === "instruction" || e.purpose === "feedback")).toBe(true);
    expect(staticCatalog.excluded).toEqual([]);
  });

  it("mỗi mục có đủ trường, văn bản NFC, hash khớp, mã ổn định, giọng dự kiến", () => {
    const ids = new Set<string>();
    for (const entry of fullCatalog().entries) {
      expect(ttsScriptEntrySchema.safeParse(entry).success, entry.id).toBe(true);
      expect(entry.text).toBe(entry.text.normalize("NFC"));
      expect(entry.contentHash).toBe(contentHashOf(entry));
      expect(entry.source.version).toContain(entry.contentHash.slice(0, 12));
      expect(entry.usageNote.length).toBeGreaterThan(0);
      expect(entry.usages.length).toBeGreaterThan(0);
      expect(entry.voice).toEqual(TEST_VOICE);
      expect(ids.has(entry.id), `trùng mã ${entry.id}`).toBe(false);
      ids.add(entry.id);
    }
  });

  it("dựng hai lần cho kết quả giống hệt (hàm thuần, thứ tự cố định)", () => {
    expect(fullCatalog()).toEqual(fullCatalog());
    expect(buildTtsScriptCatalog()).toEqual(buildTtsScriptCatalog());
  });

  it("KHÔNG tự duyệt: mọi mục pending_review, kể cả khi có bản duyệt của mục khác hay bản duyệt cũ", () => {
    const { entries } = fullCatalog();
    expect(entries.every((e) => e.reviewStatus === "pending_review")).toBe(true);
    for (const entry of entries) expect(scriptStatusOf(entry, [])).toBe("pending_review");
    const first = entries[0]!;
    const second = entries[1]!;
    // bản duyệt của mục khác, hash cũ, thiếu xác nhận cách đọc, hay bản ghi sai dạng đều không làm mục thành approved
    const reviews = [
      approve(second),
      approve(first, { contentHash: "0".repeat(64) }),
      approve(first, { pronunciationConfirmed: false }),
      { ...approve(first), reviewedBy: "khong-phai-uuid" },
      { entryId: first.id },
    ];
    expect(scriptStatusOf(first, reviews)).toBe("pending_review");
  });

  it("chỉ bản duyệt khớp hash hiện tại mới tính; đổi chữ làm bản duyệt cũ hết hiệu lực; từ chối thắng khi mới hơn", () => {
    const entry = buildTtsScriptCatalog().entries[0]!;
    const review = approve(entry);
    expect(scriptStatusOf(entry, [review])).toBe("approved");
    const edited = {
      ...entry,
      text: `${entry.text} nhé`,
      contentHash: contentHashOf({ purpose: entry.purpose, text: `${entry.text} nhé` }),
    };
    expect(scriptStatusOf(edited, [review])).toBe("pending_review");
    expect(
      scriptStatusOf(entry, [review, approve(entry, { decision: "rejected", reviewedAt: "2026-10-29T08:00:00.000Z" })]),
    ).toBe("rejected");
  });

  it("lược đồ mục chặt: không nhận trường dữ liệu học sinh", () => {
    const entry = buildTtsScriptCatalog().entries[0]!;
    expect(ttsScriptEntrySchema.safeParse({ ...entry, studentId: "x" }).success).toBe(false);
    expect(ttsScriptEntrySchema.safeParse({ ...entry, alias: "Bé Na" }).success).toBe(false);
    expect(ttsScriptEntrySchema.safeParse({ ...entry, reviewStatus: "approved" }).success).toBe(false);
  });

  it("mọi lời đọc qua được cổng kiểm tra đầu vào TTS (không dữ liệu cá nhân)", () => {
    for (const entry of fullCatalog().entries) {
      expect(
        checkTtsRequest({
          text: entry.text,
          purpose: entry.purpose,
          voiceKey: entry.voice.voiceKey,
          speed: entry.voice.speed,
        }).ok,
        entry.id,
      ).toBe(true);
    }
  });

  it("đánh dấu xưng hô và lời phủ định cho giáo viên cân nhắc (Q-08), không tự sửa chữ", () => {
    const byId = new Map(staticCatalog.entries.map((e) => [e.id, e]));
    expect(byId.get("instruction:picture_onset")?.attention).toContain("ADDRESSING_UNDECIDED");
    expect(byId.get("feedback:retry_title")?.attention).toContain("NEGATIVE_WORDING");
    expect(byId.get("feedback:retry_title")?.text).toBe("Chưa đúng rồi");
  });

  it("giọng giữ chỗ được ghi rõ là chưa chọn", () => {
    const entry = buildTtsScriptCatalog().entries[0]!;
    expect(entry.voice).toEqual(PROVISIONAL_VOICE);
    expect(entry.voice.configVersion.startsWith("provisional")).toBe(true);
  });

  it("câu lệnh giống nhau ở nhiều câu gộp thành một mục (không nhân bản)", () => {
    const items = allItems();
    const catalog = buildTtsScriptCatalog({ items: [...items, ...items], exposureOf });
    const keys = catalog.entries.map((e) => `${e.purpose}|${e.text}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("TTS Script Catalog — chính sách AD-35 (không luật thứ hai)", () => {
  it("âm đơn lẻ (nghe âm – chọn chữ) không vào danh sách hợp lệ: TEACHER_RECORDING_REQUIRED", () => {
    const catalog = fullCatalog();
    const listen = allItems().filter((item) => item.variant === "listen_letter");
    expect(listen.length).toBeGreaterThan(0);
    for (const item of listen) {
      const spoken = item.audio.stimulus?.spokenText;
      if (spoken) expect(catalog.entries.some((e) => e.text === spoken && e.role === "stimulus")).toBe(false);
    }
    const codes = catalog.excluded.filter((e) => e.variantId === "listen_letter").map((e) => e.code);
    if (listen.some((item) => item.audio.stimulus)) expect(codes).toContain("TEACHER_RECORDING_REQUIRED");
  });

  it("khe stimulus của bài đọc bị loại ở mọi mức; câu lệnh chứa từ cần đọc bị loại; đọc mẫu sau chấm thì được", () => {
    const reading = clone(firstItem("choose_picture"));
    reading.audio.stimulus = { spokenText: reading.content.word, assetId: null };
    reading.audio.instruction = { spokenText: `Con hãy đọc ${reading.content.word}`, assetId: null };
    reading.audio.model = { spokenText: reading.content.word, assetId: null };
    const catalog = buildTtsScriptCatalog({ items: [reading], exposureOf });
    const codes = catalog.excluded.map((e) => `${e.role}:${e.code}`);
    expect(codes).toContain("stimulus:AUDIO_ROLE_FORBIDDEN");
    expect(codes).toContain("instruction:AUDIO_LEAKS_ANSWER");
    expect(catalog.entries.some((e) => e.purpose === "model" && e.text === reading.content.word)).toBe(true);
    // mục bị loại không lưu chữ (lời đọc làm lộ đáp án không bị nhân bản ra ngoài)
    expect(JSON.stringify(catalog.excluded)).not.toContain(reading.content.word);
    for (const e of catalog.entries.filter((x) => x.role !== "model" && x.role !== "feedback")) {
      expect(containsForm(e.text, reading.content.word), e.id).toBe(false);
    }
  });

  it("bất biến trên toàn danh mục: lời đọc phát được TRƯỚC khi chấm không chứa dạng đáp án bị cấm (H3–H0)", () => {
    const items = allItems();
    const catalog = buildTtsScriptCatalog({ items, exposureOf });
    for (const item of items) {
      const forbidden = exposureOf(item).forbidden;
      const policy = VARIANTS[item.variant].audioPolicy;
      for (const entry of catalog.entries) {
        for (const usage of entry.usages) {
          if (usage.variantId !== item.variant) continue;
          if (usage.role === "model" || usage.role === "feedback") continue;
          for (const level of LEVELS) {
            const playableBefore = decideBeforeGrading(policy, usage.role, level).permitted;
            expect(usage.availability[level] !== "forbidden").toBe(playableBefore);
            if (!playableBefore) continue;
            for (const form of forbidden) {
              if (form.allowedRoles.includes(usage.role)) continue;
              expect(containsForm(entry.text, form.form), `${entry.id} H${level}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it("mức khả dụng ghi theo audioPolicy: câu lệnh H3 tự phát, H2 chạm, H1 chỉ qua gợi ý (bị khóa), H0 cấm", () => {
    const entry = buildTtsScriptCatalog().entries.find((e) => e.id === "instruction:picture_onset")!;
    expect(entry.usages[0]!.availability).toEqual({ 3: "auto", 2: "tap", 1: "hint_locked", 0: "forbidden" });
    const feedback = buildTtsScriptCatalog().entries.find((e) => e.id === "feedback:correct_message")!;
    expect(feedback.usages[0]!.availability[0]).toBe("after_grading");
  });

  it("truyền items mà thiếu exposureOf thì báo lỗi thay vì bỏ qua kiểm tra lộ đáp án", () => {
    expect(() => buildTtsScriptCatalog({ items: allItems() })).toThrow();
  });
});
