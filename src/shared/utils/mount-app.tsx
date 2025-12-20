/**
 * React App Mount Utility
 * 
 * Shared utility for mounting React applications with consistent setup.
 * Eliminates duplication across panel, popup, options, and pdf-scanner main.tsx files.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// Import shared fonts
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/geologica/400.css';
import '@fontsource/geologica/500.css';

/**
 * Mount a React application to the DOM
 * 
 * @param App - The root React component to mount
 * @param rootId - The ID of the DOM element to mount to (defaults to 'root')
 */
export function mountApp(App: React.ComponentType, rootId = 'root'): void {
  const root = document.getElementById(rootId);
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

