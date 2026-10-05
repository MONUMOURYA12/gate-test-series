import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import groups from '../../../shared/examCatalogue.json';
import '../explore.css';

export default function PublicHeader() {
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');
  const root = useRef(null);
  const buttons = useRef({});
  const { isAuthenticated, isAdmin } = useAuth();
  useEffect(() => {
    const close = event => { if (!root.current?.contains(event.target)) setOpen(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  function reveal(id) { setOpen(id); setQuery(''); }
  return <header className="exam-header" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) { buttons.current[open]?.focus(); setOpen(null); }
  }}>
    <div className="exam-header-inner">
      <Link className="exam-brand" to="/" aria-label="ParikshaSarthi home"><span className="exam-logo">P</span><span>ParikshaSarthi<small>A little practice. A bigger future.</small></span></Link>
      <nav className="exam-navigation" aria-label="Exams">
        {groups.map(group => {
          const entries = group.id === 'neet' ? group.exams[0].subjects.map(s => ({ id: s.id, name: s.name, subtitle: s.topics, url: `/exams/neet/ug?subject=${s.id}` })) :
            group.exams.map(e => ({ ...e, url: `/exams/${group.id}/${e.id}` }));
          const visible = entries.filter(e => `${e.name} ${e.subtitle}`.toLowerCase().includes(query.toLowerCase()));
          return <div className="exam-nav-group" key={group.id}
            onPointerEnter={event => { if (event.pointerType === 'mouse') reveal(group.id); }}
            onPointerLeave={event => { if (event.pointerType === 'mouse' && !event.currentTarget.contains(document.activeElement)) setOpen(null); }}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }}>
            <button type="button" ref={element => { buttons.current[group.id] = element; }} className={`exam-nav-trigger ${open === group.id ? 'is-open' : ''}`}
              aria-expanded={open === group.id} aria-controls={`exam-menu-${group.id}`}
              onClick={event => { if (event.nativeEvent.pointerType === 'mouse') reveal(group.id); else { setQuery(''); setOpen(open === group.id ? null : group.id); } }}>
              {group.label}<span aria-hidden="true">⌄</span>
            </button>
            {open === group.id && <div className={`exam-dropdown ${group.id === 'gate' || group.id === 'ssc' ? 'exam-dropdown-wide' : ''}`} id={`exam-menu-${group.id}`}>
              <div className="exam-dropdown-heading"><div><span className="exam-eyebrow">FIND YOUR PATH</span><h2><span aria-hidden="true">{group.icon}</span> {group.label}</h2><p>{group.description}</p></div><Link to={`/exams/${group.id}`}>Explore all <span aria-hidden="true">→</span></Link></div>
              {entries.length > 8 && <input className="exam-menu-search" type="search" aria-label={`Find a ${group.label} exam or branch`} placeholder="Search an exam or branch…" value={query} onChange={event => setQuery(event.target.value)} />}
              <div className="exam-menu-links">{visible.map(entry => <Link key={entry.id} to={entry.url}><span>{entry.name}</span><small>{entry.subtitle}{entry.section ? ' · Departmental' : ''}</small></Link>)}</div>
              {visible.length === 0 && <p className="exam-menu-empty" role="status">No matching exam. Try another name.</p>}
              <p className="exam-menu-note">Explore subjects freely. Sign in when you are ready to take a test.</p>
            </div>}
          </div>;
        })}
      </nav>
      <Link className="exam-account-link" to={isAuthenticated ? isAdmin ? '/admin/dashboard' : '/student/dashboard' : '/login'}>{isAuthenticated ? 'My dashboard' : 'Login'} <span aria-hidden="true">↗</span></Link>
    </div>
  </header>;
}
