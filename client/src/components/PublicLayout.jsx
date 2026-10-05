import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PublicHeader from './PublicHeader';

export default function PublicLayout() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <div className="public-shell"><a className="exam-skip" href="#public-content">Skip to content</a><PublicHeader key={`${location.pathname}${location.search}`} /><div id="public-content"><Outlet /></div></div>;
}
