/**
 * Timeline tool state machine — docs/test-001.md §2, the same `activeTool`
 * model Audio Editor uses, so the two tools do not teach two different sets
 * of muscle memory.
 */

export type ToolId = "select" | "split" | "slip" | "pan";

export interface ToolSpec {
  id: ToolId;
  /** single-key shortcut, matched case-insensitively */
  shortcut: string;
  /** CSS cursor while this tool is active over the track area */
  cursor: string;
}

export const TOOLS: ToolSpec[] = [
  { id: "select", shortcut: "v", cursor: "default" },
  { id: "split", shortcut: "c", cursor: "col-resize" },
  { id: "slip", shortcut: "y", cursor: "ew-resize" },
  { id: "pan", shortcut: "h", cursor: "grab" },
];

export function toolForKey(key: string): ToolId | null {
  const match = TOOLS.find((tool) => tool.shortcut === key.toLowerCase());
  return match ? match.id : null;
}

export function cursorFor(tool: ToolId, spaceHeld: boolean): string {
  // holding Space temporarily borrows the pan tool without losing the one
  // that was selected (§2) — releasing it puts the old cursor back
  if (spaceHeld) return "grabbing";
  return TOOLS.find((t) => t.id === tool)?.cursor ?? "default";
}
