/** Ghép className, bỏ qua giá trị rỗng/false. Không gộp xung đột lớp Tailwind — tránh truyền lớp mâu thuẫn. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
