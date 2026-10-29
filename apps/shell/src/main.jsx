import { createRoot } from 'react-dom/client';
import { registerRemotes } from '@module-federation/runtime';
import App from './App';

async function start() {
  const response = await fetch('/remotes.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Cannot load remotes.json: HTTP ${response.status}`);
  const remotes = await response.json();

  registerRemotes(Object.entries(remotes).map(([name, { entry }]) => ({
    name, entry, type: 'module',
  })));

  createRoot(document.getElementById('root')).render(<App />);
}

start().catch((error) => {
  console.error(error);
  document.getElementById('root').textContent = `Cannot start shell: ${error.message}`;
});
