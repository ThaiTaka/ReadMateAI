import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  JOIN_PAGE_HEADERS,
  PERMISSIONS_POLICY,
  type HttpHeader,
} from "@/config/security-headers";

const toMap = (headers: HttpHeader[]) => new Map(headers.map(({ key, value }) => [key, value]));

describe("header bảo mật — production", () => {
  const headers = toMap(buildSecurityHeaders({ isDev: false }));
  const csp = headers.get("Content-Security-Policy") ?? "";

  it("có đủ các header bắt buộc", () => {
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toBe(PERMISSIONS_POLICY);
    expect(csp).not.toBe("");
  });

  it("CSP chỉ cho phép tài nguyên cùng nguồn và chặn nhúng trang", () => {
    for (const directive of [
      "default-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toMatch(/https?:|\*/);
  });

  it("CSP production không cho eval và không mở WebSocket", () => {
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("ws:");
  });
});

describe("header bảo mật — development", () => {
  const csp = buildContentSecurityPolicy({ isDev: true });

  it("chỉ thêm những gì môi trường dev của Next.js cần", () => {
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("Permissions-Policy", () => {
  it("tắt camera, microphone và định vị", () => {
    expect(PERMISSIONS_POLICY).toContain("camera=()");
    expect(PERMISSIONS_POLICY).toContain("microphone=()");
    expect(PERMISSIONS_POLICY).toContain("geolocation=()");
  });
});

describe("next.config.ts", () => {
  it("không để lộ header X-Powered-By", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("áp dụng header cho mọi route và ghi đè Referrer-Policy riêng cho /join", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const sources = rules.map((rule) => rule.source);
    expect(sources).toEqual(["/:path*", "/join"]);
    // Quy tắc khai báo sau ghi đè quy tắc trước khi cùng khóa header.
    expect(rules[1]?.headers).toEqual(JOIN_PAGE_HEADERS);
    expect(JOIN_PAGE_HEADERS).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
  });
});
