/**
 * Thẻ học: sinh mã, chuẩn hóa mã dự phòng, HMAC (ARCHITECTURE §8.2, docs/STUDENT_ACCESS.md).
 *
 * - Mã QR: 32 byte ngẫu nhiên (base64url, 43 ký tự) đặt trong FRAGMENT `…/join#c=<mã>` → không vào log
 *   máy chủ hay header Referer.
 * - Mã dự phòng: 8 ký tự Crockford Base32 (≈ 40 bit), in dạng `ABCD-EFGH`, để gõ tay khi không quét được.
 * - CSDL chỉ lưu HMAC-SHA256(loại + mã, LOGIN_CODE_PEPPER); lộ CSDL không đủ để dò mã.
 *
 * Dùng `node:crypto` → chỉ chạy ở máy chủ/script (không import vào mã giao diện). Không `server-only` để
 * script seed chạy được bằng Node 24 trực tiếp.
 */
import { createHmac, randomBytes, randomInt } from "node:crypto";

export const TOKEN_BYTES = 32;
export const TOKEN_LENGTH = 43;
export const BACKUP_CODE_LENGTH = 8;
/** Crockford Base32: bỏ I, L, O, U để tránh nhầm khi đọc/gõ. */
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const MIN_PEPPER_LENGTH = 32;

export type LoginCodeKind = "token" | "backup";
export type GeneratedLoginCode = { token: string; backupCode: string };

export function generateLoginCode(): GeneratedLoginCode {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  let backupCode = "";
  for (let index = 0; index < BACKUP_CODE_LENGTH; index += 1) {
    backupCode += CROCKFORD_ALPHABET[randomInt(CROCKFORD_ALPHABET.length)];
  }
  return { token, backupCode };
}

/** `ABCDEFGH` → `ABCD-EFGH` (in trên thẻ). */
export function formatBackupCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Chuẩn hóa mã dự phòng người dùng gõ: bỏ khoảng trắng/gạch, viết hoa, O→0, I/L→1 (quy ước Crockford).
 * Trả null nếu không đúng 8 ký tự hợp lệ.
 */
export function normalizeBackupCode(input: string): string | null {
  const cleaned = input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s-]/gu, "")
    .replace(/O/gu, "0")
    .replace(/[IL]/gu, "1");
  if (cleaned.length !== BACKUP_CODE_LENGTH) return null;
  for (const char of cleaned) if (!CROCKFORD_ALPHABET.includes(char)) return null;
  return cleaned;
}

export function isWellFormedToken(token: string): boolean {
  return token.length === TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/u.test(token);
}

export function isUsablePepper(pepper: string | undefined): pepper is string {
  return typeof pepper === "string" && pepper.length >= MIN_PEPPER_LENGTH;
}

/** HMAC-SHA256 có tách miền theo loại mã (mã QR và mã dự phòng không bao giờ trùng HMAC). */
export function hmacLoginCode(pepper: string, kind: LoginCodeKind, code: string): Buffer {
  if (!isUsablePepper(pepper)) throw new Error("LOGIN_CODE_PEPPER_MISSING");
  return createHmac("sha256", pepper).update(`readmate.login-code.v1:${kind}:${code}`).digest();
}

/** Dạng bytea mà PostgREST nhận cho tham số hàm (`\x` + hex). */
export function toPgBytea(value: Buffer): string {
  return `\\x${value.toString("hex")}`;
}

/** HMAC dạng hex cho khóa giới hạn tần suất (không lưu IP thô). */
export function hmacHex(pepper: string, purpose: string, value: string): string {
  if (!isUsablePepper(pepper)) throw new Error("LOGIN_CODE_PEPPER_MISSING");
  return createHmac("sha256", pepper).update(`readmate.rate-limit.v1:${purpose}:${value}`).digest("hex");
}
