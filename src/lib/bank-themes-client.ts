import { DEFAULT_BANK_THEMES, mergeBankThemes } from "@/lib/bank-themes";

export function notifyBankThemesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mudrc-bank-themes-updated"));
}

export async function fetchBankThemes(): Promise<string[]> {
  try {
    const res = await fetch(`/api/admin/bank-themes?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [...DEFAULT_BANK_THEMES];
    const data = (await res.json()) as { themes?: unknown };
    return mergeBankThemes(Array.isArray(data.themes) ? data.themes : []);
  } catch {
    return [...DEFAULT_BANK_THEMES];
  }
}

export async function addBankThemeAsync(name: string): Promise<string[]> {
  const res = await fetch("/api/admin/bank-themes", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; themes?: unknown };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Tému sa nepodarilo pridať");
  }
  const themes = mergeBankThemes(Array.isArray(data.themes) ? data.themes : []);
  notifyBankThemesUpdated();
  return themes;
}
