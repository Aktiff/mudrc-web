export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { path: string[] } };

/** Staré odkazy na cudzie úložisko sa už nesťahujú. Súbor treba nahrať znova do Blobu. */
export async function GET(_req: Request, _context: RouteContext) {
  return new Response("Súbor už nie je v úložisku. Nahraj ho znova v adminovi.", {
    status: 410,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
