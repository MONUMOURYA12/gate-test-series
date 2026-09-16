import { Link, useOutletContext, useParams } from "react-router-dom";

const commonSubjects = {
  "engineering-mathematics": {
    code: "MATH",
    title: "Engineering Mathematics",
    description: "Core mathematics practice is being prepared for your GATE journey.",
  },
  "general-aptitude": {
    code: "GA",
    title: "General Aptitude",
    description: "A focused aptitude practice section is coming soon.",
  },
};

export default function StudentComingSoonPage() {
  const { commonKey } = useParams();
  const { subjects } = useOutletContext();
  const configuredSubject = subjects.find((subject) => subject._id === commonKey);
  const subject = configuredSubject || commonSubjects[commonKey] || {
    code: "SOON",
    title: "This subject",
    description: "This learning section is being prepared.",
  };

  return (
    <div className="coming-soon-page">
      <Link className="learn-back" to="/student/dashboard">Back to dashboard</Link>
      <section className="coming-soon-panel" aria-labelledby="coming-soon-title">
        <span className="coming-soon-icon" aria-hidden="true">{subject.code.slice(0, 1)}</span>
        <p className="learn-eyebrow">{subject.code} / IN PREPARATION</p>
        <h1 id="coming-soon-title">{subject.title}</h1>
        <p>{subject.description}</p>
        <strong>We are working on it. Coming soon.</strong>
        <Link className="primary-button" to="/student/dashboard">Explore available subjects</Link>
      </section>
    </div>
  );
}
