const { parentPort, workerData } = require("node:worker_threads");
const XLSX = require("xlsx");
const { validateArchive } = require("./spreadsheetUpload");

try {
  const buffer = Buffer.from(workerData.buffer);
  if (workerData.extension === ".xlsx") validateArchive(buffer, true);
  const workbook = XLSX.read(buffer, {
    type: "buffer", sheets: 0, sheetRows: 1002, dense: true,
    cellFormula: false, cellHTML: false, bookVBA: false,
  });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error("missing sheet");
  const range = XLSX.utils.decode_range(worksheet["!fullref"] || worksheet["!ref"] || "A1");
  if (range.e.r > 1000 || range.e.c > 63) {
    parentPort.postMessage({ error: "A spreadsheet can contain at most 1000 question rows and 64 columns." });
  } else {
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", blankrows: false });
    if (matrix.some(row => row.some(value => String(value).length > 30000))) {
      parentPort.postMessage({ error: "Spreadsheet cells must not exceed 30000 characters." });
    } else {
      parentPort.postMessage({ matrix });
    }
  }
} catch {
  parentPort.postMessage({ error: "The uploaded file could not be read. Use the provided template." });
}
