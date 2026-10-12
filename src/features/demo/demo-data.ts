import type { LearningPathId, SupportLevel } from "@/types/learning";

/**
 * Dữ liệu minh họa HOÀN TOÀN GIẢ LẬP cho trang /demo.
 * Không chứa — và không bao giờ được chứa — thông tin của học sinh thật
 * (không tên, không kết quả, không thiết bị). Kiểm thử tests/unit/demo-data.test.ts bảo vệ quy tắc này.
 */
export const DEMO_DATA_IS_FICTIONAL = true as const;

export type DemoStepKind = "review" | "practice" | "classroom_like" | "celebrate";

export type DemoSessionStep = {
  kind: DemoStepKind;
  title: string;
  detail: string;
  minutes: number;
};

/** Một buổi luyện mẫu (10–15 phút) cho từng lộ trình. */
export const DEMO_SESSIONS: Readonly<Record<LearningPathId, readonly DemoSessionStep[]>> = {
  "khoi-dong": [
    { kind: "review", title: "Ôn bài cũ", detail: "Nhận lại hai chữ đã học: b và d.", minutes: 2 },
    { kind: "practice", title: "Ghép tiếng", detail: "b + a → ba, có hình minh họa và gợi ý từng bước.", minutes: 6 },
    {
      kind: "classroom_like",
      title: "Thử như ở lớp",
      detail: "Nhìn hình, chọn chữ ghi âm đầu — không gợi ý.",
      minutes: 3,
    },
    { kind: "celebrate", title: "Nhận hình dán", detail: "Lời khen và hình dán, không chấm điểm so sánh.", minutes: 1 },
  ],
  "vung-buoc": [
    { kind: "review", title: "Ôn bài cũ", detail: "Phân biệt hai vần dễ nhầm: an và ang.", minutes: 2 },
    { kind: "practice", title: "Điền vần còn thiếu", detail: "Chọn vần đúng cho tiếng có hình minh họa.", minutes: 6 },
    { kind: "classroom_like", title: "Thử như ở lớp", detail: "Đọc từ rồi chọn hình đúng — không gợi ý.", minutes: 4 },
    { kind: "celebrate", title: "Nhận hình dán", detail: "Lời khen và hình dán, không chấm điểm so sánh.", minutes: 1 },
  ],
  "tang-toc": [
    { kind: "review", title: "Ôn bài cũ", detail: "Đọc lại ba từ mới của tuần.", minutes: 2 },
    { kind: "practice", title: "Đọc câu – hiểu câu", detail: "Đọc câu ngắn rồi chọn hình phù hợp.", minutes: 6 },
    { kind: "classroom_like", title: "Thử như ở lớp", detail: "Sắp xếp từ thành câu — không gợi ý.", minutes: 4 },
    { kind: "celebrate", title: "Nhận hình dán", detail: "Lời khen và hình dán, không chấm điểm so sánh.", minutes: 1 },
  ],
};

export type DemoSupportLevel = {
  level: SupportLevel;
  code: string;
  name: string;
  description: string;
};

/** Bốn mức hỗ trợ giảm dần (docs/PRD.md §11). */
export const DEMO_SUPPORT_LEVELS: readonly DemoSupportLevel[] = [
  { level: 3, code: "H3", name: "Hỗ trợ đầy đủ", description: "Tự đọc yêu cầu, có phần làm mẫu và gợi ý chủ động." },
  { level: 2, code: "H2", name: "Hỗ trợ một phần", description: "Chạm loa để nghe yêu cầu, gợi ý khi em cần." },
  { level: 1, code: "H1", name: "Hỗ trợ tối thiểu", description: "Bố cục gần giống phiếu, trợ giúp chỉ khi em bấm." },
  { level: 0, code: "H0", name: "Tự lực", description: "Thử như ở lớp: giống phiếu, không gợi ý." },
];
