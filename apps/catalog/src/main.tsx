import React from 'react';
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(
  <p>
    Catalog remote is running. Open{' '}
    <a href="http://localhost:4100/catalog?dev=catalog">the shell with Catalog in development</a>.
  </p>,
);
