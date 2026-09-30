import StatistikyBoard from "@/components/admin/StatistikyBoard";
import { listQuizStatistics } from "@/lib/quiz-stats";

export const dynamic = "force-dynamic";

export default async function AdminStatistikyPage() {
  const { rows, venues } = await listQuizStatistics();
  return <StatistikyBoard initialRows={rows} venues={venues} />;
}
