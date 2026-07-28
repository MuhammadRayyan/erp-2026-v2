export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = "";
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }

  if (quoted) throw new Error("CATALOG_IMPORT_UNCLOSED_QUOTE");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function csvRecords(input: string) {
  const [headerRow, ...dataRows] = parseCsv(input);
  if (!headerRow) throw new Error("CATALOG_IMPORT_EMPTY");
  const headers = headerRow.map((value) => value.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CATALOG_IMPORT_DUPLICATE_HEADERS");
  return dataRows.map((values, index) => ({
    rowNumber: index + 2,
    data: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])),
  }));
}
