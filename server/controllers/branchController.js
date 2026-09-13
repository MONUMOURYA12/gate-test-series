const Branch = require("../models/Branch");

// Create a new branch
const createBranch = async (req, res) => {
  try {
    const { name, code, description } = req.body;

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
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createBranch,
  getBranches,
};