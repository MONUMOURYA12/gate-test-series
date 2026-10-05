const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const dataDirectory = path.resolve(__dirname, "../data");
const outputDirectory = path.join(dataDirectory, "cse-bulk-upload-workbooks");
const headers = [
  "questionNumber", "questionText", "questionType", "optionA", "optionB", "optionC", "optionD",
  "correctAnswer", "marks", "negativeMarks", "isPYQ", "examName", "year", "session", "difficulty",
  "category", "topic", "tags", "explanation", "solutionType",
];

function rowFromQuestion(question, bundle) {
  return {
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    questionType: question.questionType,
    optionA: question.options?.[0] || "",
    optionB: question.options?.[1] || "",
    optionC: question.options?.[2] || "",
    optionD: question.options?.[3] || "",
    correctAnswer: Array.isArray(question.correctAnswer) ? question.correctAnswer.join(",") : question.correctAnswer ?? "",
    marks: question.marks ?? 1,
    negativeMarks: question.negativeMarks ?? 0,
    isPYQ: question.isPYQ ? "true" : "false",
    examName: question.examName || "GATE",
    year: question.year || "",
    session: question.sourceMarker || "",
    difficulty: question.difficulty || "medium",
    category: bundle.subjectName,
    topic: question.topic || bundle.chapterName,
    tags: Array.isArray(question.tags) ? question.tags.join(",") : "",
    explanation: question.explanation || "",
    solutionType: question.solutionType || "none",
  };
}

fs.mkdirSync(outputDirectory, { recursive: true });
const files = fs.readdirSync(dataDirectory).filter(name => /^free-platform-cse-.*\.json$/.test(name)).sort();
const manifest = [];
for (const file of files) {
  const bundle = JSON.parse(fs.readFileSync(path.join(dataDirectory, file), "utf8"));
  const rows = bundle.questions.map(question => rowFromQuestion(question, bundle));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  worksheet["!cols"] = headers.map(header => ({ wch: header === "questionText" || header === "explanation" ? 56 : 18 }));
  const instructions = XLSX.utils.aoa_to_sheet([
    ["GATE CSE Upload Workbook"],
    ["Upload the Questions sheet into the matching branch, subject, chapter and test."],
    ["MCQ correctAnswer uses zero-based indexes: 0=A, 1=B, 2=C, 3=D."],
    ["MSQ correctAnswer uses comma-separated zero-based indexes, for example 1,2."],
    ["This workbook contains only the verified questions from its source JSON bundle."],
    ["Source subject", bundle.subjectName],
    ["Source chapter", bundle.chapterName],
    ["Question count", rows.length],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  const outputName = file.replace(/^free-platform-/, "").replace(/\.json$/, ".xlsx");
  XLSX.writeFile(workbook, path.join(outputDirectory, outputName));
  manifest.push({ file: outputName, subject: bundle.subjectName, chapter: bundle.chapterName, questions: rows.length });
}
fs.writeFileSync(path.join(outputDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ outputDirectory, workbooks: manifest.length, questions: manifest.reduce((sum, item) => sum + item.questions, 0) }, null, 2));
