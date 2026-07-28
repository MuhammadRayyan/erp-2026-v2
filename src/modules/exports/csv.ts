export type CsvValue = string | number | boolean | Date | null | undefined;

function stringValue(value: CsvValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function neutralizeFormula(value: CsvValue, text: string) {
  if (typeof value !== "string") return text;
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function escapeCell(value: CsvValue) {
  const text = neutralizeFormula(value, stringValue(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(headers: string[], rows: CsvValue[][]) {
  const lines = [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
