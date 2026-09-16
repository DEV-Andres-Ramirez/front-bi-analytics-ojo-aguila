"use client";

import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useTransition } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function DashboardError({ error, retry }: DashboardErrorProps) {
  const [reintentando, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative isolate flex flex-1 items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="bg-grid-pattern absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]"
      />
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <BrandLogo size={40} />
        <Card role="alert" className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div aria-hidden className="bg-tricolor -mt-(--card-spacing) h-1 w-full" />
          <CardHeader className="items-center pt-2 text-center">
            <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <TriangleAlertIcon aria-hidden className="size-6" />
            </span>
            <CardTitle className="text-lg">
              <h1>No pudimos cargar el tablero</h1>
            </CardTitle>
            <CardDescription className="text-balance">
              Ocurrió un problema al consultar los resultados electorales. Intenta de nuevo en unos segundos.
            </CardDescription>
          </CardHeader>
          {error.digest && (
            <CardContent className="text-center">
              <p className="text-xs text-muted-foreground">
                Código de referencia: <code className="font-mono text-foreground">{error.digest}</code>
              </p>
            </CardContent>
          )}
          <CardFooter className="justify-center">
            <Button onClick={() => startTransition(retry)} disabled={reintentando}>
              <RotateCwIcon aria-hidden className={reintentando ? "animate-spin" : undefined} />
              {reintentando ? "Reintentando…" : "Reintentar"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
