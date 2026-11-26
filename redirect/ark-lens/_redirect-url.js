// @ts-check
/** @param {Pick<Location, "pathname" | "search" | "hash">} location */
export function redirectUrl({ pathname, search, hash }) {
  const destination = new globalThis.URL("https://mokokoloa.pages.dev");
  destination.pathname = pathname;
  const query = new globalThis.URLSearchParams(search);
  query.set("from", "ark-lens");
  destination.search = query.toString();
  destination.hash = hash;
  return destination.href;
}
