import { lazy, Suspense, useEffect, useState } from 'react';
import { loadRemote } from '@module-federation/runtime';

// These modules come from separate Vite servers, not local files.
const Catalog = lazy(() => loadRemote('catalog/App'));
const Orders = lazy(() => loadRemote('orders/App'));

export default function App() {
  const [route, setRoute] = useState(location.hash);

  useEffect(() => {
    const navigate = () => setRoute(location.hash);
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  return (
    <>
      <h1>Shell</h1>
      <nav>
        <a href="#/">Home</a> | <a href="#/catalog">Catalog</a> | <a href="#/orders">Orders</a>
      </nav>
      <Suspense fallback={<p>Loading remote…</p>}>
        {route === '#/catalog' && <Catalog shellUrl={location.href} />}
        {route === '#/orders' && <Orders shellUrl={location.href} />}
      </Suspense>
    </>
  );
}
