import { useEffect, useState } from "react";
import { dashboardApi } from "../services/api";

const initialStats = [
  { key: "branches", label: "Branches", value: "--" },
  { key: "subjects", label: "Subjects", value: "--" },
  { key: "chapters", label: "Chapters", value: "--" },
  { key: "tests", label: "Tests", value: "--" },
  { key: "questions", label: "Questions", value: "--" },
];

function getCount(data, key) {
  if (key === "questions") {
    return data?.pagination?.totalQuestions ?? data?.questions?.length ?? "--";
  }

  return Array.isArray(data?.[key]) ? data[key].length : "--";
}

function AdminDashboard() {
  const [stats, setStats] = useState(initialStats);
  const [status, setStatus] = useState("Loading overview...");

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [branches, subjects, chapters, tests, questions] =
          await Promise.all([
            dashboardApi.branches(),
            dashboardApi.subjects(),
            dashboardApi.chapters(),
            dashboardApi.tests(),
            dashboardApi.questions(),
          ]);

        setStats([
          { key: "branches", label: "Branches", value: getCount(branches, "branches") },
          { key: "subjects", label: "Subjects", value: getCount(subjects, "subjects") },
          { key: "chapters", label: "Chapters", value: getCount(chapters, "chapters") },
          { key: "tests", label: "Tests", value: getCount(tests, "tests") },
          { key: "questions", label: "Questions", value: getCount(questions, "questions") },
        ]);
        setStatus("Overview loaded from existing backend GET APIs.");
      } catch (error) {
        setStats(initialStats);
        setStatus(error.message);
      }
    };

    loadStats();
  }, []);

  return (
    <>
      <div className="page-title">
        <h1>Dashboard</h1>
        <p>Core content overview for the GATE test series platform.</p>
      </div>

      <div className="stats-grid">
        {stats.map((item) => (
          <article className="stat-card" key={item.key}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="dashboard-note">{status}</div>
    </>
  );
}

export default AdminDashboard;
