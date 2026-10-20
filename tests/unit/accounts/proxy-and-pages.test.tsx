import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
// Tài liệu đi kèm gọi là unstable_doesProxyMatch nhưng bản 16.4.0 chỉ xuất tên cũ.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi as vitest } from "vitest";
import { config, proxy } from "@/proxy";
import { vi } from "@/strings/vi";

vitest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("reason=expired&next=/teacher/classes"),
}));

describe("proxy (Next 16) — chuyển hướng thô khu vực giáo viên", () => {
  it("chạy cho /teacher, /learn, /join, /login; không chạy cho trang công khai và tệp tĩnh", () => {
    for (const url of ["/teacher", "/teacher/classes/x", "/learn", "/learn/me", "/join", "/login"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
    for (const url of ["/", "/demo", "/_next/static/chunk.js"])
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });

  it("chưa đăng nhập vào /teacher → /login kèm lý do và đường quay lại; không lưu cache", async () => {
    const response = await proxy(new NextRequest("http://localhost/teacher/classes?x=1"));
    const location = new URL(response.headers.get("location") ?? "", "http://localhost");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("reason")).toBe("required");
    expect(location.searchParams.get("next")).toBe("/teacher/classes?x=1");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("cookie phiên không xác minh được → báo phiên đã hết hạn", async () => {
    const request = new NextRequest("http://localhost/teacher", {
      headers: { cookie: "sb-127-auth-token=base64-eyJmYWtlIjp0cnVlfQ" },
    });
    const location = new URL((await proxy(request)).headers.get("location") ?? "", "http://localhost");
    expect(location.searchParams.get("reason")).toBe("expired");
  });

  it("trang /join và /learn không bị chuyển hướng", async () => {
    expect((await proxy(new NextRequest("http://localhost/join"))).headers.get("location")).toBeNull();
    expect((await proxy(new NextRequest("http://localhost/learn/me"))).headers.get("location")).toBeNull();
  });
});

describe("biểu mẫu đăng nhập giáo viên", () => {
  it("email + mật khẩu có nhãn và autocomplete đúng; hiện lý do chuyển hướng; không có liên kết đăng ký", async () => {
    const { LoginForm } = await import("@/app/(site)/login/login-form");
    const { container } = render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("note")).toHaveTextContent(vi.auth.reasons.expired);
    expect(container.querySelector("input[name=next]")).toHaveValue("/teacher/classes");
    expect(screen.queryByRole("link", { name: /đăng ký/i })).toBeNull();
  });
});
