import { NextRequest, NextResponse } from "next/server";
import {
  buildFinanceExpectedIncomes,
  verifyFinanceBearerToken,
} from "@/lib/finance-sync";
import { readPayTeams } from "@/lib/pay-storage";
import { readEvents, readRegistrations } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

export async function GET(req: NextRequest) {
  const auth = verifyFinanceBearerToken(
    req.headers.get("authorization"),
    process.env.FINANCE_SYNC_TOKEN
  );
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: NO_STORE }
    );
  }

  try {
    const [{ events }, { registrations }, payTeams] = await Promise.all([
      readEvents(),
      readRegistrations(),
      readPayTeams(),
    ]);

    const payload = buildFinanceExpectedIncomes({
      events,
      registrations,
      payTeams,
    });

    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (error) {
    console.error("GET /api/finance/expected-incomes failed:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa načítať predpokladané príjmy." },
      { status: 500, headers: NO_STORE }
    );
  }
}
