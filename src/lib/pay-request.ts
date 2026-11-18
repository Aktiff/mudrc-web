import { headers } from "next/headers";
import { getPayBasePath, isPayHostname, payHref, payPublicOrigin } from "@/lib/pay-config";

export function payRequestContext() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || h.get("x-forwarded-protocol") || null;
  const origin = payPublicOrigin(host, proto);
  let originHost = "";
  try {
    originHost = new URL(origin).hostname;
  } catch {
    originHost = "";
  }
  // Match path prefix to the public origin (pay.mudrc.sk is root-mounted).
  const basePath = isPayHostname(originHost) ? "" : getPayBasePath(host);
  return {
    host,
    basePath,
    origin,
    href: (path: string) => payHref(basePath, path),
    absolute: (path: string) => {
      const rel = payHref(basePath, path);
      return `${origin}${rel}`;
    },
  };
}
