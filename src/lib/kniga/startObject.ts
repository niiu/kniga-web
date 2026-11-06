export type StartCopyAction = "add" | "update" | "same";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** How a sheet value would land in the start object. */
export function startCopyAction(
  starting: Record<string, number>,
  name: string,
  value: number,
): StartCopyAction {
  if (!(name in starting)) return "add";
  return starting[name] === value ? "same" : "update";
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, number>;
}

/**
 * Copy picked numbers onto a start-object map.
 * Keys that were not picked stay as they are. Returns the same object when nothing changes.
 */
export function mergeStartValues(
  starting: Record<string, number> | null | undefined,
  picked: Record<string, number> | null | undefined,
): Record<string, number> {
  const base = asNumberRecord(starting);
  const source = asNumberRecord(picked);
  const changes: Array<[string, number]> = [];
  for (const [rawName, rawValue] of Object.entries(source)) {
    const name = rawName.trim();
    const value = finiteNumber(rawValue);
    if (!name || value === null) continue;
    if (base[name] === value) continue;
    changes.push([name, value]);
  }
  if (changes.length === 0) return base;
  const next = { ...base };
  for (const [name, value] of changes) next[name] = value;
  return next;
}

export function hasStartUpdates(
  starting: Record<string, number>,
  sources: Record<string, number>,
): boolean {
  return mergeStartValues(starting, sources) !== starting;
}
