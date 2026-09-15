const { validateText, sendControllerError } = require("../services/apiValidation");
const Branch = require("../models/Branch");

// Create a new branch
const createBranch = async (req, res) => {
  try {
    const { name, code, description } = req.body || {};
    validateText(name, "Branch name", { required: true });
    validateText(code, "Branch code", { required: true, max: 30 });
    validateText(description, "Description", { max: 5000 });

    if (!name || !code) {
      return res.status(400).json({
        message: "Branch name and code are required",
      });
    }

    const existingBranch = await Branch.findOne({
      code: code.toUpperCase(),
    });

    if (existingBranch) {
      return res.status(409).json({
        message: "Branch already exists",
      });
    }

    const branch = await Branch.create({
      name,
      code,
      description,
    });

    res.status(201).json({
      message: "Branch created successfully",
      branch,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// Get all branches
const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find({ isActive: true })
      .sort({ name: 1 });

    res.status(200).json({
      branches,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

module.exports = {
  createBranch,
  getBranches,
};