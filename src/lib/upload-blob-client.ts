"use client";

import { upload } from "@vercel/blob/client";
import { guessAudioContentType } from "@/lib/audio-upload";
import { guessVideoContentType } from "@/lib/video-upload";

function mediaUrlFromPathname(pathname: string): string {
  const sub = pathname.replace(/^mudrc\/media\//, "");
  return `/api/media/${sub.split("/").map(encodeURIComponent).join("/")}`;
}

/** Väčší súbor ide priamo do Blob, nie cez limit tela serverless funkcie. */
export async function uploadLargeFileToBlob(folder: "audio" | "video", file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const pathname = `mudrc/media/${folder}/${Date.now()}.${ext}`;
  const contentType =
    folder === "audio"
      ? guessAudioContentType(file.name, file.type || "")
      : guessVideoContentType(file.name, file.type || "");
  const blob = await upload(pathname, file, {
    access: "private",
    contentType,
    handleUploadUrl: "/api/admin/upload/blob-client",
  });
  return mediaUrlFromPathname(blob.pathname);
}
