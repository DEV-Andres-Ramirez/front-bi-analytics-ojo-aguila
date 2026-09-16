import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AppHeaderFallback } from "@/components/header/app-header";

export default function DashboardLoading() {
  return (
    <>
      <AppHeaderFallback />
      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <DashboardSkeleton />
      </main>
    </>
  );
}
