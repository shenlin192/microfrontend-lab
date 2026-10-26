import React from 'react';
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(
  <p>
    Orders remote is running. Open{' '}
    <a href="http://localhost:4100/orders?dev=orders">the shell with Orders in development</a>.
  </p>,
);
