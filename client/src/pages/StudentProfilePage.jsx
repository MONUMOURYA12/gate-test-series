import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { studentApi } from "../services/api";

export default function StudentProfilePage() {
  const { user, updateUser } = useAuth();
  const [history, setHistory] = useState(null);
  const [form, setForm] = useState({ name: user?.name || "", mobileNumber: user?.mobileNumber || "", collegeName: user?.collegeName || "", passingYear: user?.passingYear || "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    studentApi.history(controller.signal).then(data => {
      if (!controller.signal.aborted) setHistory(data);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, []);

  function change(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const updatedUser = await updateUser({ ...form, passingYear: Number(form.passingYear) });
      setForm({
        name: updatedUser.name || "",
        mobileNumber: updatedUser.mobileNumber || "",
        collegeName: updatedUser.collegeName || "",
        passingYear: updatedUser.passingYear || "",
      });
      setMessage("Profile updated successfully.");
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="student-profile-page">
    <div className="profile-heading"><div><p className="learn-eyebrow">YOUR ACCOUNT</p><h1 className="learn-title">Student profile</h1><p className="learn-intro">Keep your personal details and preparation record in one place.</p></div><Link className="secondary-button" to="/">Back to home</Link></div>
    <div className="profile-grid">
      <section className="learn-detail" aria-labelledby="profile-details-title">
        <div className="learn-section-heading"><h2 id="profile-details-title">Profile details</h2><span>{user?.branch?.code || "Branch"}</span></div>
        {message && <p className="alert alert-success" role="status">{message}</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {isEditing ? <form className="profile-form" onSubmit={save}>
          {[['name','Full name'],['mobileNumber','Mobile number'],['collegeName','College name'],['passingYear','Passing year']].map(([name,label]) => <div className="field" key={name}><label htmlFor={`profile-${name}`}>{label}</label><input id={`profile-${name}`} name={name} type={name === 'passingYear' ? 'number' : name === 'mobileNumber' ? 'tel' : 'text'} value={form[name]} onChange={change} required /></div>)}
          <div className="profile-readonly"><span>Email</span><strong>{user?.email}</strong><span>Registered branch</span><strong>{user?.branch?.name || "Not assigned"}</strong></div>
          <div className="profile-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button><button className="secondary-button" type="button" onClick={() => { setIsEditing(false); setError(""); }}>Cancel</button></div>
        </form> : <div className="profile-summary">
          <dl className="profile-readonly"><span>Full name</span><strong>{user?.name || "Not provided"}</strong><span>Mobile number</span><strong>{user?.mobileNumber || "Not provided"}</strong><span>College name</span><strong>{user?.collegeName || "Not provided"}</strong><span>Passing year</span><strong>{user?.passingYear || "Not provided"}</strong><span>Email</span><strong>{user?.email || "Not provided"}</strong><span>Registered branch</span><strong>{user?.branch?.name || "Not assigned"}</strong></dl>
          <button className="primary-button" type="button" onClick={() => { setMessage(""); setIsEditing(true); }}>Edit profile</button>
        </div>}
      </section>
      <section className="learn-detail" aria-labelledby="recommendations-title">
        <div className="learn-section-heading"><h2 id="recommendations-title">Topics to strengthen</h2><span>Based on your tests</span></div>
        {!history ? <p>Loading your recommendations...</p> : history.recommendations.length ? <div className="recommendation-list">{history.recommendations.map(item => <article key={item.topic}><strong>{item.topic}</strong><span>{item.incorrect} incorrect answers</span><p>{item.message}</p></article>)}</div> : <p className="learn-notice">Complete a test to receive focused recommendations for weak areas.</p>}
      </section>
    </div>
    <section className="learn-detail profile-history" aria-labelledby="history-title"><div className="learn-section-heading"><h2 id="history-title">Test history</h2><span>{history?.history.length || 0} completed</span></div>{!history ? <p>Loading your record...</p> : history.history.length ? <div className="profile-history-list">{history.history.map(item => <div className="profile-history-row" key={item._id}><div><strong>{item.title}</strong><p>{item.subject || "Practice"}{item.chapter ? ` / ${item.chapter}` : ""}</p></div><span>{item.result?.score ?? 0}/{item.result?.totalMarks ?? 0}</span><small>{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : ""}</small></div>)}</div> : <p className="learn-notice">Your completed tests will appear here.</p>}</section>
  </div>;
}
