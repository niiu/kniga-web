/** Move `fromId` so it sits at `insertBefore` in the original list (0 = top, length = bottom). */
export function reorderScenesByInsert<T extends { id: string }>(
  scenes: readonly T[],
  fromId: string,
  insertBefore: number,
): T[] {
  const fromIndex = scenes.findIndex((s) => s.id === fromId);
  if (fromIndex === -1) return scenes as T[];
  let dest = insertBefore;
  if (fromIndex < dest) dest -= 1;
  dest = Math.max(0, Math.min(dest, scenes.length - 1));
  if (fromIndex === dest) return scenes as T[];
  const next = scenes.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(dest, 0, moved);
  return next;
}

/** Index in the list to insert before, from a pointer Y and row boxes. */
export function insertBeforeFromY(
  clientY: number,
  rows: Array<{ top: number; height: number }>,
): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (clientY < row.top + row.height / 2) return i;
  }
  return rows.length;
}
