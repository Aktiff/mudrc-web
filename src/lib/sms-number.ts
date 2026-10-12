const GSM =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

export function toSmsNumber(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `421${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("9")) digits = `421${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

function needsUnicode(text: string): boolean {
  for (const char of text) {
    if (GSM.includes(char) || GSM_EXT.includes(char)) continue;
    return true;
  }
  return false;
}

export function smsPreview(text: string): { unicode: boolean; parts: number; max: number } {
  const unicode = needsUnicode(text);
  const max = unicode ? 268 : 612;
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const length = text.length;
  const parts = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  return { unicode, parts, max };
}
