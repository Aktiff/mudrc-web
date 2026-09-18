import type { CSSProperties } from "react";

export type PresentationAspectMode = "viewport" | "16:9" | "18:9" | "16:10" | "4:3";

export const PRESENTATION_ASPECT_OPTIONS: {
  id: PresentationAspectMode;
  label: string;
  hint: string;
}[] = [
  { id: "viewport", label: "Celá obrazovka", hint: "Notebook / PC — využije celú šírku" },
  { id: "16:9", label: "16 : 9", hint: "TV, projektor (Full HD)" },
  { id: "18:9", label: "18 : 9", hint: "Ultrawide TV, niektoré telefóny" },
  { id: "16:10", label: "16 : 10", hint: "MacBook, niektoré monitory" },
  { id: "4:3", label: "4 : 3", hint: "Užší formát, menej „natiahnuté“ na širokom TV" },
];

const RATIO: Record<Exclude<PresentationAspectMode, "viewport">, [number, number]> = {
  "16:9": [16, 9],
  "18:9": [18, 9],
  "16:10": [16, 10],
  "4:3": [4, 3],
};

/** Letterboxed rám (16:9, 4:3…) — obsah musí zmestiť do boxu, nie celej obrazovky. */
export function isLetterboxedStage(mode: PresentationAspectMode): boolean {
  return mode !== "viewport";
}

export function presentationStageBoxStyle(mode: PresentationAspectMode): CSSProperties {
  if (mode === "viewport") {
    return { width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" };
  }
  const [w, h] = RATIO[mode];
  return {
    aspectRatio: `${w} / ${h}`,
    width: `min(100vw, calc(100vh * ${w} / ${h}))`,
    height: `min(100vh, calc(100vw * ${h} / ${w}))`,
    maxWidth: "100%",
    maxHeight: "100%",
  };
}
