export default function App() {
  return (
    <>
      <h2>Catalog remote 1256</h2>
      <a href={new URL('#/orders', import.meta.env.VITE_SHELL_URL || 'http://localhost:4100/').href}>Go to Orders</a>
    </>
  );
}
