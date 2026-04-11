import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx'; // Import the ErrorBoundary
import './index.css';

console.log('[Main] Starting React application');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Wrap the entire application in the global ErrorBoundary */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);