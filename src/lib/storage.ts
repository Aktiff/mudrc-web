import fs from "fs";
import path from "path";
import { head, put } from "@vercel/blob";
import type { QuizEvent } from "@/lib/data";

const EVENTS_KEY = "mudrc/events.json";
const REGS_KEY = "mudrc/registrations.json";
const eventsPath = path.join(process.cwd(), "src/data/events.json");
const eventsLocalPath = path.join(process.cwd(), "src/data/events.local.json");
const regsPath = path.join(process.cwd(), "src/data/registrations.json");
const regsLocalPath = path.join(process.cwd(), "src/data/registrations.local.json");
const isVercel = !!process.env.VERCEL;

export type Registration = {
  id: string;
  eventSlug: string;
  venue: string;
  teamName: string;
  players: string;
  phone: string;
  createdAt: string;
};

function tmpPath(key: string): string {
  return path.join("/tmp", key.replace(/\//g, "_"));
}

function readLocalEvents(): { events: QuizEvent[] } {
  const file = fs.existsSync(eventsLocalPath) ? eventsLocalPath : eventsPath;
  let raw = fs.readFileSync(file, "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function readLocalRegistrations(): { registrations: Registration[] } {
  try {
    const file = fs.existsSync(regsLocalPath) ? regsLocalPath : regsPath;
    let raw = fs.readFileSync(file, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const data = JSON.parse(raw);
    return {
      registrations: (data.registrations ?? []).map((r: Registration & { eventSlug?: string }) => ({
        ...r,
        eventSlug: r.eventSlug ?? "",
      })),
    };
  } catch {
    return { registrations: [] };
  }
}

function readTmpJson<T>(key: string): T | null {
  try {
    const p = tmpPath(key);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeTmpJson(key: string, data: unknown): boolean {
  try {
    fs.writeFileSync(tmpPath(key), JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function readBlobJson<T>(key: string): Promise<T | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const meta = await head(key);
    const bust = meta.uploadedAt ? new Date(meta.uploadedAt).getTime() : Date.now();
    const res = await fetch(`${meta.url}?t=${bust}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function writeBlobJson(key: string, data: unknown): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await put(key, JSON.stringify(data, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return true;
  } catch {
    return false;
  }
}

export async function readEvents(): Promise<{ events: QuizEvent[] }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await readBlobJson<{ events: QuizEvent[] }>(EVENTS_KEY);
    if (blob) return blob;
  }
  if (isVercel) {
    const tmp = readTmpJson<{ events: QuizEvent[] }>(EVENTS_KEY);
    if (tmp) return tmp;
  }
  return readLocalEvents();
}

export async function writeEvents(data: { events: QuizEvent[] }): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const ok = await writeBlobJson(EVENTS_KEY, data);
    if (!ok) throw new Error("Blob write failed");
    return;
  }
  if (isVercel) {
    if (writeTmpJson(EVENTS_KEY, data)) return;
    throw new Error("Storage unavailable");
  }
  fs.writeFileSync(eventsLocalPath, JSON.stringify(data, null, 2), "utf-8");
}

export async function readRegistrations(): Promise<{ registrations: Registration[] }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await readBlobJson<{ registrations: Registration[] }>(REGS_KEY);
    if (blob) return blob;
  }
  if (isVercel) {
    const tmp = readTmpJson<{ registrations: Registration[] }>(REGS_KEY);
    if (tmp) return tmp;
  }
  return readLocalRegistrations();
}

export async function writeRegistrations(data: { registrations: Registration[] }): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const ok = await writeBlobJson(REGS_KEY, data);
    if (!ok) throw new Error("Blob write failed");
    return;
  }
  if (isVercel) {
    if (writeTmpJson(REGS_KEY, data)) return;
    throw new Error("Storage unavailable");
  }
  fs.writeFileSync(regsLocalPath, JSON.stringify(data, null, 2), "utf-8");
}

export async function addRegistration(reg: Registration): Promise<void> {
  const data = await readRegistrations();
  data.registrations.push(reg);
  await writeRegistrations(data);
}