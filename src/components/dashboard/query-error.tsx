"use client";

import { MapPinOffIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const MENSAJE_GENERICO = "No fue posible obtener la información. Revisa tu conexión e inténtalo de nuevo.";

export function mensajeDeError(error: unknown): string {
  return error instanceof ApiError ? error.message : MENSAJE_GENERICO;
}

/** 404 de la API: no hay datos para lo pedido (p. ej. un lugar sin votos en la elección). No es un fallo. */
export function esSinResultados(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
  reintentando?: boolean;
  titulo?: string;
  /** Título cuando la API responde que no hay datos (404): se muestra como estado vacío, sin reintentar. */
  tituloSinResultados?: string;
  /** Acciones adicionales (junto a "Reintentar" en los errores). */
  children?: ReactNode;
  className?: string;
}

export function QueryError({
  error,
  onRetry,
  reintentando = false,
  titulo = "No pudimos cargar los resultados",
  tituloSinResultados = "Sin resultados para mostrar",
  children,
  className,
}: QueryErrorProps) {
  const sinResultados = esSinResultados(error);

  return (
    <Empty
      role={sinResultados ? "status" : "alert"}
      className={cn(sinResultados ? "border py-12" : "border border-destructive/30 bg-destructive/5 py-12", className)}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className={cn(
            "size-11 rounded-xl",
            sinResultados ? "text-muted-foreground" : "bg-destructive/10 text-destructive",
          )}
        >
          {sinResultados ? <MapPinOffIcon className="size-5" /> : <TriangleAlertIcon className="size-5" />}
        </EmptyMedia>
        <EmptyTitle className="text-base">{sinResultados ? tituloSinResultados : titulo}</EmptyTitle>
        <EmptyDescription>{mensajeDeError(error)}</EmptyDescription>
      </EmptyHeader>
      {(!sinResultados || children) && (
        <EmptyContent className="flex-row flex-wrap justify-center">
          {!sinResultados && (
            <Button onClick={onRetry} disabled={reintentando}>
              <RotateCwIcon className={cn(reintentando && "animate-spin")} aria-hidden />
              {reintentando ? "Reintentando…" : "Reintentar"}
            </Button>
          )}
          {children}
        </EmptyContent>
      )}
    </Empty>
  );
}
