import { redirectUrl } from "../redirect/ark-lens/_redirect-url.js";

const prefix = "/_from-ark-lens";

export function legacyArrivalPath({ pathname, search, hash }: URL | Location) {
  if (!pathname.startsWith(prefix + "/")) return null;
  const originalPath = pathname.slice(prefix.length);
  const destination = new URL(
    redirectUrl({ pathname: originalPath, search, hash }),
  );
  // An absolute path starting with two slashes can be interpreted as a host.
  const safePath = destination.pathname.replace(/^\/\//, "/%2F");
  return safePath + destination.search + destination.hash;
}
