import { GAME_KEYS, GAME_MIN_BALANCE, type GameKey } from "../gamification/rules.ts";

/**
 * Danh mục Game World (dữ liệu miền, R02). Mọi mini-game hiện là BẢN XEM TRƯỚC: chưa có màn chơi, chưa có
 * nút vào chơi hoạt động (Game Engine dự kiến R07–R09). Ngưỡng điểm lấy từ `GAME_MIN_BALANCE` — không chép số.
 * Tên game, nhân vật là tên gọi tạm, chờ GV góp ý (RQ-M5).
 */

export type GameWorldInfo = {
  key: GameKey;
  name: string;
  tagline: string;
  description: string;
  /** Kiến thức luyện trong game (để người lớn hiểu; học sinh không thấy nhóm/lộ trình). */
  skills: readonly string[];
  /** Cách khám phá dự kiến trong game. */
  howToPlay: string;
  minBalance: number;
  /** Giai đoạn dự kiến xây dựng. */
  plannedPhase: string;
  /** Lớp màu nhấn của thẻ (chuỗi đầy đủ để Tailwind quét được). */
  accent: { ring: string; chip: string; text: string };
};

const INFO: Readonly<Record<GameKey, Omit<GameWorldInfo, "key" | "minBalance">>> = {
  treasure_maze: {
    name: "Mê cung kho báu",
    tagline: "Tìm đường tới rương báu",
    description:
      "Dẫn bạn nhỏ đi qua mê cung hàng rào cây. Trên đường gặp 7 bạn quái vật thân thiện, mỗi bạn hỏi 3 câu Tiếng Việt.",
    skills: ["Nhận diện chữ – âm", "Ghép tiếng", "Đọc từ"],
    howToPlay: "Đi bằng 4 nút mũi tên lớn hoặc phím mũi tên; trả lời câu hỏi để giúp quái vật đi ngủ.",
    plannedPhase: "R07–R08",
    accent: { ring: "ring-jade-300", chip: "bg-jade-100 text-jade-800", text: "text-jade-700" },
  },
  wonder_forest: {
    name: "Rừng chữ kỳ diệu",
    tagline: "Những cây chữ biết phát sáng",
    description: "Đi theo lối mòn rẽ nhánh trong khu rừng có những cây chữ phát sáng. Mỗi trạm là một thử thách nhỏ.",
    skills: ["Nhìn tranh – chọn chữ", "Tìm âm đầu, vần"],
    howToPlay: "Chọn ngả rẽ bằng nút lớn; mỗi cây chữ là một thử thách 3 câu.",
    plannedPhase: "R09",
    accent: { ring: "ring-brand-300", chip: "bg-brand-100 text-brand-800", text: "text-brand-700" },
  },
  tone_island: {
    name: "Đảo dấu thanh",
    tagline: "Chèo thuyền qua năm hòn đảo",
    description: "Chèo thuyền giữa các đảo nhỏ, mỗi đảo gắn với một dấu thanh. Nghe – nhìn – chọn đúng dấu để cập bến.",
    skills: ["Nhận biết dấu thanh", "Ghép tiếng có thanh"],
    howToPlay: "Bấm nút chọn hòn đảo kế tiếp; mỗi đảo là một thử thách 3 câu.",
    plannedPhase: "R09",
    accent: { ring: "ring-lagoon-200", chip: "bg-lagoon-100 text-lagoon-800", text: "text-lagoon-700" },
  },
  rhyme_castle: {
    name: "Lâu đài ghép vần",
    tagline: "Leo từng tầng lâu đài",
    description: "Leo lên các tầng của lâu đài cổ tích. Ở mỗi tầng, ghép âm với vần để mở cánh cửa tiếp theo.",
    skills: ["Ghép âm – vần", "Điền vần còn thiếu", "Đọc câu ngắn"],
    howToPlay: "Mỗi tầng là một thử thách; ghép đúng để mở cửa lên tầng trên.",
    plannedPhase: "R09",
    accent: { ring: "ring-magic-300", chip: "bg-magic-100 text-magic-800", text: "text-magic-700" },
  },
};

export const GAME_WORLDS: readonly GameWorldInfo[] = GAME_KEYS.map((key) => ({
  key,
  minBalance: GAME_MIN_BALANCE[key],
  ...INFO[key],
}));

export function gameWorld(key: GameKey): GameWorldInfo {
  const found = GAME_WORLDS.find((game) => game.key === key);
  if (!found) throw new Error(`Không có game ${key}`);
  return found;
}

/** Tám mốc khám phá đầu tiên của bản đồ mùa đầu (mỗi mốc ứng với MAP_TILE_STEP điểm tích lũy). */
export type MapTileKey =
  | "flower_meadow"
  | "lotus_pond"
  | "bamboo_grove"
  | "rice_field"
  | "wooden_bridge"
  | "kite_hill"
  | "lantern_village"
  | "star_lookout";

export const MAP_TILES: ReadonlyArray<{ key: MapTileKey; name: string }> = [
  { key: "flower_meadow", name: "Đồi hoa" },
  { key: "lotus_pond", name: "Ao sen" },
  { key: "bamboo_grove", name: "Lũy tre" },
  { key: "rice_field", name: "Ruộng lúa" },
  { key: "wooden_bridge", name: "Cầu gỗ" },
  { key: "kite_hill", name: "Đồi thả diều" },
  { key: "lantern_village", name: "Làng đèn lồng" },
  { key: "star_lookout", name: "Đài ngắm sao" },
];
