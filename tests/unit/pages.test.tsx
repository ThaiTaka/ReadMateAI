import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/(site)/page";
import DemoPage from "@/app/(site)/demo/page";
import JoinPage from "@/app/(site)/join/page";
import LearnPage from "@/app/learn/page";
import TeacherPage from "@/app/teacher/(console)/page";
import { TeacherSidebar } from "@/components/layout/teacher-sidebar";
import { EXERCISE_TYPES } from "@/features/exercises/catalog";
import { GAME_WORLDS } from "@/features/game-world/catalog";

describe("Trang chủ / (định hướng R02)", () => {
  it("thông điệp chính, thông điệp phụ, nút Khám phá ReadMate và Chơi thử", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "ReadMate AI – Học Tiếng Việt, khám phá thế giới kỳ diệu",
    );
    expect(screen.getByText("Tự luyện mỗi ngày – Tích điểm, mở khóa và phiêu lưu cùng tri thức")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Khám phá ReadMate/ })).toHaveAttribute("href", "/learn");
    expect(screen.getAllByRole("link", { name: /Chơi thử/ })[0]).toHaveAttribute("href", "/demo");
    expect(screen.getAllByText("Bản xem trước").length).toBeGreaterThan(0);
  });

  it("ba bước: luyện tại nhà → tích điểm → mở khóa phiêu lưu", () => {
    render(<HomePage />);
    const steps = screen.getByRole("region", { name: "Ba bước của một ngày phiêu lưu" });
    for (const name of ["Luyện Tiếng Việt tại nhà", "Tích điểm khi trả lời", "Mở khóa thế giới phiêu lưu"]) {
      expect(within(steps).getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("giới thiệu đủ ba lộ trình và bốn mini-game kèm ngưỡng điểm, ghi rõ đang phát triển", () => {
    render(<HomePage />);
    const paths = screen.getByRole("region", { name: "Mỗi con một lộ trình phù hợp" });
    for (const name of ["Khởi động", "Vững bước", "Tăng tốc"]) {
      expect(within(paths).getByRole("heading", { name })).toBeInTheDocument();
    }
    const games = screen.getByRole("region", { name: "Bốn vùng đất đang chờ con" });
    for (const game of GAME_WORLDS) {
      expect(within(games).getByRole("heading", { name: game.name })).toBeInTheDocument();
      expect(within(games).getByText(`Mở khi có ${game.minBalance} điểm`)).toBeInTheDocument();
    }
    expect(within(games).getAllByText("Đang phát triển")).toHaveLength(4);
  });

  it("đánh dấu năm công cụ giáo viên là dự kiến, không quảng cáo như đã có", () => {
    render(<HomePage />);
    const teachers = screen.getByRole("region", { name: "Công cụ dự kiến cho giáo viên" });
    expect(within(teachers).getAllByText("Dự kiến")).toHaveLength(5);
    for (const name of ["Bảng xếp hạng trong lớp", "Vinh danh TOP 3", "Tổ chức mùa thi đua mới"]) {
      expect(within(teachers).getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});

describe("Trang /demo (Bản chơi thử)", () => {
  it("ghi rõ: bản chơi thử, dữ liệu minh họa chưa duyệt, không lưu, không AI, chưa có âm thanh", () => {
    render(<DemoPage />);
    expect(screen.getAllByText("Bản chơi thử").length).toBeGreaterThan(0);
    const note = screen
      .getAllByRole("note")
      .find((element) => element.textContent?.includes("chưa được giáo viên duyệt"));
    expect(note).toBeDefined();
    expect(note).toHaveTextContent("dữ liệu minh họa");
    expect(note).toHaveTextContent("không lưu kết quả, không gọi AI");
    expect(note).toHaveTextContent("Chưa có âm thanh");
  });

  it("bắt đầu bằng bước chọn một trong ba lộ trình; giới thiệu đủ sáu dạng bài; H0 là 'Tự làm'", () => {
    render(<DemoPage />);
    for (const name of ["Khởi động", "Vững bước", "Tăng tốc"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
    for (const type of EXERCISE_TYPES) {
      expect(screen.getByRole("heading", { level: 3, name: type.name })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Tự làm" })).toBeInTheDocument();
  });

  it("xem trước Game World: avatar, ô điểm minh họa, bốn vùng đất, bảng xếp hạng hư cấu", () => {
    render(<DemoPage />);
    const preview = screen.getByRole("region", { name: "Xem trước Game World" });
    expect(within(preview).getByRole("note")).toHaveTextContent("Bản chơi thử – Dữ liệu minh họa");
    expect(within(preview).getByText("135 điểm thưởng")).toBeInTheDocument();
    for (const game of GAME_WORLDS) {
      expect(within(preview).getByRole("heading", { name: game.name })).toBeInTheDocument();
    }
    const board = within(preview).getByRole("region", { name: "Bảng xếp hạng minh họa" });
    expect(within(board).getByText(/Tên hư cấu, không phải học sinh thật/)).toBeInTheDocument();
    expect(within(board).getAllByRole("listitem")).toHaveLength(5);
  });

  it("không có biểu mẫu gửi dữ liệu và không có ô nhập văn bản tự do", () => {
    const { container } = render(<DemoPage />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelectorAll("textarea, input[type=text], [contenteditable='true']")).toHaveLength(0);
  });
});

describe("Trang /teacher", () => {
  // R03: khu vực GV có xác thực (proxy + requireTeacher + RLS). Trang tổng quan chỉ giới thiệu và dẫn tới /teacher/classes.
  it("nói rõ chỉ GV đã đăng nhập mới vào được và các mục còn lại đang phát triển", () => {
    render(<TeacherPage />);
    const note = screen.getAllByRole("note")[0];
    expect(note).toHaveTextContent("Chỉ giáo viên đã đăng nhập");
    expect(note).toHaveTextContent("đang phát triển");
  });

  it("không có ô nhập liệu ở trang tổng quan; dẫn tới quản lý lớp; không có nút đặt lại điểm hay bật bảng xếp hạng", () => {
    const { container } = render(<TeacherPage />);
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Mở danh sách lớp" })).toHaveAttribute("href", "/teacher/classes");
    for (const button of screen.queryAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: /đặt lại|reset|xóa điểm|bật bảng/i })).toBeNull();
  });

  it("các phần mới ghi 'Sắp có – Đang phát triển'; bản phác thảo nhân vật ghi chờ giáo viên duyệt", () => {
    render(<TeacherPage />);
    for (const name of ["Bảng điểm", "Vinh danh TOP 3", "Mùa thi đua", "Duyệt học liệu", "Cài đặt lớp"]) {
      const region = screen.getByRole("region", { name });
      expect(within(region).getAllByText("Sắp có – Đang phát triển").length).toBeGreaterThan(0);
    }
    const review = screen.getByRole("region", { name: "Duyệt học liệu" });
    expect(within(review).getAllByText("Bản phác thảo – chờ giáo viên duyệt").length).toBeGreaterThanOrEqual(9);
  });

  it("sidebar: chín mục theo R02, không còn 'Phiếu học tập'", () => {
    render(<TeacherSidebar />);
    const nav = screen.getByRole("navigation", { name: "Điều hướng khu vực giáo viên" });
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent?.replace("Sắp có", "").trim());
    expect(labels).toEqual([
      "Tổng quan",
      "Lớp học",
      "Học sinh",
      "Ngân hàng bài tập",
      "Duyệt học liệu",
      "Bảng điểm",
      "Vinh danh",
      "Mùa thi đua",
      "Cài đặt",
    ]);
    expect(nav.textContent).not.toMatch(/Phiếu học tập|Ghi nhận tại lớp/);
  });
});

describe("Trang /learn (Student Adventure Dashboard — dữ liệu minh họa)", () => {
  it("nhãn BẢN CHƠI THỬ – DỮ LIỆU MINH HỌA, lời chào hồ sơ hư cấu, điểm minh họa, không ô nhập", () => {
    const { container } = render(<LearnPage />);
    expect(screen.getAllByRole("note")[0]).toHaveTextContent("Bản chơi thử – Dữ liệu minh họa");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chào Mây!");
    expect(screen.getByText("135 điểm thưởng")).toBeInTheDocument();
    expect(screen.getByText("Minh họa")).toBeInTheDocument();
    expect(container.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
  });

  it("nút Luyện bài dẫn tới bản chơi thử thật; nút Khám phá Game World dẫn tới bản đồ", () => {
    render(<LearnPage />);
    expect(screen.getByRole("link", { name: /Luyện bài/ })).toHaveAttribute("href", "/demo#luyen-tap");
    expect(screen.getByRole("link", { name: /Khám phá Game World/ })).toHaveAttribute("href", "/learn#game-world");
  });
});

describe("Trang /join", () => {
  // R03: /join nhận mã thật qua Server Action (POST) — không còn biểu mẫu khóa.
  it("một biểu mẫu nhập mã dự phòng có nhãn; không có ô họ tên, email hay số điện thoại", () => {
    const { container } = render(<JoinPage />);
    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(screen.getByLabelText("Mã dự phòng trên thẻ học")).toBeEnabled();
    expect(screen.getByRole("button", { name: /Liên kết thiết bị/ })).toBeEnabled();
    expect(container.querySelector("input[name=kind]")).toHaveValue("backup");
    expect(container.querySelectorAll("input[type=email], input[type=tel], input[name*=name]")).toHaveLength(0);
  });

  it("có hướng dẫn nhờ giáo viên khi mã sai hoặc hết hạn, và giải thích bảo vệ dữ liệu", () => {
    render(<JoinPage />);
    expect(screen.getByRole("heading", { name: "Cần giúp đỡ?" })).toBeInTheDocument();
    expect(screen.getByText(/nhắn giáo viên để được cấp thẻ mới/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dữ liệu của con được bảo vệ thế nào?" })).toBeInTheDocument();
  });
});
