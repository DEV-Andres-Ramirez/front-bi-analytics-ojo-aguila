"use client";

import {
  ArrowDownWideNarrowIcon,
  ArrowUpDownIcon,
  ArrowUpNarrowWideIcon,
  DownloadIcon,
  InfoIcon,
  MapPinnedIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getNivel } from "@/domain/niveles";
import type { CompetidorEnUnidad, ResultadosResponse, UnidadResultado } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { usePrefetchResultados } from "@/hooks/use-queries";
import { descargarCsv, generarCsv, nombreArchivoCsv, porcentajeCsv, type ColumnaCsv } from "@/lib/csv";
import { formatCantidad, formatNumero, formatPct, formatPuntos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardHeading } from "./card-heading";
import { BarraProporcion, COLOR_EMPATE, CompetidorDot } from "./competidor-color";
import { etiquetaEleccion, etiquetasNivel } from "./etiquetas";
import { EmptySearchRow, filaInteractiva, TablePagination, TableSearch } from "./table-controls";
import { useTablaLocal } from "./use-tabla-local";

type ColumnaOrden = "unidad" | "votos" | "ganador" | "margen" | "blanco";
type Direccion = "asc" | "desc";

const VALOR_ORDEN: Record<ColumnaOrden, (fila: UnidadResultado) => number | string | null> = {
  unidad: (fila) => fila.unidad.nombre,
  votos: (fila) => fila.totalVotos,
  ganador: (fila) => fila.ganador?.pct ?? null,
  margen: (fila) => fila.margenPct,
  blanco: (fila) => fila.pctBlanco,
};

const COLUMNAS_TOTAL = 7;
/** Pausa sobre una fila (cursor o foco) antes de precargar su ámbito: recorrer la tabla no descarga nada. */
const RETRASO_PRECARGA_MS = 300;
const colator = new Intl.Collator("es-CO", { sensitivity: "base", numeric: true });

const textoBusqueda = (fila: UnidadResultado) => `${fila.unidad.nombre} ${fila.unidad.codigo}`;

function ordenar(filas: readonly UnidadResultado[], columna: ColumnaOrden, direccion: Direccion) {
  const valor = VALOR_ORDEN[columna];
  const signo = direccion === "asc" ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    const comparacion = typeof va === "string" ? colator.compare(va, String(vb)) : va - Number(vb);
    return comparacion * signo;
  });
}

type NombreDe = (id: string) => string;

/** Empate: "A y B" (ganador y segundo tienen los mismos votos). */
function nombresEmpate(fila: UnidadResultado, nombreDe: NombreDe): string | null {
  return fila.empate && fila.ganador && fila.segundo
    ? `${nombreDe(fila.ganador.id)} y ${nombreDe(fila.segundo.id)}`
    : null;
}

function columnasCsv(nombreDe: NombreDe): ColumnaCsv<UnidadResultado>[] {
  const nombreEn = (fila: UnidadResultado, clave: "ganador" | "segundo") => {
    const resumen = fila[clave];
    if (!resumen) return null;
    const empate = clave === "ganador" ? nombresEmpate(fila, nombreDe) : null;
    return empate ? `Empate: ${empate}` : nombreDe(resumen.id);
  };
  const competidor = (clave: "ganador" | "segundo"): ColumnaCsv<UnidadResultado>[] => {
    const titulo = clave === "ganador" ? "Ganador" : "Segundo";
    return [
      { encabezado: titulo, valor: (fila) => nombreEn(fila, clave) },
      { encabezado: `Votos ${titulo.toLowerCase()}`, valor: (fila) => fila[clave]?.votos },
      { encabezado: `% ${titulo.toLowerCase()}`, valor: (fila) => porcentajeCsv(fila[clave]?.pct) },
    ];
  };
  return [
    { encabezado: "Código", valor: (fila) => fila.unidad.codigo },
    { encabezado: "Unidad", valor: (fila) => fila.unidad.nombre },
    { encabezado: "Votos totales", valor: (fila) => fila.totalVotos },
    { encabezado: "Votos válidos", valor: (fila) => fila.votosValidos },
    ...competidor("ganador"),
    ...competidor("segundo"),
    { encabezado: "Margen (pp)", valor: (fila) => porcentajeCsv(fila.margenPct) },
    { encabezado: "Votos en blanco", valor: (fila) => fila.votosBlanco },
    { encabezado: "% blanco", valor: (fila) => porcentajeCsv(fila.pctBlanco) },
  ];
}

interface SortableHeadProps {
  columna: ColumnaOrden;
  orden: { columna: ColumnaOrden; direccion: Direccion };
  onOrdenar: (columna: ColumnaOrden) => void;
  alineacion?: "left" | "right";
  children: string;
}

function SortableHead({ columna, orden, onOrdenar, alineacion = "right", children }: SortableHeadProps) {
  const activa = orden.columna === columna;
  const Icono = !activa ? ArrowUpDownIcon : orden.direccion === "asc" ? ArrowUpNarrowWideIcon : ArrowDownWideNarrowIcon;

  return (
    <TableHead
      aria-sort={activa ? (orden.direccion === "asc" ? "ascending" : "descending") : "none"}
      className={cn(alineacion === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          activa ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <Icono aria-hidden className={cn("size-3.5", !activa && "opacity-50")} />
      </button>
    </TableHead>
  );
}

interface CompetidorCeldaProps {
  resumen: CompetidorEnUnidad | null;
  nombreDe: NombreDe;
  colores: ColoresCompetidores;
}

function CompetidorCelda({ resumen, nombreDe, colores }: CompetidorCeldaProps) {
  if (!resumen) return <span className="text-muted-foreground">—</span>;
  const nombre = nombreDe(resumen.id);
  return (
    <span className="flex max-w-56 min-w-0 items-center gap-2">
      <CompetidorDot color={colores.competidor(resumen.id)} />
      <span className="truncate" title={nombre}>
        {nombre}
      </span>
    </span>
  );
}

function EmpateCelda({ nombres }: { nombres: string }) {
  return (
    <span className="flex max-w-56 min-w-0 items-center gap-2" title={`Empate entre ${nombres}`}>
      <CompetidorDot color={COLOR_EMPATE} />
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">Empate</span>
        <span className="truncate text-xs text-muted-foreground">{nombres}</span>
      </span>
    </span>
  );
}

interface FilaTerritorialProps {
  fila: UnidadResultado;
  nombreDe: NombreDe;
  colores: ColoresCompetidores;
  onNavegar: (codigo: string) => void;
  onPrecargar: (codigo: string) => void;
}

function FilaTerritorial({ fila, nombreDe, colores, onNavegar, onPrecargar }: FilaTerritorialProps) {
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  const interaccion = filaInteractiva(() => onNavegar(fila.unidad.codigo));
  const empate = nombresEmpate(fila, nombreDe);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const programarPrecarga = () => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => onPrecargar(fila.unidad.codigo), RETRASO_PRECARGA_MS);
  };
  const cancelarPrecarga = () => clearTimeout(temporizador.current);

  return (
    <TableRow
      {...interaccion}
      onMouseEnter={programarPrecarga}
      onMouseLeave={cancelarPrecarga}
      onFocus={programarPrecarga}
      onBlur={cancelarPrecarga}
    >
      <TableCell>
        <span className="flex max-w-64 flex-col">
          <span className="truncate font-medium" title={fila.unidad.nombre}>
            {fila.unidad.nombre}
          </span>
          <span className="font-mono text-[0.7rem] text-muted-foreground">{fila.unidad.codigo}</span>
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumero(fila.totalVotos)}</TableCell>
      <TableCell>
        {empate ? (
          <EmpateCelda nombres={empate} />
        ) : (
          <CompetidorCelda resumen={fila.ganador} nombreDe={nombreDe} colores={colores} />
        )}
      </TableCell>
      <TableCell className="text-right">
        {fila.ganador ? (
          <span className="inline-flex items-center justify-end gap-2">
            <BarraProporcion
              ratio={fila.ganador.pct}
              color={empate ? COLOR_EMPATE : colores.competidor(fila.ganador.id)}
              className="hidden sm:block"
            />
            <span className="w-14 tabular-nums">{formatPct(fila.ganador.pct)}</span>
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <CompetidorCelda resumen={empate ? null : fila.segundo} nombreDe={nombreDe} colores={colores} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {fila.margenPct === null ? "—" : formatPuntos(fila.margenPct)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatPct(fila.pctBlanco)}</TableCell>
    </TableRow>
  );
}

function HojaInformativa({ esPuesto }: { esPuesto: boolean }) {
  return (
    <Card role="note" className="border border-dashed bg-muted/30 ring-0">
      <CardContent className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold/15">
          <InfoIcon aria-hidden className="size-4" />
        </span>
        <p className="text-sm text-muted-foreground">
          {esPuesto
            ? "Llegaste al máximo nivel de detalle disponible (puesto de votación). El detalle por mesa se habilitará cuando la fuente incluya el número de mesa."
            : "Este ámbito no tiene subdivisiones con votos registrados."}
        </p>
      </CardContent>
    </Card>
  );
}

interface TerritorialTableProps {
  response: ResultadosResponse;
  colores: ColoresCompetidores;
  onNavegar: (codigo: string) => void;
}

export function TerritorialTable({ response, colores, onNavegar }: TerritorialTableProps) {
  const { ambito, competidores, dimension, eleccion, hijos } = response;
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: Direccion }>({
    columna: "votos",
    direccion: "desc",
  });
  const prefetch = usePrefetchResultados();

  const nombreDe = useMemo<NombreDe>(() => {
    const nombres = new Map(competidores.map((c) => [c.id, c.nombre]));
    return (id) => nombres.get(id) ?? id;
  }, [competidores]);
  const ordenadas = useMemo(() => ordenar(hijos, orden.columna, orden.direccion), [hijos, orden]);
  const tabla = useTablaLocal(ordenadas, { textoBusqueda });

  if (!ambito.nivelHijos || hijos.length === 0) {
    return <HojaInformativa esPuesto={ambito.unidad.nivel === "puesto"} />;
  }

  const nivel = etiquetasNivel(ambito.nivelHijos);

  const ordenarPor = (columna: ColumnaOrden) => {
    setOrden((actual) =>
      actual.columna === columna
        ? { columna, direccion: actual.direccion === "asc" ? "desc" : "asc" }
        : { columna, direccion: columna === "unidad" ? "asc" : "desc" },
    );
    tabla.setPagina(0);
  };

  const exportar = () => {
    const contenido = generarCsv(tabla.filtradas, columnasCsv(nombreDe));
    descargarCsv(
      nombreArchivoCsv([etiquetaEleccion(eleccion), ambito.unidad.nombre, nivel.plural, dimension]),
      contenido,
    );
  };

  return (
    <Card role="region" aria-labelledby="tabla-territorial-titulo">
      <CardHeader>
        <CardHeading id="tabla-territorial-titulo" icono={MapPinnedIcon}>
          Resultados por {nivel.plural}
        </CardHeading>
        <CardDescription>
          {formatCantidad(hijos.length, nivel.singular, nivel.plural)} en {ambito.unidad.nombre}. Selecciona una fila
          para profundizar.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={exportar} disabled={tabla.filtradas.length === 0}>
            <DownloadIcon aria-hidden />
            <span className="sr-only sm:not-sr-only">Exportar</span> CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableSearch
          value={tabla.busqueda}
          onChange={tabla.setBusqueda}
          placeholder={`Buscar ${nivel.singular}…`}
          label={`Buscar en ${nivel.plural}`}
        />
        <div className="rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <SortableHead columna="unidad" orden={orden} onOrdenar={ordenarPor} alineacion="left">
                  {getNivel(ambito.nivelHijos).etiqueta}
                </SortableHead>
                <SortableHead columna="votos" orden={orden} onOrdenar={ordenarPor}>
                  Votos
                </SortableHead>
                <TableHead className="text-muted-foreground">Ganador</TableHead>
                <SortableHead columna="ganador" orden={orden} onOrdenar={ordenarPor}>
                  % ganador
                </SortableHead>
                <TableHead className="text-muted-foreground">Segundo</TableHead>
                <SortableHead columna="margen" orden={orden} onOrdenar={ordenarPor}>
                  Margen
                </SortableHead>
                <SortableHead columna="blanco" orden={orden} onOrdenar={ordenarPor}>
                  % blanco
                </SortableHead>
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
                tabla.visibles.map((fila) => (
                  <FilaTerritorial
                    key={fila.unidad.codigo}
                    fila={fila}
                    nombreDe={nombreDe}
                    colores={colores}
                    onNavegar={onNavegar}
                    onPrecargar={(codigo) => void prefetch(eleccion, codigo, dimension)}
                  />
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
