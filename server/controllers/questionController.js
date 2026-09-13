const Question = require("../models/Question");
const Test = require("../models/Test");
const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const XLSX = require("xlsx");

// ============================================================
// HELPER: UPDATE TEST STATISTICS
// ============================================================

const updateTestStatistics = async (testId) => {
  const totalQuestions = await Question.countDocuments({
    test: testId,
    isActive: true,
  });

  const questions = await Question.find({
    test: testId,
    isActive: true,
  }).select("marks");

  const totalMarks = questions.reduce(
    (sum, question) => sum + question.marks,
    0
  );

  await Test.findByIdAndUpdate(testId, {
    totalQuestions,
    totalMarks,
  });

  return {
    totalQuestions,
    totalMarks,
  };
};

// ============================================================
// CREATE SINGLE QUESTION
// ============================================================

const createQuestion = async (req, res) => {
  try {
    const {
      branch,
      subject,
      chapter,
      test,
      questionNumber,
      questionText,
      questionType = "mcq",
      options = [],
      correctAnswer,
      marks = 1,
      negativeMarks = 0,
      isPYQ = false,
      examName = "GATE",
      year,
      session,
      difficulty = "medium",
      category,
      topic,
      tags = [],
      explanation,
      solutionType = "none",
      aiSolutionGenerated = false,
      aiSolutionModel,
      isActive = true,
      isPublished = true,
    } = req.body;

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (
      !branch ||
      !subject ||
      !chapter ||
      !questionText ||
      correctAnswer === undefined
    ) {
      return res.status(400).json({
        message:
          "Branch, subject, chapter, question text and correct answer are required",
      });
    }

    // --------------------------------------------------------
    // Validate question type
    // --------------------------------------------------------

    if (!["mcq", "msq", "nat"].includes(questionType)) {
      return res.status(400).json({
        message:
          "questionType must be mcq, msq or nat",
      });
    }

    // --------------------------------------------------------
    // Validate difficulty
    // --------------------------------------------------------

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({
        message:
          "difficulty must be easy, medium or hard",
      });
    }

    // --------------------------------------------------------
    // Validate branch
    // --------------------------------------------------------

    const existingBranch = await Branch.findById(branch);

    if (!existingBranch) {
      return res.status(404).json({
        message: "Branch not found",
      });
    }

    // --------------------------------------------------------
    // Validate subject
    // --------------------------------------------------------

    const existingSubject = await Subject.findById(subject);

    if (!existingSubject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    // --------------------------------------------------------
    // Make sure subject belongs to branch
    // --------------------------------------------------------

    if (
      existingSubject.branch.toString() !==
      branch.toString()
    ) {
      return res.status(400).json({
        message:
          "Subject does not belong to the selected branch",
      });
    }

    // --------------------------------------------------------
    // Validate chapter
    // --------------------------------------------------------

    const existingChapter = await Chapter.findById(chapter);

    if (!existingChapter) {
      return res.status(404).json({
        message: "Chapter not found",
      });
    }

    // --------------------------------------------------------
    // Make sure chapter belongs to subject
    // --------------------------------------------------------

    if (
      existingChapter.subject.toString() !==
      subject.toString()
    ) {
      return res.status(400).json({
        message:
          "Chapter does not belong to the selected subject",
      });
    }

    // --------------------------------------------------------
    // Validate test if provided
    // --------------------------------------------------------

    if (test) {
      const existingTest = await Test.findById(test);

      if (!existingTest) {
        return res.status(404).json({
          message: "Test not found",
        });
      }

      // Test must belong to selected chapter
      if (
        existingTest.chapter.toString() !==
        chapter.toString()
      ) {
        return res.status(400).json({
          message:
            "Test does not belong to the selected chapter",
        });
      }
    }

    // --------------------------------------------------------
    // Validate question number
    // --------------------------------------------------------

    if (
      questionNumber !== undefined &&
      (!Number.isInteger(Number(questionNumber)) ||
        Number(questionNumber) < 1)
    ) {
      return res.status(400).json({
        message:
          "questionNumber must be a positive number",
      });
    }

    // --------------------------------------------------------
    // MCQ / MSQ options validation
    // --------------------------------------------------------

    if (
      questionType === "mcq" ||
      questionType === "msq"
    ) {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          message:
            "At least 2 options are required for MCQ/MSQ",
        });
      }
    }

    // --------------------------------------------------------
    // MCQ answer validation
    // --------------------------------------------------------

    let finalCorrectAnswer = correctAnswer;

    if (questionType === "mcq") {
      finalCorrectAnswer = Number(correctAnswer);

      if (
        !Number.isInteger(finalCorrectAnswer) ||
        finalCorrectAnswer < 0 ||
        finalCorrectAnswer >= options.length
      ) {
        return res.status(400).json({
          message:
            "MCQ correctAnswer must be a valid option index",
        });
      }
    }

    // --------------------------------------------------------
    // MSQ answer validation
    // --------------------------------------------------------

    if (questionType === "msq") {
      if (!Array.isArray(correctAnswer)) {
        return res.status(400).json({
          message:
            "MSQ correctAnswer must be an array of option indexes",
        });
      }

      finalCorrectAnswer = correctAnswer.map(Number);

      const invalidAnswer =
        finalCorrectAnswer.some(
          (answer) =>
            !Number.isInteger(answer) ||
            answer < 0 ||
            answer >= options.length
        );

      if (invalidAnswer) {
        return res.status(400).json({
          message:
            "MSQ correctAnswer contains an invalid option index",
        });
      }
    }

    // --------------------------------------------------------
    // NAT answer validation
    // --------------------------------------------------------

    if (questionType === "nat") {
      finalCorrectAnswer = Number(correctAnswer);

      if (Number.isNaN(finalCorrectAnswer)) {
        return res.status(400).json({
          message:
            "NAT correctAnswer must be a number",
        });
      }
    }

    // --------------------------------------------------------
    // PYQ validation
    // --------------------------------------------------------

    if (isPYQ && !year) {
      return res.status(400).json({
        message:
          "Year is required for previous year questions",
      });
    }

    // --------------------------------------------------------
    // Duplicate question number
    // --------------------------------------------------------

    if (test && questionNumber) {
      const existingQuestion = await Question.findOne({
        test,
        questionNumber: Number(questionNumber),
      });

      if (existingQuestion) {
        return res.status(409).json({
          message:
            "Question number already exists in this test",
        });
      }
    }

    // --------------------------------------------------------
    // Create question
    // --------------------------------------------------------

    const question = await Question.create({
      branch,
      subject,
      chapter,
      test: test || undefined,

      questionNumber:
        questionNumber !== undefined
          ? Number(questionNumber)
          : undefined,

      questionText,
      questionType,

      options,

      correctAnswer: finalCorrectAnswer,

      marks: Number(marks),
      negativeMarks: Number(negativeMarks),

      isPYQ,
      examName,
      year: year ? Number(year) : undefined,
      session,

      difficulty,
      category,
      topic,
      tags,

      explanation,

      solutionType,
      aiSolutionGenerated,
      aiSolutionModel,

      isActive,
      isPublished,
    });

    // --------------------------------------------------------
    // Update test statistics
    // --------------------------------------------------------

    let testStatistics = null;

    if (test) {
      testStatistics =
        await updateTestStatistics(test);
    }

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(201).json({
      message:
        "Question created successfully",

      question,

      testStatistics,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL QUESTIONS
// ============================================================

const getQuestions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      branch,
      subject,
      chapter,
      test,
      year,
      difficulty,
      category,
      topic,
      questionType,
      isPYQ,
      search,
    } = req.query;

    const pageNumber = Math.max(
      Number(page),
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit), 1),
      100
    );

    const filter = {
      isActive: true,
    };

    // --------------------------------------------------------
    // Filters
    // --------------------------------------------------------

    if (branch) {
      filter.branch = branch;
    }

    if (subject) {
      filter.subject = subject;
    }

    if (chapter) {
      filter.chapter = chapter;
    }

    if (test) {
      filter.test = test;
    }

    if (year) {
      filter.year = Number(year);
    }

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (category) {
      filter.category = category;
    }

    if (topic) {
      filter.topic = topic;
    }

    if (questionType) {
      filter.questionType = questionType;
    }

    if (isPYQ !== undefined) {
      filter.isPYQ = isPYQ === "true";
    }

    // --------------------------------------------------------
    // Search
    // --------------------------------------------------------

    if (search) {
      filter.questionText = {
        $regex: search,
        $options: "i",
      };
    }

    const skip =
      (pageNumber - 1) * limitNumber;

    // --------------------------------------------------------
    // Get questions
    // --------------------------------------------------------

    const questions = await Question.find(filter)
      .populate("branch", "name code")
      .populate("subject", "name code")
      .populate("chapter", "name")
      .populate("test", "title")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNumber);

    // --------------------------------------------------------
    // Total count
    // --------------------------------------------------------

    const totalQuestions =
      await Question.countDocuments(filter);

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(200).json({
      questions,

      pagination: {
        currentPage: pageNumber,

        totalPages: Math.ceil(
          totalQuestions / limitNumber
        ),

        totalQuestions,

        limit: limitNumber,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// GET QUESTIONS BY TEST
// ============================================================

const getQuestionsByTest = async (req, res) => {
  try {
    const { testId } = req.params;

    const {
      page = 1,
      limit = 20,
      difficulty,
      category,
      topic,
      questionType,
      year,
    } = req.query;

    const pageNumber = Math.max(
      Number(page),
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit), 1),
      100
    );

    const filter = {
      test: testId,
      isActive: true,
    };

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (category) {
      filter.category = category;
    }

    if (topic) {
      filter.topic = topic;
    }

    if (questionType) {
      filter.questionType = questionType;
    }

    if (year) {
      filter.year = Number(year);
    }

    const skip =
      (pageNumber - 1) * limitNumber;

    const questions = await Question.find(filter)
      .sort({
        questionNumber: 1,
      })
      .skip(skip)
      .limit(limitNumber);

    const totalQuestions =
      await Question.countDocuments(filter);

    res.status(200).json({
      questions,

      pagination: {
        currentPage: pageNumber,

        totalPages: Math.ceil(
          totalQuestions / limitNumber
        ),

        totalQuestions,

        limit: limitNumber,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// GET QUESTIONS BY CHAPTER
// ============================================================

const getQuestionsByChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const {
      page = 1,
      limit = 20,
      difficulty,
      category,
      topic,
      questionType,
      year,
      isPYQ,
    } = req.query;

    const pageNumber = Math.max(
      Number(page),
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit), 1),
      100
    );

    const filter = {
      chapter: chapterId,
      isActive: true,
    };

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (category) {
      filter.category = category;
    }

    if (topic) {
      filter.topic = topic;
    }

    if (questionType) {
      filter.questionType = questionType;
    }

    if (year) {
      filter.year = Number(year);
    }

    if (isPYQ !== undefined) {
      filter.isPYQ = isPYQ === "true";
    }

    const skip =
      (pageNumber - 1) * limitNumber;

    const questions = await Question.find(filter)
      .populate("test", "title")
      .sort({
        questionNumber: 1,
      })
      .skip(skip)
      .limit(limitNumber);

    const totalQuestions =
      await Question.countDocuments(filter);

    res.status(200).json({
      questions,

      pagination: {
        currentPage: pageNumber,

        totalPages: Math.ceil(
          totalQuestions / limitNumber
        ),

        totalQuestions,

        limit: limitNumber,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// BULK UPLOAD QUESTIONS FROM EXCEL
// ============================================================

const bulkUploadQuestions = async (req, res) => {
  try {
    const { testId } = req.params;

    // --------------------------------------------------------
    // Check file
    // --------------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        message: "Excel file is required",
      });
    }

    // --------------------------------------------------------
    // Check test
    // --------------------------------------------------------

    const existingTest =
      await Test.findById(testId);

    if (!existingTest) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    // --------------------------------------------------------
    // Get chapter
    // --------------------------------------------------------

    const existingChapter =
      await Chapter.findById(
        existingTest.chapter
      );

    if (!existingChapter) {
      return res.status(404).json({
        message:
          "Chapter associated with test not found",
      });
    }

    // --------------------------------------------------------
    // Get subject
    // --------------------------------------------------------

    const existingSubject =
      await Subject.findById(
        existingChapter.subject
      );

    if (!existingSubject) {
      return res.status(404).json({
        message:
          "Subject associated with chapter not found",
      });
    }

    // --------------------------------------------------------
    // Get branch
    // --------------------------------------------------------

    const existingBranch =
      await Branch.findById(
        existingSubject.branch
      );

    if (!existingBranch) {
      return res.status(404).json({
        message:
          "Branch associated with subject not found",
      });
    }

    // --------------------------------------------------------
    // Read Excel
    // --------------------------------------------------------

    const workbook = XLSX.read(
      req.file.buffer,
      {
        type: "buffer",
      }
    );

    const sheetName =
      workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        message:
          "Excel sheet not found",
      });
    }

    const worksheet =
      workbook.Sheets[sheetName];

    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
        }
      );

    if (!rows.length) {
      return res.status(400).json({
        message:
          "Excel file is empty",
      });
    }

    // --------------------------------------------------------
    // Prepare
    // --------------------------------------------------------

    const questions = [];
    const errors = [];
    const questionNumbers = new Set();

    // --------------------------------------------------------
    // Process rows
    // --------------------------------------------------------

    for (
      let i = 0;
      i < rows.length;
      i++
    ) {
      const row = rows[i];

      const excelRowNumber = i + 2;

      // ------------------------------------------------------
      // Skip completely blank rows
      // ------------------------------------------------------

      const isEmptyRow =
        Object.values(row).every(
          (value) =>
            String(value || "").trim() === ""
        );

      if (isEmptyRow) {
        continue;
      }

      // ------------------------------------------------------
      // Read values
      // ------------------------------------------------------

      const questionText =
        String(
          row.questionText || ""
        ).trim();

      const questionType =
        String(
          row.questionType || "mcq"
        )
          .trim()
          .toLowerCase();

      const difficulty =
        String(
          row.difficulty || "medium"
        )
          .trim()
          .toLowerCase();

      const questionNumber =
        Number(
          row.questionNumber
        );

      const isPYQValue =
        String(
          row.isPYQ || "false"
        )
          .trim()
          .toLowerCase();

      const isPYQ =
        isPYQValue === "true" ||
        isPYQValue === "yes" ||
        isPYQValue === "1";

      const year =
        row.year
          ? Number(row.year)
          : undefined;

      // ------------------------------------------------------
      // Question text
      // ------------------------------------------------------

      if (!questionText) {
        errors.push(
          `Row ${excelRowNumber}: questionText is required`
        );

        continue;
      }

      // ------------------------------------------------------
      // Question type
      // ------------------------------------------------------

      if (
        !["mcq", "msq", "nat"].includes(
          questionType
        )
      ) {
        errors.push(
          `Row ${excelRowNumber}: questionType must be mcq, msq or nat`
        );

        continue;
      }

      // ------------------------------------------------------
      // Difficulty
      // ------------------------------------------------------

      if (
        !["easy", "medium", "hard"].includes(
          difficulty
        )
      ) {
        errors.push(
          `Row ${excelRowNumber}: difficulty must be easy, medium or hard`
        );

        continue;
      }

      // ------------------------------------------------------
      // Question number
      // ------------------------------------------------------

      if (
        !Number.isInteger(
          questionNumber
        ) ||
        questionNumber < 1
      ) {
        errors.push(
          `Row ${excelRowNumber}: valid questionNumber is required`
        );

        continue;
      }

      // ------------------------------------------------------
      // Duplicate number inside Excel
      // ------------------------------------------------------

      if (
        questionNumbers.has(
          questionNumber
        )
      ) {
        errors.push(
          `Row ${excelRowNumber}: duplicate questionNumber ${questionNumber} in Excel`
        );

        continue;
      }

      questionNumbers.add(
        questionNumber
      );

      // ------------------------------------------------------
      // Options
      // ------------------------------------------------------

      let options = [];

      if (
        questionType === "mcq" ||
        questionType === "msq"
      ) {
        options = [
          String(
            row.optionA || ""
          ).trim(),

          String(
            row.optionB || ""
          ).trim(),

          String(
            row.optionC || ""
          ).trim(),

          String(
            row.optionD || ""
          ).trim(),
        ];

        if (
          options.some(
            (option) => !option
          )
        ) {
          errors.push(
            `Row ${excelRowNumber}: optionA, optionB, optionC and optionD are required`
          );

          continue;
        }
      }

      // ------------------------------------------------------
      // Correct answer
      // ------------------------------------------------------

      let correctAnswer =
        row.correctAnswer;

      // ------------------------------------------------------
      // MCQ
      // ------------------------------------------------------

      if (
        questionType === "mcq"
      ) {
        correctAnswer =
          Number(correctAnswer);

        if (
          !Number.isInteger(
            correctAnswer
          ) ||
          correctAnswer < 0 ||
          correctAnswer >=
            options.length
        ) {
          errors.push(
            `Row ${excelRowNumber}: MCQ correctAnswer must be a valid option index`
          );

          continue;
        }
      }

      // ------------------------------------------------------
      // MSQ
      // ------------------------------------------------------

      if (
        questionType === "msq"
      ) {
        correctAnswer =
          String(correctAnswer)
            .split(",")
            .map((value) =>
              Number(value.trim())
            );

        if (
          correctAnswer.length === 0 ||
          correctAnswer.some(
            (value) =>
              !Number.isInteger(
                value
              ) ||
              value < 0 ||
              value >=
                options.length
          )
        ) {
          errors.push(
            `Row ${excelRowNumber}: MSQ correctAnswer must contain valid option indexes like 0,2`
          );

          continue;
        }
      }

      // ------------------------------------------------------
      // NAT
      // ------------------------------------------------------

      if (
        questionType === "nat"
      ) {
        correctAnswer =
          Number(correctAnswer);

        if (
          Number.isNaN(
            correctAnswer
          )
        ) {
          errors.push(
            `Row ${excelRowNumber}: NAT correctAnswer must be a number`
          );

          continue;
        }
      }

      // ------------------------------------------------------
      // PYQ year
      // ------------------------------------------------------

      if (
        isPYQ &&
        !year
      ) {
        errors.push(
          `Row ${excelRowNumber}: year is required for PYQ`
        );

        continue;
      }

      // ------------------------------------------------------
      // Marks
      // ------------------------------------------------------

      const marks =
        Number(
          row.marks || 1
        );

      const negativeMarks =
        Number(
          row.negativeMarks || 0
        );

      if (
        Number.isNaN(marks) ||
        marks < 0
      ) {
        errors.push(
          `Row ${excelRowNumber}: marks must be a valid non-negative number`
        );

        continue;
      }

      if (
        Number.isNaN(
          negativeMarks
        ) ||
        negativeMarks < 0
      ) {
        errors.push(
          `Row ${excelRowNumber}: negativeMarks must be a valid non-negative number`
        );

        continue;
      }

      // ------------------------------------------------------
      // Tags
      // ------------------------------------------------------

      const tags =
        String(
          row.tags || ""
        )
          .split(",")
          .map((tag) =>
            tag.trim()
          )
          .filter(Boolean);

      // ------------------------------------------------------
      // Add question
      // ------------------------------------------------------

      questions.push({
        branch:
          existingBranch._id,

        subject:
          existingSubject._id,

        chapter:
          existingChapter._id,

        test: testId,

        questionNumber,

        questionText,

        questionType,

        options,

        correctAnswer,

        marks,

        negativeMarks,

        isPYQ,

        examName:
          String(
            row.examName ||
              "GATE"
          ).trim(),

        year,

        session:
          String(
            row.session || ""
          ).trim(),

        difficulty,

        category:
          String(
            row.category || ""
          ).trim(),

        topic:
          String(
            row.topic || ""
          ).trim(),

        tags,

        explanation:
          String(
            row.explanation || ""
          ).trim(),

        solutionType:
          String(
            row.solutionType ||
              "none"
          ).trim(),

        aiSolutionGenerated:
          false,

        isActive: true,

        isPublished: true,
      });
    }

    // --------------------------------------------------------
    // Validation errors
    // --------------------------------------------------------

    if (errors.length > 0) {
      return res.status(400).json({
        message:
          "Excel validation failed",

        errors,
      });
    }

    // --------------------------------------------------------
    // No questions
    // --------------------------------------------------------

    if (
      questions.length === 0
    ) {
      return res.status(400).json({
        message:
          "No valid questions found in Excel",
      });
    }

    // --------------------------------------------------------
    // Check existing DB question numbers
    // --------------------------------------------------------

    const existingQuestions =
      await Question.find({
        test: testId,

        questionNumber: {
          $in: questions.map(
            (question) =>
              question.questionNumber
          ),
        },
      }).select(
        "questionNumber"
      );

    // --------------------------------------------------------
    // Duplicate DB questions
    // --------------------------------------------------------

    if (
      existingQuestions.length > 0
    ) {
      const existingNumbers =
        existingQuestions.map(
          (question) =>
            question.questionNumber
        );

      return res.status(409).json({
        message:
          "Some question numbers already exist in this test",

        existingQuestionNumbers:
          existingNumbers,
      });
    }

    // --------------------------------------------------------
    // Bulk insert
    // --------------------------------------------------------

    await Question.insertMany(
      questions,
      {
        ordered: true,
      }
    );

    // --------------------------------------------------------
    // Update test statistics
    // --------------------------------------------------------

    const testStatistics =
      await updateTestStatistics(
        testId
      );

    // --------------------------------------------------------
    // Success
    // --------------------------------------------------------

    res.status(201).json({
      message:
        "Questions uploaded successfully",

      uploadedQuestions:
        questions.length,

      totalQuestions:
        testStatistics.totalQuestions,

      totalMarks:
        testStatistics.totalMarks,
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Bulk upload failed",

      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionsByTest,
  getQuestionsByChapter,
  bulkUploadQuestions,
};