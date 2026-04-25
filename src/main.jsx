import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── One-time stale session cleanup ────────────────────────────────────────
// Previous versions stored cp_role='admin' without a user record.
// If cp_role=admin exists but no matching user in cp_admin_users, wipe it.
;(function clearStaleSession() {
  try {
    const role    = localStorage.getItem('cp_role');
    const email   = localStorage.getItem('cp_admin_session');
    const raw     = localStorage.getItem('cp_admin_users');
    const users   = raw ? JSON.parse(raw) : [];
    if (role === 'admin') {
      const valid = email && users.find((u) => u.email === email);
      if (!valid) {
        localStorage.removeItem('cp_role');
        localStorage.removeItem('cp_admin_session');
      }
    }
  } catch (_) {
    localStorage.removeItem('cp_role');
    localStorage.removeItem('cp_admin_session');
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
