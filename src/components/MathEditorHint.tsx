import { MATH_EDITOR_HINT_SK } from "@/lib/math-text";
import MathText, { MathLivePreview } from "@/components/MathText";

/** Minimal Slovak hint under question/answer fields. */
export function MathEditorHint({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-brand-muted text-xs mt-1"}>
      {MATH_EDITOR_HINT_SK}
    </p>
  );
}

/** Live KaTeX preview under a field when the value contains `$`. */
export function MathFieldAssist({
  value,
  showHint = true,
}: {
  value: string;
  showHint?: boolean;
}) {
  return (
    <>
      {showHint ? <MathEditorHint /> : null}
      <MathLivePreview value={value} />
    </>
  );
}

export { MathText, MathLivePreview };
