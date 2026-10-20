"use client";

import { MAX_AUDIO_BYTES } from "@/lib/audio-upload";
import { uploadFileToMediaHost } from "@/lib/upload-media-host-client";

export async function uploadAudioFileClient(file: File): Promise<string> {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Maximálna veľkosť audio je 20 MB — skráť ukážku na ~30 s.");
  }

  try {
    return await uploadFileToMediaHost("audio", file);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Nahrávanie trvalo príliš dlho. Skús to znova.");
    }
    throw error;
  }
}
