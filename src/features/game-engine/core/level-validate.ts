import { createGrid, positionKey, reachableFrom } from "./grid.ts";
import {
  ENCOUNTERS_PER_LEVEL,
  MAX_LEVEL_SIZE,
  MIN_LEVEL_SIZE,
  type Level,
  type LevelError,
  type Position,
} from "./types.ts";

const VALID_CHARS = new Set(["#", ".", "S", "T"]);

/** Trả mọi lỗi tìm được (rỗng = màn hợp lệ). Hàm thuần, thứ tự lỗi xác định. */
export function validateLevel(level: Level): LevelError[] {
  const errors: LevelError[] = [];
  const add = (error: LevelError) => errors.push(error);
  const rows = level.rows;

  const width = rows[0]?.length ?? 0;
  if (rows.length < MIN_LEVEL_SIZE || rows.length > MAX_LEVEL_SIZE) {
    add({
      code: "SIZE_OUT_OF_RANGE",
      message: `Số hàng ${rows.length} ngoài khoảng ${MIN_LEVEL_SIZE}–${MAX_LEVEL_SIZE}.`,
    });
  }
  if (width < MIN_LEVEL_SIZE || width > MAX_LEVEL_SIZE) {
    add({ code: "SIZE_OUT_OF_RANGE", message: `Số cột ${width} ngoài khoảng ${MIN_LEVEL_SIZE}–${MAX_LEVEL_SIZE}.` });
  }

  const starts: Position[] = [];
  const treasures: Position[] = [];
  rows.forEach((line, row) => {
    if (line.length !== width) {
      add({
        code: "ROW_LENGTH_MISMATCH",
        message: `Hàng ${row} dài ${line.length}, cần ${width}.`,
        position: { row, col: 0 },
      });
    }
    for (let col = 0; col < line.length; col += 1) {
      const char = line.charAt(col);
      if (!VALID_CHARS.has(char)) {
        add({ code: "UNKNOWN_CELL", message: `Ký tự ô không hợp lệ "${char}".`, position: { row, col } });
      } else if (char === "S") starts.push({ row, col });
      else if (char === "T") treasures.push({ row, col });
    }
  });

  if (starts.length !== 1) {
    add({ code: "START_COUNT", message: `Cần đúng 1 ô xuất phát, có ${starts.length}.`, position: starts[1] });
  }
  if (treasures.length !== 1) {
    add({ code: "TREASURE_COUNT", message: `Cần đúng 1 rương, có ${treasures.length}.`, position: treasures[1] });
  }
  if (level.triggers.length !== ENCOUNTERS_PER_LEVEL) {
    add({
      code: "TRIGGER_COUNT",
      message: `Cần đúng ${ENCOUNTERS_PER_LEVEL} điểm kích hoạt, có ${level.triggers.length}.`,
    });
  }

  const grid = createGrid(rows);
  const seenIds = new Set<string>();
  const seenPositions = new Set<string>();
  for (const trigger of level.triggers) {
    const position = { row: trigger.row, col: trigger.col };
    if (seenIds.has(trigger.id)) {
      add({
        code: "TRIGGER_ID_DUPLICATE",
        message: `Mã điểm kích hoạt "${trigger.id}" bị trùng.`,
        triggerId: trigger.id,
        position,
      });
    }
    seenIds.add(trigger.id);
    const key = positionKey(position);
    if (seenPositions.has(key)) {
      add({
        code: "TRIGGER_DUPLICATE_POSITION",
        message: `Hai điểm kích hoạt cùng tọa độ ${key}.`,
        triggerId: trigger.id,
        position,
      });
    }
    seenPositions.add(key);

    const kind = Number.isInteger(trigger.row) && Number.isInteger(trigger.col) ? grid.kindAt(position) : undefined;
    if (kind === undefined) {
      add({
        code: "TRIGGER_OUT_OF_BOUNDS",
        message: `Điểm kích hoạt "${trigger.id}" ngoài bản đồ.`,
        triggerId: trigger.id,
        position,
      });
    } else if (kind !== "path") {
      add({
        code: "TRIGGER_NOT_ON_PATH",
        message: `Điểm kích hoạt "${trigger.id}" phải nằm trên ô đường đi thường (không phải ${kind}).`,
        triggerId: trigger.id,
        position,
      });
    }
  }

  // Liên thông chỉ có nghĩa khi đã có đúng một điểm xuất phát.
  const [start] = starts;
  const [treasure] = treasures;
  if (start && starts.length === 1) {
    const reach = reachableFrom(grid, start);
    rows.forEach((line, row) => {
      for (let col = 0; col < line.length; col += 1) {
        if (VALID_CHARS.has(line.charAt(col)) && line.charAt(col) !== "#" && !reach.has(positionKey({ row, col }))) {
          add({
            code: "PATH_DISCONNECTED",
            message: "Ô đường đi không liên thông với xuất phát.",
            position: { row, col },
          });
        }
      }
    });
    if (treasure && treasures.length === 1 && !reach.has(positionKey(treasure))) {
      add({ code: "TREASURE_UNREACHABLE", message: "Không có đường từ xuất phát tới rương.", position: treasure });
    }
    for (const trigger of level.triggers) {
      const position = { row: trigger.row, col: trigger.col };
      if (grid.kindAt(position) === "path" && !reach.has(positionKey(position))) {
        add({
          code: "TRIGGER_UNREACHABLE",
          message: `Không tới được điểm kích hoạt "${trigger.id}".`,
          triggerId: trigger.id,
          position,
        });
      }
    }
  }
  return errors;
}
