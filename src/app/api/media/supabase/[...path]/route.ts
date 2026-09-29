import { fetchSupabaseUploadsBytes } from "@/lib/supabase-uploads-bytes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { path: string[] } };

export async function GET(_req: Request, context: RouteContext) {
  const segments = context.params.path ?? [];
  if (!segments.length || segments.some((part) => part === ".." || part.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }

  const objectPath = segments.map((part) => decodeURIComponent(part)).join("/");
  const allowed = /^(audio|video|events|images)\//.test(objectPath);
  if (!allowed) {
    return new Response("Not found", { status: 404 });
  }

  const file = await fetchSupabaseUploadsBytes(objectPath);
  if (!file?.buffer.length) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
