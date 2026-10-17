import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import RuntimeErrorBoundary from './components/RuntimeErrorBoundary.jsx';
import './styles.css';
import { installGlobalErrorHandlers } from './lib/telemetry.js';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')).render(
  <React.StrictMode><RuntimeErrorBoundary><BrowserRouter><App /></BrowserRouter></RuntimeErrorBoundary></React.StrictMode>
);
