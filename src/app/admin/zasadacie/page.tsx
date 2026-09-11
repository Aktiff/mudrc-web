import { Suspense } from "react";
import SeatPlanListClient from "@/components/SeatPlanListClient";

export default function AdminSeatPlansPage() {
  return (
    <Suspense fallback={<p className="text-sm text-brand-muted">Načítavam…</p>}>
      <SeatPlanListClient />
    </Suspense>
  );
}
