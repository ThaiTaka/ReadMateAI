import { levelFileSchema, toLevel } from "./schema.ts";
import level1 from "../../../../content/games/treasure-maze/levels/level-01.json";
import level2 from "../../../../content/games/treasure-maze/levels/level-02.json";
import level3 from "../../../../content/games/treasure-maze/levels/level-03.json";

/** Ba màn Mê cung đóng gói trong ứng dụng (dùng ở /demo và /learn/me/games/treasure-maze); đã qua zod lúc nạp. */
export const BUNDLED_LEVEL_FILES = [level1, level2, level3].map((raw) => levelFileSchema.parse(raw));

export const BUNDLED_LEVELS = BUNDLED_LEVEL_FILES.map(toLevel);
