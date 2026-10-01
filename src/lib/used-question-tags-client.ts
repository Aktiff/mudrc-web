import { uniqueQuestionTags } from "@/lib/quiz-question-tags";

const EVENT = "mudrc-used-tags-updated";

let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

function publish(tags: string[]): string[] {
  cache = tags;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
  return tags;
}

export function peekUsedQuestionTags(): string[] {
  return cache ?? [];
}

export function fetchUsedQuestionTags(): Promise<string[]> {
  if (!inflight) {
    inflight = fetch(`/api/admin/question-tags?_=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return cache ?? [];
        const data = await res.json().catch(() => ({}));
        return publish(uniqueQuestionTags([...(cache ?? []), ...(Array.isArray(data.tags) ? data.tags : [])]));
      })
      .catch(() => cache ?? [])
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function rememberUsedQuestionTags(tags: string[]): void {
  const incoming = uniqueQuestionTags(tags);
  if (!incoming.length) return;
  const prev = cache ?? [];
  const added = incoming.filter((tag) => !prev.includes(tag));
  publish(uniqueQuestionTags([...prev, ...incoming]));
  if (!added.length) return;
  void fetch("/api/admin/question-tags", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags: added }),
  }).catch(() => undefined);
}

export function subscribeUsedQuestionTags(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
