import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SiteFooter } from "@/components/dashboard/site-footer";
import { AppHeader, AppHeaderFallback } from "@/components/header/app-header";
import { requireSession } from "@/server/auth/session";
import { getCatalogo } from "@/server/repositories/catalogo.repository";

export const metadata: Metadata = {
  title: "Resultados",
};

export default async function DashboardPage() {
  await requireSession();
  const catalogo = await getCatalogo();

  return (
    <>
      <Suspense fallback={<AppHeaderFallback />}>
        <AppHeader catalogo={catalogo} />
      </Suspense>
      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardView catalogo={catalogo} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
