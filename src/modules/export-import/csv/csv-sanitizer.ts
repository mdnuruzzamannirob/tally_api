export function neutralizeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeCsv(value: string | null): string {
  const normalized = value === null ? "" : neutralizeCsvFormula(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}
