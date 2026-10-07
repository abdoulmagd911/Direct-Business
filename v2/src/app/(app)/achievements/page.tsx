import { redirect } from 'next/navigation';

/** The short address (V605 (2)) goes to where Achievements live, under KPIs. */
export default function AchievementsPage() {
  redirect('/kpis/achievements');
}
