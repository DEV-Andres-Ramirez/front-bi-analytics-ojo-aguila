"use client";

import { FlagIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getNivel } from "@/domain/niveles";
import { formatEtiquetaCatalogo } from "@/lib/format";
import type { Dimension, EleccionRef, UnidadGeografica } from "@/domain/types";
import { admiteDimensionCandidato, admiteDimensionPartido, circunscripcionDe } from "@/domain/votos";
import { etiquetaEleccion } from "./etiquetas";

interface ElectionTitleProps {
  eleccion: EleccionRef;
  unidad: UnidadGeografica;
  /** Dimensión solicitada en la URL (se refleja al instante aunque los datos sigan cargando). */
  dimension: Dimension;
  onDimensionChange: (dimension: Dimension) => void;
}

export function ElectionTitle({ eleccion, unidad, dimension, onDimensionChange }: ElectionTitleProps) {
  const hayCandidatos = admiteDimensionCandidato(eleccion, unidad.codigo);
  const circunscripcion = circunscripcionDe(eleccion);
  const etiquetaCircunscripcion = formatEtiquetaCatalogo(eleccion.corporacion);

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {etiquetaEleccion(eleccion)}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl">
            {unidad.nombre}
          </h1>
          <Badge variant="outline" className="border-gold/50 bg-gold/10 text-foreground">
            {getNivel(unidad.nivel).etiqueta}
          </Badge>
        </div>
      </div>

      {admiteDimensionPartido(eleccion) && (
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={dimension}
          onValueChange={(valor) => {
            if (valor === "partido" || valor === "candidato") onDimensionChange(valor);
          }}
          aria-label="Agrupar resultados por"
        >
          <ToggleGroupItem value="partido" className="px-3 data-[state=on]:bg-gold/15">
            <FlagIcon aria-hidden />
            Partidos
          </ToggleGroupItem>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* El span mantiene el tooltip accesible cuando el botón está deshabilitado. */}
              <span>
                <ToggleGroupItem
                  value="candidato"
                  disabled={!hayCandidatos}
                  className="px-3 data-[state=on]:bg-gold/15"
                >
                  <UsersIcon aria-hidden />
                  Candidatos
                </ToggleGroupItem>
              </span>
            </TooltipTrigger>
            {!hayCandidatos && (
              <TooltipContent>
                Los candidatos de {etiquetaCircunscripcion} solo se comparan dentro de{" "}
                {circunscripcion === "departamento" ? "un departamento" : "un municipio"}: entra a uno para verlos.
              </TooltipContent>
            )}
          </Tooltip>
        </ToggleGroup>
      )}
    </div>
  );
}
