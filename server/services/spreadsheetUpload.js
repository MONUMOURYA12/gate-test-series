const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { inflateRawSync } = require("node:zlib");
const { badRequest } = require("./apiValidation");

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 200;
let parsing = false;

function invalidFile() {
  return badRequest("The uploaded file could not be read. Use an Excel or CSV template.");
}

// Read the ZIP directory before SheetJS can inflate XLSX contents. ZIP64,
// encrypted and multi-disk archives are unnecessary for a 1000-question upload.
function validateExtraFields(buffer, start, length) {
  const end = start + length;
  if (end > buffer.length) throw invalidFile();
  while (start < end) {
    if (start + 4 > end || buffer.readUInt16LE(start) === 1) throw invalidFile();
    start += 4 + buffer.readUInt16LE(start + 2);
  }
  if (start !== end) throw invalidFile();
}

function validateArchive(buffer, checkContents = false) {
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) {
      end = offset;
      break;
    }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) ||
    buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) !== end) throw invalidFile();
  const count = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryStart = buffer.readUInt32LE(end + 16);
  if (!count || count > MAX_ARCHIVE_ENTRIES || count !== buffer.readUInt16LE(end + 8) ||
    directoryStart + directorySize !== end) throw invalidFile();
  let offset = directoryStart;
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw invalidFile();
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const localOffset = buffer.readUInt32LE(offset + 42);
    expanded += uncompressedSize;
    if ((flags & 0x2041) || ![0, 8].includes(method) || expanded > MAX_EXPANDED_BYTES ||
      uncompressedSize > 10 * 1024 * 1024 || compressedSize > MAX_FILE_BYTES ||
      buffer.readUInt16LE(offset + 34) !== 0 || localOffset + 30 > directoryStart ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50) throw invalidFile();
    const localCompressed = buffer.readUInt32LE(localOffset + 18);
    const localUncompressed = buffer.readUInt32LE(localOffset + 22);
    if (buffer.readUInt16LE(localOffset + 6) !== flags || buffer.readUInt16LE(localOffset + 8) !== method ||
      (localCompressed !== compressedSize && !((flags & 8) && localCompressed === 0)) ||
      (localUncompressed !== uncompressedSize && !((flags & 8) && localUncompressed === 0))) throw invalidFile();
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    if (dataStart + compressedSize > directoryStart) throw invalidFile();
    validateExtraFields(buffer, offset + 46 + buffer.readUInt16LE(offset + 28), buffer.readUInt16LE(offset + 30));
    validateExtraFields(buffer, localOffset + 30 + buffer.readUInt16LE(localOffset + 26), buffer.readUInt16LE(localOffset + 28));
    if (checkContents) {
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const inflated = method === 8 ? inflateRawSync(compressed, { maxOutputLength: Math.max(1, uncompressedSize) }) : compressed;
      if (inflated.length !== uncompressedSize) throw invalidFile();
    }
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (offset !== end) throw invalidFile();
}

function validateSpreadsheetFile(file) {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE_BYTES) throw invalidFile();
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (extension === ".xlsx") {
    if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) throw invalidFile();
    validateArchive(buffer);
  } else if (extension === ".xls") {
    if (buffer.length < 8 || buffer.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1") throw invalidFile();
  } else if (extension === ".csv") {
    // Plain UTF-8 CSV only; disguised binary/HTML workbooks are not CSV.
    if (buffer.includes(0) || /^\s*</.test(buffer.subarray(0, 1024).toString("utf8"))) throw invalidFile();
  } else {
    throw invalidFile();
  }
}

async function parseSpreadsheet(file) {
  validateSpreadsheetFile(file);
  if (parsing) {
    const error = new Error("Another spreadsheet is being processed. Please try again shortly.");
    error.status = 429;
    throw error;
  }
  parsing = true;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, "spreadsheetWorker.js"), {
        workerData: { buffer: file.buffer, extension: path.extname(file.originalname).toLowerCase() },
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      });
      const timeout = setTimeout(() => finish(invalidFile()), 10000);
      let settled = false;
      function finish(error, matrix) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        // Keep the concurrency slot occupied until the old parser has stopped.
        worker.terminate().finally(() => error ? reject(error) : resolve(matrix));
      }
      worker.once("message", message => {
        if (message.error) finish(badRequest(message.error));
        else finish(null, message.matrix);
      });
      worker.once("error", () => finish(invalidFile()));
      worker.once("exit", () => { if (!settled) finish(invalidFile()); });
    });
  } finally {
    parsing = false;
  }
}

module.exports = { parseSpreadsheet, validateSpreadsheetFile, validateArchive };
