import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const nativeFetch = window.fetch ? window.fetch.bind(window) : undefined;
  let activeFetch = nativeFetch;
  const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (!desc || (desc.configurable && !desc.writable && !desc.set)) {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      get() {
        return activeFetch;
      },
      set(nextFetch) {
        if (typeof nextFetch === 'function') {
          activeFetch = nextFetch;
        }
      },
    });
  }
} catch {
  // Ignore if window.fetch is non-configurable in this environment
}

createRoot(document.getElementById('root')!).render(<App />);

