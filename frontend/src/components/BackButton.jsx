import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackButton({
  label = 'Back',
  to = null,
  fallbackTo = '/',
}) {
  const navigate = useNavigate();

  const goBack = useCallback(() => {
    if (to) {
      navigate(to);
      return;
    }
    // If the user deep-linked into a page, history.back() may leave the site.
    // We prefer an in-app fallback in that case.
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      navigate(fallbackTo, { replace: true });
      return;
    }
    navigate(-1);
  }, [navigate, to, fallbackTo]);

  return (
    <button
      type="button"
      className="mam-back-btn"
      onClick={goBack}
      aria-label={label}
    >
      <span className="mam-back-btn__arrow" aria-hidden="true">←</span>
      <span className="mam-back-btn__label">{label}</span>
    </button>
  );
}
