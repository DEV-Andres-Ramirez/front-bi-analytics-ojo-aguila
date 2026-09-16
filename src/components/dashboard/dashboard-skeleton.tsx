import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const KPIS = 6;
const FILAS_TABLA = 8;

function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[340px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/** Esqueleto con la forma real del tablero: título, breadcrumb, KPIs, gráficas y tabla. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Cargando resultados…</span>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3 w-52" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-56 sm:w-72" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-6 w-24 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: KPIS }, (_, index) => (
          <Card key={index} size="sm">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-7 rounded-lg" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-28 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCardSkeleton className="lg:col-span-3" />
        <ChartCardSkeleton className="lg:col-span-2" />
      </div>

      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-8 w-full sm:w-64" />
          {Array.from({ length: FILAS_TABLA }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
