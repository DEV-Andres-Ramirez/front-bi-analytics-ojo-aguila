"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Catalogo } from "@/domain/types";
import { cn } from "@/lib/utils";
import { FiltrosEleccion } from "./filtros-eleccion";
import { pasosCompletados, resumenSeleccion, TOTAL_PASOS } from "./seleccion-eleccion";
import { useSeleccionEleccion } from "./use-seleccion-eleccion";

interface FiltrosSheetProps {
  catalogo: Catalogo;
  className?: string;
}

/** Filtros en pantallas pequeñas: botón con resumen de la selección que abre un panel superior. */
export function FiltrosSheet({ catalogo, className }: FiltrosSheetProps) {
  const { seleccion } = useSeleccionEleccion(catalogo);
  const completados = pasosCompletados(seleccion);
  const resumen = resumenSeleccion(seleccion);
  const completa = completados === TOTAL_PASOS;
  const progreso = `${completados} de ${TOTAL_PASOS} pasos`;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          aria-label={resumen ? `Filtros: ${resumen}${completa ? "" : `, ${progreso}`}` : `Filtros, ${progreso}`}
          className={cn("max-w-28 sm:max-w-56", className)}
        >
          <SlidersHorizontalIcon aria-hidden />
          <span className="min-w-0 truncate">{resumen ?? "Filtros"}</span>
          {!completa && (
            <Badge className="h-4 bg-gold/20 px-1.5 text-[0.65rem] text-gold-foreground tabular-nums dark:text-gold">
              {completados}/{TOTAL_PASOS}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="top" className="max-h-[90dvh] gap-0 overflow-y-auto rounded-b-2xl">
        <div aria-hidden className="h-[3px] shrink-0 bg-tricolor" />
        <div className="mx-auto flex w-full max-w-lg flex-col">
          <SheetHeader>
            <SheetTitle>Filtros de elección</SheetTitle>
            <SheetDescription>Completa los tres pasos en orden para consultar los resultados.</SheetDescription>
          </SheetHeader>
          <FiltrosEleccion catalogo={catalogo} orientation="vertical" className="px-4 py-2" />
          <SheetFooter>
            <SheetClose asChild>
              <Button size="lg" disabled={!completa}>
                Ver resultados
              </Button>
            </SheetClose>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
