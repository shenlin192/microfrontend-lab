import { useEffect, useState } from 'react';
import { api, money, type AppProps, type Product, type Order } from '@lab/platform';
import { Button, Notice } from '@lab/ui';
import styles from './catalog.module.css';
export default function Catalog({ platform }: AppProps) {
  const [products, setProducts] = useState<Product[]>([]),
    [filter, setFilter] = useState('All'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true;
    api<Product[]>('/products')
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function order(product: Product) {
    if (!platform.user) {
      platform.navigate('/login');
      return;
    }
    setBusy(product.id);
    setError('');
    setSuccess('');
    try {
      const result = await api<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          requestKey: crypto.randomUUID(),
        }),
      });
      platform.emit({
        type: 'order:created',
        version: 1,
        source: 'catalog',
        payload: { orderId: result.id },
      });
      setSuccess(`${product.name} ordered. Find it in your orders.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <section className={styles.catalog} aria-label="Catalog application">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>THE EVERYDAY COLLECTION</span>
          <h2>Good things, simply made.</h2>
          <p>Three small objects. One thoughtfully connected application.</p>
        </div>
        <span className={styles.version}>catalog · {__APP_VERSION__}</span>
      </div>
      <div className={styles.filters} aria-label="Product filters">
        {['All', 'Paper', 'Ceramics', 'Objects'].map((category) => (
          <button
            key={category}
            aria-pressed={filter === category}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
        <span>Local React state · resets on unmount</span>
      </div>
      {error && <Notice error>{error}</Notice>}
      {success && (
        <Notice>
          {success}{' '}
          <button className={styles.link} onClick={() => platform.navigate('/orders')}>
            View orders →
          </button>
        </Notice>
      )}
      <div className={styles.grid}>
        {products
          .filter((p) => filter === 'All' || p.category === filter)
          .map((product) => (
            <article className={styles.card} key={product.id}>
              <div className={`${styles.art} ${styles[product.id]}`} aria-hidden="true">
                <span className={styles.object} />
                <span className={styles.shadow} />
                <span className={styles.number}>0{products.indexOf(product) + 1}</span>
              </div>
              <div className={styles.details}>
                <span className={styles.category}>{product.category}</span>
                <div className={styles.productTitle}>
                  <h3>{product.name}</h3>
                  <strong>{money(product.price)}</strong>
                </div>
                <p>{product.description}</p>
                <Button disabled={!!busy} onClick={() => order(product)}>
                  {busy === product.id
                    ? 'Saving order…'
                    : platform.user
                      ? 'Place an order ↗'
                      : 'Sign in to order ↗'}
                </Button>
              </div>
            </article>
          ))}
      </div>
      <div className={styles.note}>
        <span>↳</span>
        <p>
          <strong>A real request, a real record.</strong> Ordering calls the API, stores a row in
          the database, then publishes <code>order:created</code>. No payment is collected.
        </p>
      </div>
    </section>
  );
}
