export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_VIDEO_SERVER_BYTES = 3.5 * 1024 * 1024;

const EXT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
};

export function guessVideoContentType(fileName: string, fileType: string): string {
  if (fileType.startsWith("video/")) return fileType;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "video/mp4";
}

export function isAllowedVideoFile(fileName: string, fileType: string): boolean {
  if (fileType.startsWith("video/")) return true;
  if (fileType === "application/octet-stream") return /\.(mp4|webm|mov|m4v)$/i.test(fileName);
  return /\.(mp4|webm|mov|m4v)$/i.test(fileName);
}

export function formatSupabaseVideoUploadError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("mime") || lower.includes("content type") || lower.includes("invalid")) {
    return (
      "Supabase bucket „uploads“ neakceptuje video. Skontroluj povolené MIME typy v Storage → uploads " +
      "(mp4, webm) alebo spusti scripts/supabase.sql."
    );
  }
  return `Supabase upload failed: ${message}`;
}
