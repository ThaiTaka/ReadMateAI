import {
  ArrowDownUp,
  BookOpen,
  Ear,
  Eye,
  Footprints,
  Link2,
  MousePointerClick,
  PencilLine,
  Puzzle,
  Rocket,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";
import type { InstructionIcon, LearningPathId } from "@/types/learning";

/**
 * Hình thức hiển thị của lộ trình và biểu tượng hướng dẫn.
 * Mỗi lộ trình có màu + biểu tượng + tên — không phân biệt chỉ bằng màu.
 * Lớp Tailwind phải là chuỗi đầy đủ (không ghép động) để trình quét lớp nhận ra.
 */
export type PathVisual = {
  Icon: LucideIcon;
  badgeTone: BadgeTone;
  surface: string;
  iconBubble: string;
  accentText: string;
};

export const PATH_VISUALS: Readonly<Record<LearningPathId, PathVisual>> = {
  "khoi-dong": {
    Icon: Sprout,
    badgeTone: "lagoon",
    surface: "border-lagoon-200 bg-lagoon-50",
    iconBubble: "bg-lagoon-600 text-white",
    accentText: "text-lagoon-700",
  },
  "vung-buoc": {
    Icon: Footprints,
    badgeTone: "brand",
    surface: "border-brand-200 bg-brand-50",
    iconBubble: "bg-brand-600 text-white",
    accentText: "text-brand-700",
  },
  "tang-toc": {
    Icon: Rocket,
    badgeTone: "coral",
    surface: "border-coral-200 bg-coral-50",
    iconBubble: "bg-coral-600 text-white",
    accentText: "text-coral-700",
  },
};

/** Biểu tượng hướng dẫn dùng chung giữa ứng dụng và phiếu (PRD §5). Bộ SVG riêng sẽ thay ở GĐ4. */
export const INSTRUCTION_ICONS: Readonly<Record<InstructionIcon, LucideIcon>> = {
  listen: Ear,
  look: Eye,
  choose: MousePointerClick,
  match: Link2,
  build: Puzzle,
  fill: PencilLine,
  arrange: ArrowDownUp,
  read: BookOpen,
};
