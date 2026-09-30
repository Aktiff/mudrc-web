"use client";

import { upload } from "@vercel/blob/client";

function mediaUrlFromPathname(pathname: string): string {
  const sub = pathname.replace(/^mudrc\/media\//, "");
  return `/api/media/${sub.split("/").map(encodeURIComponent).join("/")}`;
}

/** Väčší súbor ide priamo do Blob, nie cez limit tela serverless funkcie. */
export async function uploadLargeFileToBlob(folder: "audio" | "video", file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const pathname = `mudrc/media/${folder}/${Date.now()}.${ext}`;
  const blob = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/admin/upload/blob-client",
  });
  return mediaUrlFromPathname(blob.pathname);
}
