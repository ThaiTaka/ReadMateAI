import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoPractice } from "@/app/(site)/demo/demo-practice";
import { buildDemoPracticeData } from "@/features/demo/practice-data";
import type { ExerciseItem } from "@/features/exercises/items";
import { runtimeOf, VARIANTS } from "@/features/exercises/runtime-registry";
import { SessionRunner, type RunnerBlock } from "@/features/exercises/ui/session-runner";
import type { SupportLevel } from "@/types/learning";
import { demoItems, firstItem } from "./helpers";

function block(
  items: readonly ExerciseItem[],
  supportLevel: SupportLevel,
  example: ExerciseItem | null = null,
): RunnerBlock {
  const first = items[0];
  if (!first) throw new Error("không có câu");
  return {
    id: "b1",
    title: VARIANTS[first.variant].title,
    variant: first.variant,
    supportLevel,
    items,
    example,
    previewOnly: false,
  };
}

function renderRunner(blocks: RunnerBlock[]) {
  let exited = false;
  render(<SessionRunner heading="Bản chơi thử" blocks={blocks} onExit={() => (exited = true)} />);
  return { exited: () => exited };
}

/** Bấm vào phương án có nội dung chữ (dạng một lựa chọn). */
function chooseText(group: string, text: string) {
  fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name: text }));
}

describe("SessionRunner — bộ chạy bài trên giao diện", () => {
  const items = demoItems("missing_onset", "developing", { count: 2 });

  it("màn hướng dẫn → bắt đầu → chọn → Kiểm tra → phản hồi đúng → Câu tiếp → Xem kết quả", () => {
    renderRunner([block(items, 2)]);
    expect(screen.getByText("Chọn chữ còn thiếu.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));

    const check = screen.getByRole("button", { name: /Kiểm tra/ });
    expect(check).toBeDisabled();
    for (const item of items) {
      const right = runtimeOf(item).correctResponse(item);
      if (item.variant !== "missing_onset" || right.kind !== "choice") throw new Error("sai biến thể");
      const text = item.content.options.find((option) => option.id === right.optionId)?.text ?? "";
      chooseText("Các phương án để chọn", text);
      fireEvent.click(screen.getByRole("button", { name: /Kiểm tra/ }));
      expect(screen.getByRole("status")).toHaveTextContent(/Đúng rồi!|Con làm tốt lắm!|Chính xác!/u);
      const next = screen.queryByRole("button", { name: /Câu tiếp/ });
      fireEvent.click(next ?? screen.getByRole("button", { name: /Xem kết quả/ }));
    }
    expect(screen.getByRole("heading", { name: "Con đã hoàn thành buổi luyện!" })).toBeInTheDocument();
    expect(screen.getByText("Số câu làm đúng").nextSibling).toHaveTextContent("2");
  });

  it("chọn sai → phản hồi không nói đáp án → Thử lại → chọn đúng", () => {
    const item = items[0];
    if (!item || item.variant !== "missing_onset") throw new Error("sai biến thể");
    renderRunner([block([item], 2)]);
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));
    const right = item.content.options.find((option) => option.id === item.answer.optionId);
    const wrong = item.content.options.find((option) => option.id !== item.answer.optionId);
    if (!right || !wrong) throw new Error("thiếu phương án");
    chooseText("Các phương án để chọn", wrong.text);
    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra/ }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Chưa đúng rồi");
    expect(status).not.toHaveTextContent(item.answer.result);
    // Bấm Kiểm tra lần nữa khi chưa chọn lại: bị khóa (không mất lượt).
    expect(screen.getByRole("button", { name: /Kiểm tra/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    chooseText("Các phương án để chọn", right.text);
    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/Đúng rồi!|Con làm tốt lắm!|Chính xác!/u);
  });

  it("H3: có phần 'Cô làm mẫu' với câu ví dụ đã giải; H2 thì không", () => {
    const [example, ...rest] = demoItems("which_tone", "developing", { count: 3 });
    if (!example) throw new Error("thiếu câu ví dụ");
    const { unmount } = render(
      <SessionRunner heading="Bản chơi thử" blocks={[block(rest, 3, example)]} onExit={() => undefined} />,
    );
    expect(screen.getByRole("region", { name: "Cô làm mẫu" })).toBeInTheDocument();
    unmount();
    render(<SessionRunner heading="Bản chơi thử" blocks={[block(rest, 2, example)]} onExit={() => undefined} />);
    expect(screen.queryByRole("region", { name: "Cô làm mẫu" })).toBeNull();
  });

  it("H0 (Thử như ở lớp): không có nút Gợi ý, mỗi câu một lượt; H2 có nút Gợi ý", () => {
    const { unmount } = render(<SessionRunner heading="x" blocks={[block(items, 0)]} onExit={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));
    expect(screen.queryByRole("button", { name: /Gợi ý/ })).toBeNull();
    expect(screen.getByText(/Giống phiếu ở lớp/)).toBeInTheDocument();
    unmount();
    render(<SessionRunner heading="x" blocks={[block(items, 2)]} onExit={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gợi ý/ }));
    expect(screen.getByText(/Nhớ nhé:/)).toBeInTheDocument();
  });

  it("bài đọc từ: không có nút nghe từ; tranh có nhãn trung tính 'Hình 1…' (không lộ tên tranh)", () => {
    const item = firstItem("choose_picture");
    render(<SessionRunner heading="x" blocks={[block([item], 2)]} onExit={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));
    expect(screen.queryByText(/Nghe từ/)).toBeNull();
    expect(screen.getByText(/Nghe câu lệnh: Chưa có âm thanh/)).toBeInTheDocument();
    const pictures = within(screen.getByRole("group", { name: "Các hình để chọn" })).getAllByRole("button");
    expect(pictures.map((picture) => picture.getAttribute("aria-label"))).toEqual(
      pictures.map((_picture, index) => `Hình ${index + 1}`),
    );
    for (const name of Object.values(item.answer.pictureNames)) {
      if (name !== item.content.word) expect(document.body.textContent).not.toContain(name);
    }
  });

  it("mọi nút âm thanh đều bị khóa và ghi rõ 'Chưa có âm thanh' — không có nút phát giả; không có thẻ audio", () => {
    render(
      <SessionRunner
        heading="x"
        blocks={[block([firstItem("picture_onset", "foundation")], 3)]}
        onExit={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));
    const audioButtons = screen.getAllByRole("button", { name: /Chưa có âm thanh/ });
    expect(audioButtons.length).toBeGreaterThan(0);
    for (const button of audioButtons) expect(button).toBeDisabled();
    expect(document.querySelectorAll("audio, video")).toHaveLength(0);
  });

  it("nút Thoát bài gọi lại người dùng (không chuyển trang)", () => {
    const { exited } = renderRunner([block(items, 2)]);
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Thoát bài/ }));
    expect(exited()).toBe(true);
  });
});

describe("DemoPractice — luồng chọn lộ trình → dạng bài", () => {
  const data = buildDemoPracticeData();

  it("ba lộ trình đều có buổi luyện mẫu và đủ sáu dạng bài", () => {
    expect(data.paths.map((path) => path.id)).toEqual(["khoi-dong", "vung-buoc", "tang-toc"]);
    for (const path of data.paths) {
      expect(path.session.length).toBeGreaterThanOrEqual(3);
      expect(path.session.at(-1)?.supportLevel).toBe(0);
      expect(new Set(path.activities.map((activity) => activity.type)).size).toBe(6);
      expect(path.activities.filter((activity) => activity.status === "ready").length).toBeGreaterThan(5);
    }
  });

  it("chọn lộ trình → thấy mức hỗ trợ, buổi luyện mẫu, sáu nhóm dạng bài → mở một bài", () => {
    render(<DemoPractice data={data} />);
    fireEvent.click(screen.getByRole("button", { name: /Tăng tốc/ }));
    expect(screen.getByRole("heading", { name: "Tăng tốc" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /H1/ })).toBeChecked();
    expect(screen.getByRole("button", { name: /Bắt đầu buổi luyện/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Làm thử: Sắp xếp từ thành câu" }));
    expect(screen.getByText("Sắp xếp các từ thành câu.")).toBeInTheDocument();
  });

  it("dữ liệu gửi xuống trình duyệt không chứa kho tri thức, chỉ các câu đã sinh; không có trường cá nhân", () => {
    const serialized = JSON.stringify(data);
    for (const key of ['"phonemes"', '"prerequisites"', '"confusions"', '"syllables"'])
      expect(serialized).not.toContain(key);
    expect(serialized).not.toMatch(/"(full_?name|student_?name|birth\w*|phone\w*|email|address)"\s*:/iu);
  });
});
