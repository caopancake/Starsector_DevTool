// Log entry fields helper: drops empty values so log lines stay dense;
// returns null when nothing remains, matching the nullable wire field.
export function logFields(values: Record<string, string | number | null | undefined>): Record<string, string> | null {
  const entries = Object.entries(values).filter(([, value]) => value !== null && value !== undefined && value !== '');
  return entries.length > 0 ? Object.fromEntries(entries.map(([key, value]) => [key, String(value)])) : null;
}
