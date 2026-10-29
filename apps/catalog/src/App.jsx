export default function App({ shellUrl }) {
  const localShellUrl = 'http://localhost:4100/';
  const standaloneShellUrl = import.meta.env.VITE_SHELL_STANDALONE_FALLBACK_URL || localShellUrl;
  // Inside a shell, its current URL takes precedence over the standalone fallback.
  const navigationShellUrl = shellUrl ?? standaloneShellUrl;

  return (
    <>
      <h2>Catalog remote 1256</h2>
      <a href={new URL('#/orders', navigationShellUrl).href}>Go to Orders</a>
    </>
  );
}
