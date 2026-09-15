const API_BASE_URL = (import.meta.env?.VITE_API_URL || "/api").replace(/\/+$/, "");
const QUESTION_MEDIA_PATH = /^\/question-media\/[a-z0-9-]+\/[a-f0-9-]+\.webp$/;
let sessionRevision = 0;

export const questionMediaUrl = path => typeof path === "string" && QUESTION_MEDIA_PATH.test(path)
  ? `${API_BASE_URL.replace(/\/api$/, "")}${path}`
  : null;

// Old releases stored bearer tokens here. Cookies now hold the session, and
// JavaScript must neither read nor keep a copy of the session credential.
export const clearLegacyToken = () => {
  try {
    localStorage.removeItem("gateTestSeriesToken");
  } catch {
    // Browsers can disable local storage; cookie authentication still works.
  }
};

export const apiRequest = async (path, options = {}) => {
  const requestRevision = sessionRevision;
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(data?.message || "Something went wrong while contacting the server");
    error.status = response.status;
    error.data = data;
    if (data?.errors) error.errors = data.errors;
    if (data?.existingQuestionNumbers) error.existingQuestionNumbers = data.existingQuestionNumbers;
    if (response.status === 401 && requestRevision === sessionRevision && path !== "/auth/login") {
      window.dispatchEvent(new Event("auth-expired"));
    }
    throw error;
  }
  return data;
};

export const authApi = {
  login: async payload => {
    const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    sessionRevision += 1;
    return data;
  },
  me: signal => apiRequest("/auth/me", { signal }),
  updateMe: payload => apiRequest("/auth/me", { method: "PATCH", body: JSON.stringify(payload) }),
  logout: async () => {
    const data = await apiRequest("/auth/logout", { method: "POST" });
    sessionRevision += 1;
    return data;
  },
};

export const dashboardApi = {
  branches: () => apiRequest("/branches"),
  subjects: () => apiRequest("/subjects"),
  chapters: () => apiRequest("/chapters"),
  tests: () => apiRequest("/tests"),
  questions: () => apiRequest("/questions?limit=1"),
};

export const branchApi = {
  list: () => apiRequest("/branches"),
  create: payload => apiRequest("/branches", { method: "POST", body: JSON.stringify(payload) }),
};

export const subjectApi = {
  list: () => apiRequest("/subjects"),
  listByBranch: branchId => apiRequest(`/subjects/branch/${branchId}`),
  create: payload => apiRequest("/subjects", { method: "POST", body: JSON.stringify(payload) }),
};

export const chapterApi = {
  list: () => apiRequest("/chapters"),
  listBySubject: subjectId => apiRequest(`/chapters/subject/${subjectId}`),
  create: payload => apiRequest("/chapters", { method: "POST", body: JSON.stringify(payload) }),
};

export const testApi = {
  list: () => apiRequest("/tests"),
  listByChapter: chapterId => apiRequest(`/tests/chapter/${chapterId}`),
  create: payload => apiRequest("/tests", { method: "POST", body: JSON.stringify(payload) }),
  sync: testId => apiRequest(`/tests/${testId}/sync`, { method: "POST" }),
};

export const questionApi = {
  list: (params = "") => apiRequest(`/questions${params}`),
  listByTest: (testId, params = "") => apiRequest(`/questions/test/${testId}${params}`),
  listByChapter: (chapterId, params = "") => apiRequest(`/questions/chapter/${chapterId}${params}`),
  create: payload => apiRequest("/questions", { method: "POST", body: JSON.stringify(payload) }),
  update: (questionId, payload) => apiRequest(`/questions/${questionId}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: questionId => apiRequest(`/questions/${questionId}`, { method: "DELETE" }),
  bulkUpload: (testId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest(`/questions/bulk-upload/${testId}`, { method: "POST", body: formData });
  },
};

export const studentApi = {
  catalogue: signal => apiRequest("/student/catalogue", { signal }),
  history: signal => apiRequest("/student/profile", { signal }),
  testDetails: (testId, signal) => apiRequest(`/student/tests/${testId}`, { signal }),
  startAttempt: testId => apiRequest(`/student/tests/${testId}/attempts`, { method: "POST" }),
  attempt: (attemptId, signal) => apiRequest(`/student/attempts/${attemptId}`, { signal }),
  saveAnswer: (attemptId, payload) => apiRequest(`/student/attempts/${attemptId}/answers`, {
    method: "PUT", body: JSON.stringify(payload),
  }),
  submitAttempt: attemptId => apiRequest(`/student/attempts/${attemptId}/submit`, { method: "POST" }),
  solution: (attemptId, questionId) => apiRequest(`/student/attempts/${attemptId}/questions/${questionId}/solution`),
};

export const registerStudent = payload => apiRequest("/auth/register", {
  method: "POST", body: JSON.stringify(payload),
});
