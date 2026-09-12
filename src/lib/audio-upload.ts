export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
/** Vercel serverless request body limit (~4.5 MB) — larger files need client → Blob upload. */
export const MAX_AUDIO_SERVER_BYTES = 3.5 * 1024 * 1024;

const EXT_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
};

export function guessAudioContentType(fileName: string, fileType: string): string {
  if (fileType.startsWith("audio/")) return fileType;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "audio/mpeg";
}

export function isAllowedAudioFile(fileName: string, fileType: string): boolean {
  if (fileType.startsWith("audio/")) return true;
  if (fileType === "application/octet-stream") return /\.(mp3|m4a|wav|ogg|aac)$/i.test(fileName);
  return /\.(mp3|m4a|wav|ogg|aac)$/i.test(fileName);
}

export function formatSupabaseAudioUploadError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("mime") || lower.includes("content type") || lower.includes("invalid")) {
    return (
      "Supabase bucket „uploads“ neakceptuje audio. V SQL Editore znova spusti scripts/supabase.sql (povolené MIME pre MP3) " +
      "alebo v Storage → uploads zruš obmedzenie typov súborov."
    );
  }
  return `Supabase upload failed: ${message}`;
}
