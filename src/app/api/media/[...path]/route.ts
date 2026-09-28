import { get } from "@vercel/blob";
import { BLOB_MEDIA_PREFIX } from "@/lib/blob-media";
import { blobAuthOptions, blobStoreAccess } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { path: string[] } };

export async function GET(_req: Request, context: RouteContext) {
  const segments = context.params.path ?? [];
  if (!segments.length || segments.some((part) => part === ".." || part.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }

  const subpath = segments.map((part) => decodeURIComponent(part)).join("/");
  const pathname = `${BLOB_MEDIA_PREFIX}${subpath}`;

  try {
    const result = await get(pathname, {
      access: blobStoreAccess(),
      ...blobAuthOptions(),
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response("Not found", { status: 404 });
    }

    const contentType = result.blob.contentType || "application/octet-stream";
    return new Response(result.stream, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
