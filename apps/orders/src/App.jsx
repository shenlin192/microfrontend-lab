export default function App() {
  return (
    <>
      <h2>Orders remote</h2>
      <a href={new URL('#/catalog', import.meta.env.VITE_SHELL_URL || 'http://localhost:4100/').href}>Go to Catalog</a>
    </>
  );
}
