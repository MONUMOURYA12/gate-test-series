const mongoose = require("mongoose");

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function requireId(value, name) {
  if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) {
    throw badRequest(`A valid ${name} is required.`);
  }
  return value;
}

function validateHierarchyIds(body) {
  for (const key of ["branch", "subject", "chapter", "test"]) {
    if (body?.[key] !== undefined && body[key] !== null && body[key] !== "") requireId(body[key], key);
  }
}

function validateText(value, name, { required = false, max = 500 } = {}) {
  if (!required && (value === undefined || value === null || value === "")) return;
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw badRequest(`${name} must be text between 1 and ${max} characters.`);
  }
}

function validateQuestionBody(body) {
  validateHierarchyIds(body);
  validateText(body?.questionText, "Question text", { required: true, max: 30000 });
  validateText(body?.explanation, "Explanation", { max: 30000 });
  if (body?.options !== undefined && (!Array.isArray(body.options) || body.options.length > 10 ||
    body.options.some(value => typeof value !== "string" || value.length > 10000))) {
    throw badRequest("Options must contain at most 10 text values of up to 10000 characters each.");
  }
  if (body?.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 50 ||
    body.tags.some(value => typeof value !== "string" || value.length > 100))) {
    throw badRequest("Tags must contain at most 50 text values of up to 100 characters each.");
  }
  for (const key of ["isPYQ", "isActive", "isPublished", "aiSolutionGenerated", "reviewed", "useOriginalImages"]) {
    if (body?.[key] !== undefined && typeof body[key] !== "boolean") throw badRequest(`${key} must be true or false.`);
  }
}

function validateQuestionQuery(query = {}) {
  // Query-string arrays/objects must never be passed through to MongoDB filters.
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== "string" || value.length > 200) throw badRequest(`Invalid ${key} filter.`);
  }
  for (const key of ["branch", "subject", "chapter", "test"]) {
    if (query[key]) requireId(query[key], key);
  }
  for (const [key, max] of [["page", 10000], ["limit", 100]]) {
    if (query[key] !== undefined && (!/^\d+$/.test(query[key]) || Number(query[key]) < 1 || Number(query[key]) > max)) {
      throw badRequest(`${key} must be a whole number between 1 and ${max}.`);
    }
  }
  if (query.year && (!/^\d{4}$/.test(query.year) || Number(query.year) < 1980 || Number(query.year) > 2100)) {
    throw badRequest("Year must be between 1980 and 2100.");
  }
  if (query.isPYQ !== undefined && !["true", "false"].includes(query.isPYQ)) throw badRequest("isPYQ must be true or false.");
}

const literalSearch = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function sendControllerError(res, error) {
  if (error?.status === 400) return res.status(400).json({ message: error.message });
  if (error?.code === 11000) return res.status(409).json({ message: "This record already exists." });
  if (["CastError", "ValidationError"].includes(error?.name)) {
    return res.status(400).json({ message: "Invalid request data. Please check the supplied values." });
  }
  // Driver/parser errors can contain credentials, host names and document data.
  return res.status(500).json({ message: "Unable to process this request. Please try again." });
}

module.exports = { badRequest, requireId, validateHierarchyIds, validateText, validateQuestionBody, validateQuestionQuery, literalSearch, sendControllerError };
