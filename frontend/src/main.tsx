import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/theme.css';
import './styles/animations.css';
import './styles/components.css';
import App from './App';
import { Toaster } from './components/Toast';
import { ConfirmHost } from './components/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster />
        <ConfirmHost />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
