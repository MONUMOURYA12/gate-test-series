const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getCatalogue } = require("../controllers/studentController");
const router = express.Router();
router.get("/catalogue", protect, getCatalogue);
module.exports = router;
