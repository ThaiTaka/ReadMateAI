import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TtsScriptList } from "@/app/teacher/(console)/tts-script/tts-script-list";
import { buildTtsScriptCatalog } from "@/server/tts/catalog";
import { vi } from "@/strings/vi";
import { allItems, exposureOf } from "./tts-helpers";

describe("trang xem trước lời đọc giọng máy", () => {
  const catalog = buildTtsScriptCatalog({ items: allItems(), exposureOf });
  const view = () => render(<TtsScriptList entries={catalog.entries} excluded={catalog.excluded} />);

  it("ghi rõ BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA và phân biệt giọng máy với bản ghi giáo viên", () => {
    view();
    expect(screen.getByText("BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA")).toBeInTheDocument();
    expect(screen.getByText(vi.ttsScript.differenceTitle)).toBeInTheDocument();
  });

  it("chỉ đọc: mọi nút bị khóa, không có thẻ audio, không có trạng thái đã duyệt", () => {
    const { container } = view();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(catalog.entries.length);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(container.querySelector("audio")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByText("Đã duyệt", { selector: "span" })).toBeNull();
    expect(screen.getAllByText(vi.ttsScript.status.pending_review).length).toBe(catalog.entries.length);
  });

  it("mỗi lời đọc hiện chữ, mục đích, giọng dự kiến (chưa chọn), nguồn và khi nào phát", () => {
    view();
    const card = screen.getByRole("article", { name: "instruction:picture_onset" });
    const scope = within(card);
    expect(scope.getByText(/Con nhìn hình rồi chọn chữ ghi âm đầu nhé\./u)).toBeInTheDocument();
    expect(scope.getByText(vi.ttsScript.purposes.instruction)).toBeInTheDocument();
    expect(scope.getByText(vi.ttsScript.voiceNotChosen)).toBeInTheDocument();
    expect(scope.getByText("variant:picture_onset")).toBeInTheDocument();
    expect(
      scope.getByText(/H3: Tự phát · H2: Phát khi chạm · H1: Gợi ý — đang khóa · H0: Không phát/u),
    ).toBeInTheDocument();
    expect(scope.getByText(vi.ttsScript.attention.ADDRESSING_UNDECIDED)).toBeInTheDocument();
  });

  it("danh sách loại chỉ đếm theo lý do, không hiện chữ bị loại", () => {
    const { container } = view();
    expect(screen.getByText(vi.ttsScript.excludedTitle)).toBeInTheDocument();
    for (const item of catalog.excluded) expect(container.textContent).not.toContain(item.textHash);
  });
});
