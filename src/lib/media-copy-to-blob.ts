import { isSupabaseUploadsUrl, rewriteStoredMediaUrl } from "@/lib/media-url";

/** Staré odkazy ostanú ako interná cesta, kým sa súbor nenahrá znova. Bajty sa už neodťahujú z cudzieho úložiska. */
export async function copyOrRewriteMediaUrl(url: string | undefined): Promise<string | undefined> {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/api/media/") && !trimmed.includes("/api/media/supabase/")) {
    return trimmed;
  }
  return rewriteStoredMediaUrl(trimmed) ?? trimmed;
}

export function mediaUrlNeedsRepair(url: string | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/api/media/") && !trimmed.includes("/api/media/supabase/")) return false;
  return isSupabaseUploadsUrl(trimmed) || trimmed.startsWith("/api/media/supabase/") || trimmed.startsWith("/uploads/");
}
