import Papa from "papaparse";
import * as XLSX from "xlsx";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
};

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function normalizeHeaders(raw: unknown[]): string[] {
  return raw.map((h, i) => {
    const s = cellToString(h);
    return s || `column_${i + 1}`;
  });
}

function rowsFromMatrix(matrix: unknown[][]): ParsedSheet {
  if (!matrix.length) {
    throw new ParseError("File has no rows");
  }
  const headers = normalizeHeaders(matrix[0] as unknown[]);
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] as unknown[];
    if (!line || line.every((c) => cellToString(c) === "")) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cellToString(line[c]);
    }
    rows.push(obj);
  }
  if (!rows.length) {
    throw new ParseError("File has no data rows");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ParseError(
      `Too many rows (${rows.length}). Max is ${MAX_IMPORT_ROWS}`
    );
  }
  return { headers, rows };
}

export function parseCsvBuffer(buf: Buffer | string): ParsedSheet {
  const text = typeof buf === "string" ? buf : buf.toString("utf8");
  if (!text.trim()) throw new ParseError("Empty file");

  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  if (result.errors?.length) {
    const first = result.errors[0];
    throw new ParseError(
      `CSV parse error${first.row != null ? ` at row ${first.row}` : ""}: ${first.message}`
    );
  }
  const data = (result.data || []) as string[][];
  return rowsFromMatrix(data);
}

export function parseXlsxBuffer(buf: Buffer): ParsedSheet {
  if (!buf.length) throw new ParseError("Empty file");
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch {
    throw new ParseError("Could not read spreadsheet");
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new ParseError("Spreadsheet has no sheets");
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return rowsFromMatrix(matrix);
}

export function parseImportFile(
  filename: string,
  buf: Buffer
): ParsedSheet {
  if (!buf || buf.length === 0) throw new ParseError("Empty file");
  if (buf.length > MAX_IMPORT_BYTES) {
    throw new ParseError("File too large (max 5 MB)");
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsvBuffer(buf);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsxBuffer(buf);
  }
  throw new ParseError("Only .csv, .xlsx, or .xls files are supported");
}
