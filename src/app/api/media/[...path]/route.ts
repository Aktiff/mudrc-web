import { get } from "@vercel/blob";
import { BLOB_MEDIA_PREFIX } from "@/lib/blob-media";
import { blobAuthOptions, blobStoreAccess } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { path: string[] } };

export async function GET(req: Request, context: RouteContext) {
  const segments = context.params.path ?? [];
  if (!segments.length || segments.some((part) => part === ".." || part.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }

  const subpath = segments.map((part) => decodeURIComponent(part)).join("/");
  const pathname = `${BLOB_MEDIA_PREFIX}${subpath}`;
  const range = req.headers.get("range");

  try {
    const result = await get(pathname, {
      access: blobStoreAccess(),
      useCache: false,
      headers: range ? { Range: range } : undefined,
      ...blobAuthOptions(),
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", result.blob.contentType || "application/octet-stream");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    headers.set("X-Content-Type-Options", "nosniff");
    const contentRange = result.headers.get("content-range");
    const contentLength = result.headers.get("content-length");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (contentLength) headers.set("Content-Length", contentLength);
    else if (result.blob.size) headers.set("Content-Length", String(result.blob.size));

    return new Response(result.stream, {
      status: contentRange ? 206 : 200,
      headers,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
