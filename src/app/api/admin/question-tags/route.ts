import { NextRequest, NextResponse } from "next/server";
import { mergeStoredUsedTags, readUsedQuestionTagSuggestions } from "@/lib/used-tag-storage";
import { uniqueQuestionTags } from "@/lib/quiz-question-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tags = await readUsedQuestionTagSuggestions();
    return NextResponse.json({ tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri načítaní tagov";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const incoming = uniqueQuestionTags(body?.tags);
    if (!incoming.length) {
      const tags = await readUsedQuestionTagSuggestions();
      return NextResponse.json({ ok: true, tags });
    }
    const tags = await mergeStoredUsedTags(incoming);
    return NextResponse.json({ ok: true, tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní tagov";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
