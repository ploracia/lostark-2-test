import { PROXY_ORIGIN } from "./api";
import { useSession } from "./session";

export function ProxyRetry({
  retry,
  disabled,
}: {
  retry: () => void;
  disabled?: boolean;
}) {
  const { demo, proxyActive, allowProxy } = useSession();
  if (!PROXY_ORIGIN || demo || proxyActive) return null;
  return (
    <button
      className="btn"
      type="button"
      disabled={disabled}
      onClick={() => {
        if (allowProxy()) retry();
      }}
    >
      프록시로 재시도
    </button>
  );
}
