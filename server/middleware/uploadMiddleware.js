const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".xlsx", ".xls", ".csv"];

  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel or CSV files (.xlsx, .xls, .csv) are allowed"));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    // Busboy raises partsLimit when it reaches the limit, including the file.
    parts: 2,
    headerPairs: 20,
  },
  fileFilter,
});

module.exports = upload;
