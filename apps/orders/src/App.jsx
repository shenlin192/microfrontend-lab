export default function App({ shellUrl = import.meta.env.VITE_SHELL_URL || 'http://localhost:4100/' }) {
  return (
    <>
      <h2>Orders remote</h2>
      <a href={new URL('#/catalog', shellUrl).href}>Go to Catalog</a>
    </>
  );
}
