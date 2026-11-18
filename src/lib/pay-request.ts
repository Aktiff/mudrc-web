import { headers } from "next/headers";
import { getPayBasePath, payHref, payPublicOrigin } from "@/lib/pay-config";

export function payRequestContext() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const basePath = getPayBasePath(host);
  const origin = payPublicOrigin(host);
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
