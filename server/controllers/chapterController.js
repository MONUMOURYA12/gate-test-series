const { requireId, validateHierarchyIds, validateText, sendControllerError } = require("../services/apiValidation");
const Chapter = require("../models/Chapter");
const Subject = require("../models/Subject");

// Create a new chapter
const createChapter = async (req, res) => {
  try {
    const { name, description, subject, order } = req.body || {};
    validateHierarchyIds(req.body);
    validateText(name, "Name", { required: true });
    validateText(description, "Description", { max: 5000 });

    if (!name || !subject) {
      return res.status(400).json({
        message: "Chapter name and subject are required",
      });
    }

    // Check whether subject exists
    const existingSubject = await Subject.findById(subject);

    if (!existingSubject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    // Check duplicate chapter
    const existingChapter = await Chapter.findOne({
      name: name.trim(),
      subject,
    });

    if (existingChapter) {
      return res.status(409).json({
        message: "Chapter already exists in this subject",
      });
    }

    const chapter = await Chapter.create({
      name,
      description,
      subject,
      order,
    });

    res.status(201).json({
      message: "Chapter created successfully",
      chapter,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// Get all chapters
const getChapters = async (req, res) => {
  try {
    const chapters = await Chapter.find({ isActive: true })
      .populate("subject", "name code")
      .sort({ order: 1, name: 1 });

    res.status(200).json({
      chapters,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// Get chapters by subject
const getChaptersBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    requireId(subjectId, "subjectId");

    const chapters = await Chapter.find({
      subject: subjectId,
      isActive: true,
    }).sort({ order: 1, name: 1 });

    res.status(200).json({
      chapters,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

module.exports = {
  createChapter,
  getChapters,
  getChaptersBySubject,
};