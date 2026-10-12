import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState, Skeleton } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { Tabs } from "@/components/ui/tabs";

describe("Button", () => {
  it("mặc định là type=button để không vô tình gửi biểu mẫu", () => {
    render(<Button>Bắt đầu</Button>);
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toHaveAttribute("type", "button");
  });

  it("hỗ trợ trạng thái vô hiệu hóa", () => {
    render(<Button disabled>Sắp có</Button>);
    expect(screen.getByRole("button", { name: "Sắp có" })).toBeDisabled();
  });

  it("kích thước dành cho học sinh có vùng chạm 64px", () => {
    render(<Button size="kid">Chạm</Button>);
    expect(screen.getByRole("button", { name: "Chạm" }).className).toContain("min-h-touch-kid");
  });
});

describe("ButtonLink", () => {
  it("là liên kết thật với href đúng", () => {
    render(<ButtonLink href="/demo">Xem bản demo</ButtonLink>);
    expect(screen.getByRole("link", { name: "Xem bản demo" })).toHaveAttribute("href", "/demo");
  });
});

describe("Badge, Notice, EmptyState, LoadingState, Skeleton", () => {
  it("Badge hiển thị nội dung", () => {
    render(<Badge tone="sun">Bản xem trước</Badge>);
    expect(screen.getByText("Bản xem trước")).toBeInTheDocument();
  });

  it("Notice có vai trò note, tiêu đề và nội dung", () => {
    render(<Notice title="Chức năng đang phát triển">Chưa hoạt động.</Notice>);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Chức năng đang phát triển");
    expect(note).toHaveTextContent("Chưa hoạt động.");
  });

  it("EmptyState hiển thị tiêu đề, mô tả và hành động", () => {
    render(
      <EmptyState
        icon={<span />}
        title="Chưa có bài tập"
        description="Bài tập sẽ xuất hiện ở đây."
        action={<Button>Về trang chủ</Button>}
      />,
    );
    expect(screen.getByText("Chưa có bài tập")).toBeInTheDocument();
    expect(screen.getByText("Bài tập sẽ xuất hiện ở đây.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Về trang chủ" })).toBeInTheDocument();
  });

  it("LoadingState được trình đọc màn hình thông báo", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải…");
  });

  it("Skeleton được ẩn với trình đọc màn hình", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Tabs — điều hướng bằng bàn phím theo WAI-ARIA", () => {
  const items = [
    { id: "khoi-dong", label: "Khởi động", panel: <p>Nội dung Khởi động</p> },
    { id: "vung-buoc", label: "Vững bước", panel: <p>Nội dung Vững bước</p> },
    { id: "tang-toc", label: "Tăng tốc", panel: <p>Nội dung Tăng tốc</p> },
  ];

  const selectedTab = () => screen.getAllByRole("tab").find((tab) => tab.getAttribute("aria-selected") === "true");

  it("chọn tab đầu tiên và chỉ tab đó nằm trong thứ tự Tab", () => {
    render(<Tabs items={items} label="Chọn lộ trình" />);
    expect(screen.getByRole("tablist", { name: "Chọn lộ trình" })).toBeInTheDocument();
    expect(selectedTab()).toHaveTextContent("Khởi động");
    expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Nội dung Khởi động");
  });

  it("mũi tên phải/trái, Home, End chuyển tab và di chuyển focus", () => {
    render(<Tabs items={items} label="Chọn lộ trình" />);
    const [first] = screen.getAllByRole("tab");
    first?.focus();

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
    expect(selectedTab()).toHaveTextContent("Vững bước");
    expect(document.activeElement).toBe(selectedTab());

    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(selectedTab()).toHaveTextContent("Tăng tốc");

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
    expect(selectedTab()).toHaveTextContent("Khởi động");

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
    expect(selectedTab()).toHaveTextContent("Tăng tốc");

    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(selectedTab()).toHaveTextContent("Khởi động");
  });

  it("bấm chuột chọn tab và hiện đúng bảng nội dung", () => {
    render(<Tabs items={items} label="Chọn lộ trình" />);
    fireEvent.click(screen.getByRole("tab", { name: "Tăng tốc" }));
    expect(selectedTab()).toHaveTextContent("Tăng tốc");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Nội dung Tăng tốc");
  });
});
