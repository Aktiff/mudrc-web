import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SeatPlanWaiterView from "@/components/SeatPlanWaiterView";
import { readSeatPlanByToken } from "@/lib/seat-plan-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = await readSeatPlanByToken(params.token);
  const title = plan ? `${plan.venue || plan.title} — zasadací` : "Zasadací poriadok";
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function WaiterSeatPlanPage({ params }: Props) {
  const plan = await readSeatPlanByToken(params.token);
  if (!plan) notFound();
  return <SeatPlanWaiterView plan={plan} />;
}
