import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/(site)/page";
import DemoPage from "@/app/(site)/demo/page";
import JoinPage from "@/app/(site)/join/page";
import LearnPage from "@/app/learn/page";
import TeacherPage from "@/app/teacher/page";
import { EXERCISE_TYPES } from "@/features/exercises/catalog";

describe("Trang chủ /", () => {
  it("hiển thị thông điệp, liên kết demo và trạng thái bản xem trước", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mỗi em một nhịp đọc – Mỗi ngày một tiến bộ");
    expect(screen.getByRole("link", { name: /Xem bản demo giao diện/ })).toHaveAttribute("href", "/demo");
    expect(screen.getAllByText("Bản xem trước").length).toBeGreaterThan(0);
  });

  it("đánh dấu công cụ giáo viên là dự kiến, không quảng cáo như đã có", () => {
    render(<HomePage />);
    const teachers = screen.getByRole("region", { name: "Công cụ dự kiến cho giáo viên" });
    expect(within(teachers).getAllByText("Dự kiến")).toHaveLength(4);
  });

  it("giới thiệu đủ ba hướng hỗ trợ học tập", () => {
    render(<HomePage />);
    const paths = screen.getByRole("region", { name: "Mỗi em một lộ trình phù hợp" });
    for (const name of ["Khởi động", "Vững bước", "Tăng tốc"]) {
      expect(within(paths).getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});

describe("Trang /demo (Bản chơi thử)", () => {
  it("ghi rõ: bản chơi thử, dữ liệu minh họa chưa duyệt, không lưu, không AI, chưa có âm thanh", () => {
    render(<DemoPage />);
    expect(screen.getAllByText("Bản chơi thử").length).toBeGreaterThan(0);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("dữ liệu minh họa");
    expect(note).toHaveTextContent("chưa được giáo viên duyệt");
    expect(note).toHaveTextContent("không lưu kết quả, không gọi AI");
    expect(note).toHaveTextContent("Chưa có âm thanh");
  });

  it("bắt đầu bằng bước chọn một trong ba lộ trình; giới thiệu đủ sáu dạng bài", () => {
    render(<DemoPage />);
    for (const name of ["Khởi động", "Vững bước", "Tăng tốc"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
    for (const type of EXERCISE_TYPES) {
      expect(screen.getByRole("heading", { level: 3, name: type.name })).toBeInTheDocument();
    }
  });

  it("không có biểu mẫu gửi dữ liệu và không có ô nhập văn bản tự do", () => {
    const { container } = render(<DemoPage />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelectorAll("textarea, input[type=text], [contenteditable='true']")).toHaveLength(0);
  });
});

describe("Trang /teacher", () => {
  it("nói rõ chức năng đang phát triển và chưa có đăng nhập", () => {
    render(<TeacherPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Chức năng đang phát triển");
    expect(screen.getByRole("note")).toHaveTextContent("chưa được bảo vệ bằng tài khoản");
  });

  it("không có ô nhập liệu và nút thao tác bị khóa", () => {
    const { container } = render(<TeacherPage />);
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Tạo lớp mới/ })).toBeDisabled();
  });
});

describe("Trang /learn", () => {
  it("chào học sinh, không có ô nhập văn bản, nút bắt đầu bị khóa", () => {
    const { container } = render(<LearnPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chào con!");
    expect(container.querySelectorAll("input, textarea")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Bắt đầu/ })).toBeDisabled();
    expect(screen.getByText(/chưa lưu thông tin học tập/)).toBeInTheDocument();
  });
});

describe("Trang /join", () => {
  it("biểu mẫu bị khóa hoàn toàn và không có thẻ form", () => {
    const { container } = render(<JoinPage />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("fieldset")).toBeDisabled();
    expect(screen.getByLabelText("Mã dự phòng trên thẻ học")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Liên kết thiết bị/ })).toBeDisabled();
  });

  it("thông báo chưa nhận và chưa lưu mã nào", () => {
    render(<JoinPage />);
    expect(screen.getByRole("note")).toHaveTextContent("chưa nhận, chưa kiểm tra và chưa lưu bất kỳ mã nào");
  });
});
