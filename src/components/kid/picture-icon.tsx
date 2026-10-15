import {
  Armchair,
  Baby,
  Backpack,
  Bike,
  Book,
  Cat,
  Citrus,
  CloudRain,
  Dog,
  Fish,
  Flag,
  Flower,
  Grape,
  Hand,
  House,
  ImageOff,
  Leaf,
  LeafyGreen,
  Notebook,
  Rabbit,
  Sailboat,
  Ship,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Tranh minh họa của bản chơi thử: biểu tượng nét đơn giản từ lucide-react (ISC) — xem nguồn và trạng thái
 * duyệt ở src/features/demo/practice-fixture.ts. Bản đồ chỉ từ mã biểu tượng → hình; KHÔNG có tên tranh
 * (tên tranh thường là đáp án).
 */
const PICTURE_ICONS: Readonly<Record<string, LucideIcon>> = {
  armchair: Armchair,
  baby: Baby,
  backpack: Backpack,
  bike: Bike,
  book: Book,
  cat: Cat,
  citrus: Citrus,
  "cloud-rain": CloudRain,
  dog: Dog,
  fish: Fish,
  flag: Flag,
  flower: Flower,
  grape: Grape,
  hand: Hand,
  house: House,
  leaf: Leaf,
  "leafy-green": LeafyGreen,
  notebook: Notebook,
  rabbit: Rabbit,
  sailboat: Sailboat,
  ship: Ship,
  "shopping-basket": ShoppingBasket,
};

export function hasPictureIcon(iconKey: string): boolean {
  return iconKey in PICTURE_ICONS;
}

export function PictureIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const Icon = PICTURE_ICONS[iconKey] ?? ImageOff;
  return <Icon aria-hidden="true" strokeWidth={1.75} className={cn("shrink-0", className)} />;
}
