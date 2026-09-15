const { requireId, validateHierarchyIds, validateText, sendControllerError } = require("../services/apiValidation");
const Subject = require("../models/Subject");
const Branch = require("../models/Branch");

// Create a new subject
const createSubject = async (req, res) => {
  try {
    const { name, code, description, branch } = req.body || {};
    validateHierarchyIds(req.body);
    validateText(name, "Name", { required: true });
    validateText(description, "Description", { max: 5000 });

    // Validate required fields
    if (!name || !branch) {
      return res.status(400).json({
        message: "Subject name and branch are required",
      });
    }

    // Check whether branch exists
    const existingBranch = await Branch.findById(branch);

    if (!existingBranch) {
      return res.status(404).json({
        message: "Branch not found",
      });
    }

    // Check duplicate subject in same branch
    const existingSubject = await Subject.findOne({
      name: name.trim(),
      branch,
    });

    if (existingSubject) {
      return res.status(409).json({
        message: "Subject already exists in this branch",
      });
    }

    const subject = await Subject.create({
      name,
      code,
      description,
      branch,
    });

    res.status(201).json({
      message: "Subject created successfully",
      subject,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// Get all subjects
const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ isActive: true })
      .populate("branch", "name code")
      .sort({ name: 1 });

    res.status(200).json({
      subjects,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// Get subjects by branch
const getSubjectsByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    requireId(branchId, "branchId");

    const subjects = await Subject.find({
      branch: branchId,
      isActive: true,
    }).sort({ name: 1 });

    res.status(200).json({
      subjects,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

module.exports = {
  createSubject,
  getSubjects,
  getSubjectsByBranch,
};