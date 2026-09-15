const Question = require("../models/Question");
const Test = require("../models/Test");
const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");

const updateTestStatistics = async (testId) => {
  if (!testId) {
    return null;
  }

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

const validateHierarchy = async ({
  branch,
  subject,
  chapter,
  test,
}) => {
  const existingBranch = await Branch.findById(branch);

  if (!existingBranch) {
    return {
      error: "Branch not found",
      status: 404,
    };
  }

  const existingSubject = await Subject.findById(subject);

  if (!existingSubject) {
    return {
      error: "Subject not found",
      status: 404,
    };
  }

  if (
    existingSubject.branch.toString() !==
    branch.toString()
  ) {
    return {
      error:
        "Subject does not belong to the selected branch",
      status: 400,
    };
  }

  const existingChapter = await Chapter.findById(
    chapter
  );

  if (!existingChapter) {
    return {
      error: "Chapter not found",
      status: 404,
    };
  }

  if (
    existingChapter.subject.toString() !==
    subject.toString()
  ) {
    return {
      error:
        "Chapter does not belong to the selected subject",
      status: 400,
    };
  }

  let existingTest = null;

  if (test) {
    existingTest = await Test.findById(test);

    if (!existingTest) {
      return {
        error: "Test not found",
        status: 404,
      };
    }

    if (
      existingTest.chapter.toString() !==
      chapter.toString()
    ) {
      return {
        error:
          "Test does not belong to the selected chapter",
        status: 400,
      };
    }
  }

  return {
    existingBranch,
    existingSubject,
    existingChapter,
    existingTest,
  };
};

const validateQuestionData = ({
  questionType,
  options,
  correctAnswer,
  difficulty,
  isPYQ,
  year,
}) => {
  if (
    !["mcq", "msq", "nat"].includes(questionType)
  ) {
    return {
      error:
        "questionType must be mcq, msq or nat",
      status: 400,
    };
  }

  if (
    !["easy", "medium", "hard"].includes(difficulty)
  ) {
    return {
      error:
        "difficulty must be easy, medium or hard",
      status: 400,
    };
  }

  if (
    questionType === "mcq" ||
    questionType === "msq"
  ) {
    if (
      !Array.isArray(options) ||
      options.length < 2
    ) {
      return {
        error:
          "At least 2 options are required for MCQ/MSQ",
        status: 400,
      };
    }
  }

  if (questionType === "mcq") {
    const finalAnswer = Number(correctAnswer);

    if (
      !Number.isInteger(finalAnswer) ||
      finalAnswer < 0 ||
      finalAnswer >= options.length
    ) {
      return {
        error:
          "MCQ correctAnswer must be a valid option index",
        status: 400,
      };
    }
  }

  if (questionType === "msq") {
    if (!Array.isArray(correctAnswer)) {
      return {
        error:
          "MSQ correctAnswer must be an array of option indexes",
        status: 400,
      };
    }

    const finalAnswers = correctAnswer.map(Number);

    const invalidAnswer = finalAnswers.some(
      (answer) =>
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= options.length
    );

    if (
      finalAnswers.length === 0 ||
      invalidAnswer
    ) {
      return {
        error:
          "MSQ correctAnswer contains an invalid option index",
        status: 400,
      };
    }
  }

  if (questionType === "nat") {
    const finalAnswer = Number(correctAnswer);

    if (Number.isNaN(finalAnswer)) {
      return {
        error:
          "NAT correctAnswer must be a number",
        status: 400,
      };
    }
  }

  if (isPYQ && !year) {
    return {
      error:
        "Year is required for previous year questions",
      status: 400,
    };
  }

  return null;
};

const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const existingQuestion =
      await Question.findById(questionId);

    if (!existingQuestion) {
      return res.status(404).json({
        message: "Question not found",
      });
    }

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
      solutionType = "manual",
      isPublished = true,
    } = req.body;

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

    if (
      questionNumber === undefined ||
      !Number.isInteger(Number(questionNumber)) ||
      Number(questionNumber) < 1
    ) {
      return res.status(400).json({
        message:
          "Question number must be a positive number",
      });
    }

    const hierarchyResult =
      await validateHierarchy({
        branch,
        subject,
        chapter,
        test,
      });

    if (hierarchyResult.error) {
      return res.status(
        hierarchyResult.status
      ).json({
        message: hierarchyResult.error,
      });
    }

    const validationError =
      validateQuestionData({
        questionType,
        options,
        correctAnswer,
        difficulty,
        isPYQ,
        year,
      });

    if (validationError) {
      return res.status(
        validationError.status
      ).json({
        message: validationError.error,
      });
    }

    const finalQuestionNumber =
      Number(questionNumber);

    const duplicateQuestion =
      await Question.findOne({
        _id: { $ne: questionId },
        test: test || undefined,
        questionNumber: finalQuestionNumber,
        isActive: true,
      });

    if (duplicateQuestion) {
      return res.status(409).json({
        message:
          "Question number already exists in this test",
      });
    }

    let finalCorrectAnswer;

    if (questionType === "mcq") {
      finalCorrectAnswer =
        Number(correctAnswer);
    }

    if (questionType === "msq") {
      finalCorrectAnswer =
        correctAnswer.map(Number);
    }

    if (questionType === "nat") {
      finalCorrectAnswer =
        Number(correctAnswer);
    }

    const finalMarks = Number(marks);
    const finalNegativeMarks =
      Number(negativeMarks);

    if (
      Number.isNaN(finalMarks) ||
      finalMarks < 0
    ) {
      return res.status(400).json({
        message:
          "Marks must be a valid non-negative number",
      });
    }

    if (
      Number.isNaN(finalNegativeMarks) ||
      finalNegativeMarks < 0
    ) {
      return res.status(400).json({
        message:
          "Negative marks must be a valid non-negative number",
      });
    }

    const finalTags = Array.isArray(tags)
      ? tags
      : String(tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

    existingQuestion.branch = branch;
    existingQuestion.subject = subject;
    existingQuestion.chapter = chapter;
    existingQuestion.test =
      test || undefined;

    existingQuestion.questionNumber =
      finalQuestionNumber;

    existingQuestion.questionText =
      questionText.trim();

    existingQuestion.questionType =
      questionType;

    existingQuestion.options =
      questionType === "nat"
        ? []
        : options.map((option) =>
            String(option).trim()
          );

    existingQuestion.correctAnswer =
      finalCorrectAnswer;

    existingQuestion.marks = finalMarks;

    existingQuestion.negativeMarks =
      finalNegativeMarks;

    existingQuestion.isPYQ = isPYQ;

    existingQuestion.examName =
      String(examName || "GATE").trim();

    existingQuestion.year = year
      ? Number(year)
      : undefined;

    existingQuestion.session =
      String(session || "").trim();

    existingQuestion.difficulty =
      difficulty;

    existingQuestion.category =
      String(category || "").trim();

    existingQuestion.topic =
      String(topic || "").trim();

    existingQuestion.tags = finalTags;

    existingQuestion.explanation =
      String(explanation || "").trim();

    existingQuestion.solutionType =
      solutionType;

    existingQuestion.isPublished =
      isPublished;

    const updatedQuestion =
      await existingQuestion.save();

    const oldTestId =
      existingQuestion.test
        ? existingQuestion.test.toString()
        : null;

    const newTestId = test
      ? test.toString()
      : null;

    const testStatistics =
      await updateTestStatistics(
        newTestId
      );

    if (
      oldTestId &&
      oldTestId !== newTestId
    ) {
      await updateTestStatistics(
        oldTestId
      );
    }

    return res.status(200).json({
      message:
        "Question updated successfully",
      question: updatedQuestion,
      testStatistics,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question =
      await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    const testId = question.test
      ? question.test.toString()
      : null;

    question.isActive = false;

    await question.save();

    const testStatistics =
      await updateTestStatistics(testId);

    return res.status(200).json({
      message:
        "Question deleted successfully",
      testStatistics,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  updateQuestion,
  deleteQuestion,
};