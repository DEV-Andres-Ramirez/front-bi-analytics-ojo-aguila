"use client";

import { UsersIcon } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Competidor, ResultadosResponse } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { formatCantidad, formatNumero, formatPct } from "@/lib/format";
import { CardHeading } from "./card-heading";
import { BarraProporcion, CompetidorDot } from "./competidor-color";
import { ETIQUETA_DIMENSION } from "./etiquetas";
import { EmptySearchRow, filaInteractiva, TablePagination, TableSearch } from "./table-controls";
import { useTablaLocal } from "./use-tabla-local";

const COLUMNAS_TOTAL = 4;

const textoBusqueda = (competidor: Competidor) => `${competidor.nombre} ${competidor.detalle}`;

interface CompetidoresTableProps {
  response: ResultadosResponse;
  colores: ColoresCompetidores;
  onSelect: (competidorId: string) => void;
}

export function CompetidoresTable({ response, colores, onSelect }: CompetidoresTableProps) {
  const { competidores, dimension, ambito } = response;
  const etiqueta = ETIQUETA_DIMENSION[dimension];
  const posiciones = useMemo(() => new Map(competidores.map((c, index) => [c.id, index + 1])), [competidores]);
  const tabla = useTablaLocal(competidores, { textoBusqueda });
  // Las barras se escalan contra el líder para que las diferencias se vean aun con muchos competidores.
  const pctMaximo = competidores[0]?.pctValidos || 1;

  return (
    <Card role="region" aria-labelledby="tabla-competidores-titulo">
      <CardHeader>
        <CardHeading id="tabla-competidores-titulo" icono={UsersIcon}>
          Todos los {etiqueta.plural}
        </CardHeading>
        <CardDescription>
          {response.totalCompetidores > competidores.length
            ? `Mostrando ${formatCantidad(competidores.length, etiqueta.singular, etiqueta.plural)} de ${formatNumero(response.totalCompetidores)} con votos en ${ambito.unidad.nombre}.`
            : `${formatCantidad(competidores.length, etiqueta.singular, etiqueta.plural)} con votos en ${ambito.unidad.nombre}.`}{" "}
          Selecciona uno para ver dónde es más fuerte.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableSearch
          value={tabla.busqueda}
          onChange={tabla.setBusqueda}
          placeholder={`Buscar ${etiqueta.singular}…`}
          label={`Buscar en ${etiqueta.plural}`}
        />
        <div className="rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-right text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">{etiqueta.titulo}</TableHead>
                <TableHead className="text-right text-muted-foreground">Votos</TableHead>
                <TableHead className="text-right text-muted-foreground">% válidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tabla.visibles.length === 0 ? (
                <EmptySearchRow
                  colSpan={COLUMNAS_TOTAL}
                  busqueda={tabla.busqueda}
                  onLimpiar={() => tabla.setBusqueda("")}
                />
              ) : (
                tabla.visibles.map((competidor) => (
                  <TableRow key={competidor.id} {...filaInteractiva(() => onSelect(competidor.id))}>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {posiciones.get(competidor.id)}
                    </TableCell>
                    <TableCell>
                      <span className="flex max-w-[28rem] min-w-0 items-center gap-2.5">
                        <CompetidorDot color={colores.competidor(competidor.id)} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium" title={competidor.nombre}>
                            {competidor.nombre}
                          </span>
                          {competidor.detalle && (
                            <span className="truncate text-xs text-muted-foreground" title={competidor.detalle}>
                              {competidor.detalle}
                            </span>
                          )}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumero(competidor.votos)}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <BarraProporcion
                          ratio={competidor.pctValidos / pctMaximo}
                          color={colores.competidor(competidor.id)}
                          className="hidden w-24 sm:block"
                        />
                        <span className="w-14 tabular-nums">{formatPct(competidor.pctValidos)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination {...tabla.paginacion} onPaginaChange={tabla.setPagina} />
      </CardContent>
    </Card>
  );
}
