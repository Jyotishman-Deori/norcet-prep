// =====================================================================
// src/admin-main.jsx — entry point for the STANDALONE ADMIN APP (admin.html).
// Deliberately minimal: no service worker / PWA registration (the admin tool is
// not an installable offline app), no referral capture. Shares everything else
// with the student app via src/lib.
// =====================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp, { ErrorBoundary } from './AdminApp.jsx';
import './index.css';
import { installGlobalErrorCapture } from './lib/errorlog.js';

// Group uncaught errors for the same crash dashboard the student app feeds.
installGlobalErrorCapture();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </React.StrictMode>
);
