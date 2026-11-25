export function parseProxyOrigin(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !(url.protocol === "https:" || (url.protocol === "http:" && local)) ||
    !/^(?:[a-z\d.-]+|\[[a-f\d:]+\])$/i.test(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "VITE_PROXY_URL must be an HTTPS origin or an HTTP loopback origin.",
    );
  return url.origin;
}
