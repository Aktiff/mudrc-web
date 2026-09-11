import SeatPlanEditor from "@/components/SeatPlanEditor";

export default function AdminSeatPlanEditorPage({ params }: { params: { id: string } }) {
  return <SeatPlanEditor planId={params.id} />;
}
