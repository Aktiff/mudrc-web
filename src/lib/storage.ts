import fs from "fs";
import path from "path";
import { head, put } from "@vercel/blob";
import type { QuizEvent } from "@/lib/data";

const EVENTS_KEY = "mudrc/events.json";
const REGS_KEY = "mudrc/registrations.json";
const eventsPath = path.join(process.cwd(), "src/data/events.json");
const regsPath = path.join(process.cwd(), "src/data/registrations.json");
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
  let raw = fs.readFileSync(eventsPath, "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function readLocalRegistrations(): { registrations: Registration[] } {
  try {
    let raw = fs.readFileSync(regsPath, "utf-8");
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
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function writeBlobJson(key: string, data: unknown): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
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

async function readJson<T>(key: string, localReader: () => T): Promise<T> {
  const blob = await readBlobJson<T>(key);
  if (blob) return blob;
  const tmp = readTmpJson<T>(key);
  if (tmp) return tmp;
  return localReader();
}

async function writeJson(key: string, data: unknown, localPath: string): Promise<void> {
  if (await writeBlobJson(key, data)) return;
  if (isVercel && writeTmpJson(key, data)) return;
  if (!isVercel) {
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2), "utf-8");
    return;
  }
  throw new Error("Storage unavailable");
}

export async function readEvents(): Promise<{ events: QuizEvent[] }> {
  return readJson(EVENTS_KEY, readLocalEvents);
}

export async function writeEvents(data: { events: QuizEvent[] }): Promise<void> {
  await writeJson(EVENTS_KEY, data, eventsPath);
}

export async function readRegistrations(): Promise<{ registrations: Registration[] }> {
  return readJson(REGS_KEY, readLocalRegistrations);
}

export async function writeRegistrations(data: { registrations: Registration[] }): Promise<void> {
  await writeJson(REGS_KEY, data, regsPath);
}

export async function addRegistration(reg: Registration): Promise<void> {
  const data = await readRegistrations();
  data.registrations.push(reg);
  await writeRegistrations(data);
}