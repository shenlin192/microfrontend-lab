export default function App({ shellUrl }) {
  const localShellUrl = 'http://localhost:4100/';
  const standaloneShellUrl = import.meta.env.VITE_SHELL_STANDALONE_FALLBACK_URL || localShellUrl;
  // Inside a shell, its current URL takes precedence over the standalone fallback.
  const navigationShellUrl = shellUrl ?? standaloneShellUrl;

  return (
    <>
      <h2>Orders remote</h2>
      <a href={new URL('#/catalog', navigationShellUrl).href}>Go to Catalog</a>
    </>
  );
}
