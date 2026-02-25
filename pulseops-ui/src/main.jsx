// ============================================================================
// Application Entry Point — PulseOps UI
//
// PURPOSE: Mounts the root React component into the DOM. This is the single
// entry point referenced by index.html. All application logic lives in App.jsx.
//
// ARCHITECTURE: React 18 createRoot API for concurrent rendering support.
// ============================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@core/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
