import { positionKey, step, type ParsedLevel } from "./grid.ts";
import {
  ENCOUNTERS_PER_LEVEL,
  type GameAction,
  type GameEvent,
  type GameState,
  type RejectReason,
  type Trigger,
} from "./types.ts";

export function createInitialState(level: ParsedLevel): GameState {
  return {
    levelId: level.id,
    position: level.start,
    facing: "down",
    paused: false,
    completed: false,
    triggered: [],
    pendingEncounter: null,
    resolved: [],
    moves: 0,
    lastEvent: { type: "init" },
  };
}

/** Chỉ những điểm kích hoạt người chơi đã bước vào — dùng để vẽ, không lộ điểm chưa dùng. */
export function revealedTriggers(level: ParsedLevel, state: GameState): Trigger[] {
  return level.triggers.filter((t) => state.triggered.includes(t.id));
}

export function isTreasureOpenable(state: GameState): boolean {
  return state.resolved.length >= ENCOUNTERS_PER_LEVEL && state.pendingEncounter === null;
}

function next(state: GameState, patch: Partial<GameState>, lastEvent: GameEvent): GameState {
  return { ...state, ...patch, lastEvent };
}

function reject(state: GameState, reason: RejectReason): GameState {
  return next(state, {}, { type: "rejected", reason });
}

/** Reducer thuần: không sửa `state`, không ngẫu nhiên, không đọc thời gian. */
export function gameReducer(level: ParsedLevel, state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "PAUSE":
      if (state.completed) return reject(state, "completed");
      return next(state, { paused: true }, { type: "paused" });

    case "RESUME":
      if (state.completed) return reject(state, "completed");
      return next(state, { paused: false }, { type: "resumed" });

    case "MOVE": {
      if (state.completed) return reject(state, "completed");
      if (state.paused) return reject(state, "paused");
      if (state.pendingEncounter !== null) return reject(state, "encounter_pending");

      const result = step(level.grid, state.position, action.direction);
      if (result.kind === "blocked") {
        return next(state, { facing: action.direction }, { type: "blocked", by: result.by });
      }
      const moved = { facing: action.direction, position: result.position, moves: state.moves + 1 };
      const key = positionKey(result.position);

      const trigger = level.triggers.find((t) => positionKey(t) === key);
      if (trigger && !state.triggered.includes(trigger.id) && state.triggered.length < ENCOUNTERS_PER_LEVEL) {
        return next(
          state,
          { ...moved, triggered: [...state.triggered, trigger.id], pendingEncounter: trigger.id },
          { type: "encounter_triggered", triggerId: trigger.id },
        );
      }
      if (key === positionKey(level.treasure)) {
        return isTreasureOpenable(state)
          ? next(state, { ...moved, completed: true }, { type: "treasure_opened" })
          : next(state, moved, { type: "treasure_locked" });
      }
      return next(state, moved, { type: "moved" });
    }

    case "ENCOUNTER_DISMISSED": {
      if (state.pendingEncounter === null) return reject(state, "no_pending_encounter");
      if (state.pendingEncounter !== action.triggerId) return reject(state, "wrong_encounter");
      return next(state, { pendingEncounter: null }, { type: "encounter_resolved", triggerId: action.triggerId });
    }

    case "ENCOUNTER_RESOLVED": {
      if (state.pendingEncounter === null) return reject(state, "no_pending_encounter");
      if (state.pendingEncounter !== action.triggerId) return reject(state, "wrong_encounter");
      return next(
        state,
        {
          pendingEncounter: null,
          resolved: [...state.resolved, { triggerId: action.triggerId, outcome: action.outcome }],
        },
        { type: "encounter_resolved", triggerId: action.triggerId },
      );
    }
  }
}
