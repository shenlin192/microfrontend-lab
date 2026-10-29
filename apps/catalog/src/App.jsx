export default function App({ shellUrl = import.meta.env.VITE_SHELL_URL || 'http://localhost:4100/' }) {
  return (
    <>
      <h2>Catalog remote 1256</h2>
      <a href={new URL('#/orders', shellUrl).href}>Go to Orders</a>
    </>
  );
}
