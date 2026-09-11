import { NextRequest, NextResponse } from "next/server";
import {
  addStoredCustomBankQuestion,
  mergeStoredCustomBankQuestions,
  readStoredCustomBankQuestions,
  removeStoredCustomBankQuestion,
} from "@/lib/custom-bank-storage";
import { parseCustomBankQuestionList, type NewCustomBankQuestionInput } from "@/lib/quiz-custom-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const questions = await readStoredCustomBankQuestions();
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri načítaní vlastnej banky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.merge === true && Array.isArray(body.questions)) {
      const incoming = parseCustomBankQuestionList(body.questions);
      const questions = await mergeStoredCustomBankQuestions(incoming);
      return NextResponse.json({ ok: true, questions });
    }

    const input = body as NewCustomBankQuestionInput;
    if (!input?.body?.trim()) {
      return NextResponse.json({ error: "Chýba text otázky" }, { status: 400 });
    }

    const created = await addStoredCustomBankQuestion(input);
    const questions = await readStoredCustomBankQuestions();
    return NextResponse.json({ ok: true, question: created, questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri ukladaní otázky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Chýba id otázky" }, { status: 400 });
  }
  try {
    const ok = await removeStoredCustomBankQuestion(id);
    if (!ok) return NextResponse.json({ error: "Otázka neexistuje" }, { status: 404 });
    const questions = await readStoredCustomBankQuestions();
    return NextResponse.json({ ok: true, questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chyba pri mazaní otázky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
