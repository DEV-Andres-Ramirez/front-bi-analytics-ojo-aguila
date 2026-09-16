"use client";

import { ClockAlertIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { SESSION_EXPIRED_PARAM } from "@/lib/api-client";

const MENSAJE = "Tu sesión expiró. Ingresa nuevamente.";

export function AvisoSesionExpirada() {
  const expirada = useSearchParams().get(SESSION_EXPIRED_PARAM) === "1";

  useEffect(() => {
    if (expirada) toast.warning(MENSAJE, { id: "sesion-expirada" });
  }, [expirada]);

  if (!expirada) return null;

  return (
    <p className="flex items-center gap-2.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-sm font-medium text-gold-foreground animate-in fade-in slide-in-from-top-1 dark:text-gold">
      <ClockAlertIcon aria-hidden="true" className="size-4 shrink-0" />
      {MENSAJE}
    </p>
  );
}
