"use client";

import { MAX_VIDEO_BYTES } from "@/lib/video-upload";
import { uploadFileToMediaHost } from "@/lib/upload-media-host-client";

export async function uploadVideoFileClient(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Maximálna veľkosť videa je 80 MB — skráť ukážku alebo zníž rozlíšenie.");
  }

  return uploadFileToMediaHost("video", file);
}
