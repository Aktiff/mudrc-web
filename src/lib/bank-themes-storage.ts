import fs from "fs";
import path from "path";
import { mergeBankThemes, normalizeBankThemeName } from "@/lib/bank-themes";
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";

const localPath = path.join(process.cwd(), "src/data/bank-themes.local.json");
const BLOB_NAME = "bank-themes";

function readLocalThemes(): string[] {
  try {
    if (!fs.existsSync(localPath)) return [];
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { themes?: unknown };
    return Array.isArray(raw.themes) ? raw.themes.filter((theme): theme is string => typeof theme === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalThemes(themes: string[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify({ themes }, null, 2), "utf-8");
}

export async function readStoredBankThemes(): Promise<string[]> {
  const data = await readAppStorageWithFallback<{ themes?: unknown }>({
    label: "bank-themes",
    blobName: BLOB_NAME,
    readLocal: () => ({ themes: readLocalThemes() }),
    empty: { themes: [] },
  });
  const stored = Array.isArray(data.themes) ? data.themes : [];
  return mergeBankThemes(stored);
}

export async function addStoredBankTheme(name: string): Promise<string[]> {
  const theme = normalizeBankThemeName(name);
  if (!theme) throw new Error("Zadaj názov témy");
  const current = await readStoredBankThemes();
  const next = mergeBankThemes([...current, theme]);
  await writeAppStorageWithFallback({
    label: "bank-themes",
    blobName: BLOB_NAME,
    payload: { themes: next },
    writeLocal: () => writeLocalThemes(next),
  });
  return next;
}
