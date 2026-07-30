export type OpeningBalanceImportAccount = {
  id: string;
  code: string;
};

export type OpeningBalanceImportRow = {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
};

export type OpeningBalanceImportSummary = {
  rowCount: number;
  totalDebit: string;
  totalCredit: string;
  netDifference: string;
  fingerprint: string;
};

export type OpeningBalanceImportResult = {
  rows: OpeningBalanceImportRow[];
  errors: string[];
  summary: OpeningBalanceImportSummary;
};

const amountPattern = /^\d{1,16}(?:\.\d{1,4})?$/;

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("Unclosed quoted field.");
  cells.push(cell.trim());
  return cells;
}

function normalizeAmount(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? "0" : trimmed;
}

function amount(value: number) {
  return value.toFixed(4);
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function summarize(rows: OpeningBalanceImportRow[]): OpeningBalanceImportSummary {
  const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit), 0);
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit), 0);
  const normalizedRows = rows.map((row) => ({
    accountId: row.accountId,
    description: row.description.trim(),
    debit: amount(Number(row.debit)),
    credit: amount(Number(row.credit)),
  }));

  return {
    rowCount: rows.length,
    totalDebit: amount(totalDebit),
    totalCredit: amount(totalCredit),
    netDifference: amount(totalDebit - totalCredit),
    fingerprint: `obimp_${stableHash(JSON.stringify(normalizedRows))}`,
  };
}

function isHeader(cells: string[]) {
  return cells[0]?.trim().toLowerCase() === "accountcode";
}

export function parseOpeningBalanceCsv(csv: string, accounts: OpeningBalanceImportAccount[]): OpeningBalanceImportResult {
  const accountByCode = new Map(accounts.map((account) => [account.code.trim().toUpperCase(), account]));
  const rows: OpeningBalanceImportRow[] = [];
  const errors: string[] = [];

  csv.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const lineNumber = lineIndex + 1;
    const line = rawLine.trim();
    if (!line) return;

    let cells: string[];
    try {
      cells = splitCsvLine(line);
    } catch (error) {
      errors.push(`Line ${lineNumber}: ${error instanceof Error ? error.message : "Invalid CSV line."}`);
      return;
    }

    if (lineIndex === 0 && isHeader(cells)) return;
    if (cells.length < 4) {
      errors.push(`Line ${lineNumber}: Expected accountCode, description, debit, credit.`);
      return;
    }

    const [accountCode, description = "", debitValue, creditValue] = cells;
    const account = accountByCode.get(accountCode.trim().toUpperCase());
    if (!account) {
      errors.push(`Line ${lineNumber}: Account code ${accountCode || "(blank)"} is not eligible for opening balances.`);
      return;
    }

    const debit = normalizeAmount(debitValue);
    const credit = normalizeAmount(creditValue);
    if (!amountPattern.test(debit) || !amountPattern.test(credit)) {
      errors.push(`Line ${lineNumber}: Amounts must be non-negative with up to four decimal places.`);
      return;
    }

    const debitNumber = Number(debit);
    const creditNumber = Number(credit);
    if ((debitNumber > 0) === (creditNumber > 0)) {
      errors.push(`Line ${lineNumber}: Provide exactly one positive debit or credit amount.`);
      return;
    }

    rows.push({ accountId: account.id, description, debit, credit });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Paste at least one opening-balance row.");
  }

  return { rows, errors, summary: summarize(rows) };
}
