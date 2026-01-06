import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BackButton from './BackButton';
import { setLedCrownBlue, setLedCrownOrange, setLedCrownWhite } from '../lib/ledCrown';

function getBackConfig(pathname) {
  if (pathname.startsWith('/interviews/')) {
    return { label: 'BACK TO INTERVIEWS', to: '/interviews', fallbackTo: '/interviews' };
  }
  if (pathname.startsWith('/add-interview/new')) {
    return { label: 'BACK TO ADD INTERVIEW', to: '/add-interview', fallbackTo: '/add-interview' };
  }
  if (pathname.startsWith('/add-interview')) {
    return { label: 'BACK TO TERMINAL', to: '/', fallbackTo: '/' };
  }
  if (pathname.startsWith('/interviews')) {
    return { label: 'BACK TO TERMINAL', to: '/', fallbackTo: '/' };
  }
  if (pathname.startsWith('/summaries')) {
    return { label: 'BACK TO TERMINAL', to: '/', fallbackTo: '/' };
  }
  return { label: 'BACK', to: null, fallbackTo: '/' };
}

export default function AppFrame() {
  const location = useLocation();
  const showBack = location.pathname !== '/';
  const { label, to, fallbackTo } = getBackConfig(location.pathname);

  useEffect(() => {
    // Route-driven behavior: keep crown color stable per page.
    // Special states (e.g. analysis completion) can override this until the next route change.
    const path = location.pathname;
    if (path.startsWith('/summaries')) {
      setLedCrownOrange();
      return;
    }
    if (path.startsWith('/interviews')) {
      setLedCrownBlue();
      return;
    }
    setLedCrownWhite();
  }, [location.pathname]);

  return (
    <>
      {showBack && <BackButton label={label} to={to} fallbackTo={fallbackTo} />}
      <Outlet />
    </>
  );
}
