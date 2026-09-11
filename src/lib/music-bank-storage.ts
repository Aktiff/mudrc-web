import fs from "fs";
import path from "path";
import {
  createMusicBankItem,
  normalizeMusicBankItem,
  parseMusicBankList,
  type MusicBankItem,
  type NewMusicBankItemInput,
} from "@/lib/music-bank";
import { hasSupabaseStorage, supabaseFetchMusicBank, supabaseSetMusicBank } from "@/lib/supabase-storage";

const localPath = path.join(process.cwd(), "src/data/music-bank.local.json");

function readLocalMusicBank(): MusicBankItem[] {
  try {
    if (!fs.existsSync(localPath)) return [];
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { tracks?: unknown[] };
    return parseMusicBankList(raw.tracks).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeLocalMusicBank(tracks: MusicBankItem[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify({ tracks }, null, 2), "utf-8");
}

export async function readStoredMusicBank(): Promise<MusicBankItem[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchMusicBank();
    if (result.status === "error") throw new Error(result.message);
    if (result.status === "missing") return [];
    return parseMusicBankList(result.value.tracks).sort((a, b) => b.createdAt - a.createdAt);
  }
  return readLocalMusicBank();
}

export async function writeStoredMusicBank(tracks: MusicBankItem[]): Promise<void> {
  const sorted = [...tracks].sort((a, b) => b.createdAt - a.createdAt);
  if (hasSupabaseStorage()) {
    await supabaseSetMusicBank({ tracks: sorted });
    return;
  }
  writeLocalMusicBank(sorted);
}

export async function addStoredMusicBankItem(input: NewMusicBankItemInput): Promise<MusicBankItem> {
  const item = createMusicBankItem(input);
  const existing = await readStoredMusicBank();
  await writeStoredMusicBank([item, ...existing.filter((t) => t.id !== item.id)]);
  return item;
}

export async function removeStoredMusicBankItem(id: string): Promise<boolean> {
  const existing = await readStoredMusicBank();
  const next = existing.filter((t) => t.id !== id);
  if (next.length === existing.length) return false;
  await writeStoredMusicBank(next);
  return true;
}
