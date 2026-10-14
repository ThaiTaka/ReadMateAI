import type { UnitId } from "../../lib/vietnamese/decodability.ts";
import type { KnowledgeBase } from "./load.ts";

/**
 * Đồ thị tiên quyết giữa các đơn vị kiến thức:
 * - cạnh suy ra theo cấu tạo: âm → chữ cái tạo nên âm; vần → nguyên âm (âm đệm, âm chính) và âm cuối;
 * - cạnh khai báo trong content/kb/prerequisites.json (thứ tự dạy).
 * Đồ thị phải không có vòng — bộ kiểm tra nội dung chặn vòng lặp.
 */

export type PrerequisiteGraph = ReadonlyMap<UnitId, ReadonlySet<UnitId>>;

export type PrerequisiteEdgeSource = { from: UnitId; to: UnitId; basis: "structural" | "declared" };

export function structuralEdges(kb: Pick<KnowledgeBase, "phonemes" | "rimes">): PrerequisiteEdgeSource[] {
  const edges: PrerequisiteEdgeSource[] = [];
  for (const phoneme of kb.phonemes) {
    for (const letter of phoneme.letters) edges.push({ from: phoneme.id, to: letter, basis: "structural" });
  }
  for (const rime of kb.rimes) {
    const vowels = new Set(Array.from((rime.medial ?? "") + rime.nucleus));
    const parts = [
      ...Array.from(vowels, (vowel) => `phoneme:${vowel}`),
      ...(rime.coda ? [`phoneme:${rime.coda}`] : []),
    ];
    for (const part of parts) edges.push({ from: rime.id, to: part, basis: "structural" });
  }
  return edges;
}

export function buildPrerequisiteGraph(kb: Pick<KnowledgeBase, "phonemes" | "rimes" | "prerequisites">): {
  graph: PrerequisiteGraph;
  edges: PrerequisiteEdgeSource[];
} {
  const edges = [
    ...structuralEdges(kb),
    ...kb.prerequisites.flatMap((edge) =>
      edge.requires.map((to): PrerequisiteEdgeSource => ({ from: edge.unit, to, basis: "declared" })),
    ),
  ];
  const graph = new Map<UnitId, Set<UnitId>>();
  for (const edge of edges) {
    const targets = graph.get(edge.from) ?? new Set<UnitId>();
    targets.add(edge.to);
    graph.set(edge.from, targets);
  }
  return { graph, edges };
}

/** Tìm một vòng lặp (nếu có) bằng duyệt theo chiều sâu; trả về chuỗi đơn vị khép kín. */
export function findCycle(graph: PrerequisiteGraph): UnitId[] | null {
  const state = new Map<UnitId, "visiting" | "done">();
  const stack: UnitId[] = [];

  const visit = (node: UnitId): UnitId[] | null => {
    state.set(node, "visiting");
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const seen = state.get(next);
      if (seen === "visiting") return [...stack.slice(stack.indexOf(next)), next];
      if (seen === undefined) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(node, "done");
    return null;
  };

  for (const node of graph.keys()) {
    if (state.get(node) === undefined) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

/** Tiên quyết trực tiếp của một đơn vị. */
export function directPrerequisites(graph: PrerequisiteGraph, unit: UnitId): UnitId[] {
  return [...(graph.get(unit) ?? [])];
}
