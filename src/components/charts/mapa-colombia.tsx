"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { getRelativePosition } from "chart.js/helpers";
import type { GeoFeature, IChoroplethDataPoint } from "chartjs-chart-geo";
import { MapPinned, Plane, RotateCw } from "lucide-react";
import { Chart } from "react-chartjs-2";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { CODIGO_CONSULADOS, departamentoPorCodigo } from "@/domain/departamentos";
import type { UnidadResultado } from "@/domain/types";
import { ganadoresPorUnidades, type ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { formatCantidad, formatNumero, formatPct, formatPuntos } from "@/lib/format";
import { withAlpha } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { ChartFrame, ChartVacio, Leyenda, LeyendaItem, MuestraColor } from "./chart-frame";
import { MARGEN_RECUADRO_PX, resaltadoGeo } from "./chart-plugins";
import type { MapaColombiaProps } from "./chart-props";
import { registrarGraficas } from "./chart-setup";
import { claveTooltip, coloresTooltip, enumerar } from "./chart-utils";
import {
  AYUDA_SELECCION,
  AYUDA_TECLADO,
  indicePorInterseccion,
  useChartInteraction,
  type BuscarIndice,
} from "./use-chart-interaction";
import { useChartTheme, type ChartTheme } from "./use-chart-theme";
import { useDepartamentosGeo, type GeometriaDepartamento } from "./use-departamentos-geo";

registrarGraficas();

/** Opacidad del departamento con el menor % de ganador; el mayor % se pinta pleno. */
const ALFA_MINIMO = 0.35;
/** Entradas visibles de la leyenda; el resumen accesible del mapa enumera a todos los ganadores. */
const LIMITE_LEYENDA = 6;
const TEXTO_EMPATE = "Empate en el primer lugar";
const PLUGINS = [resaltadoGeo];

interface Participante {
  nombre: string;
  color: string;
}

interface Region {
  geometria: GeometriaDepartamento;
  unidad: UnidadResultado | null;
  primero: Participante | null;
  segundo: Participante | null;
  color: string;
  colorResaltado: string;
}

interface EntradaLeyenda {
  clave: string;
  etiqueta: string;
  color: string;
  departamentos: number;
}

type NombreDe = (id: string) => string;

function participante(id: string, nombreDe: NombreDe, colores: ColoresCompetidores): Participante {
  return { nombre: nombreDe(id), color: colores.competidor(id) };
}

function textoDepartamentos(cantidad: number): string {
  return formatCantidad(cantidad, "departamento", "departamentos");
}

/** Opacidad proporcional al % del ganador dentro del rango observado en el mapa. */
function escalaIntensidad(pcts: number[]) {
  const minimo = Math.min(...pcts);
  const maximo = Math.max(...pcts);
  const rango = maximo - minimo;
  return {
    minimo,
    maximo,
    alfa: (pct: number) => (rango > 0 ? ALFA_MINIMO + (1 - ALFA_MINIMO) * ((pct - minimo) / rango) : 1),
  };
}

/**
 * Una entrada por color: los ganadores sin color propio comparten el neutro de "Otros" y se agrupan.
 * Los empates tienen su propio neutro.
 */
function entradasLeyenda(
  ganadores: { id: string; unidades: number }[],
  empates: number,
  nombreDe: NombreDe,
  colores: ColoresCompetidores,
  tema: ChartTheme,
): EntradaLeyenda[] {
  const porColor = new Map<string, { ids: string[]; departamentos: number }>();
  for (const { id, unidades } of ganadores) {
    const color = colores.competidor(id);
    const grupo = porColor.get(color) ?? { ids: [], departamentos: 0 };
    grupo.ids.push(id);
    grupo.departamentos += unidades;
    porColor.set(color, grupo);
  }

  const entradas = [...porColor].map(
    ([color, { ids, departamentos }]): EntradaLeyenda => ({
      clave: color,
      color,
      departamentos,
      etiqueta: ids.length === 1 ? nombreDe(ids[0]) : `Otros ganadores (${formatNumero(ids.length)})`,
    }),
  );
  if (empates > 0) entradas.push({ clave: "empate", etiqueta: "Empate", color: tema.empate, departamentos: empates });
  return entradas.sort((a, b) => b.departamentos - a.departamentos);
}

function nombreRegion({ unidad, geometria }: Region): string {
  return unidad?.unidad.nombre ?? geometria.departamento.nombre;
}

function describirRegion(region: Region): string {
  const { unidad, primero, segundo } = region;
  const nombre = nombreRegion(region);
  if (!unidad?.ganador || !primero) return `${nombre}: sin resultados`;
  const pct = formatPct(unidad.ganador.pct);
  if (unidad.empate && segundo) return `${nombre}: empate entre ${primero.nombre} y ${segundo.nombre} con ${pct}`;
  return `${nombre}: gana ${primero.nombre} con ${pct}`;
}

function indiceEnMapa(indiceRecuadro: number): BuscarIndice {
  return (chart, evento) => {
    const indice = indicePorInterseccion(chart, evento);
    if (indice !== null || indiceRecuadro < 0) return indice;
    // Las islas miden pocos píxeles: todo el recuadro responde como San Andrés.
    const recuadro = chart.getDatasetMeta(0).data[indiceRecuadro] as unknown as GeoFeature | undefined;
    if (!recuadro) return null;
    const { x, y } = getRelativePosition(evento, chart);
    const { x: izquierda, x2: derecha, y: arriba, y2: abajo } = recuadro.getBounds();
    const dentro =
      x >= izquierda - MARGEN_RECUADRO_PX &&
      x <= derecha + MARGEN_RECUADRO_PX &&
      y >= arriba - MARGEN_RECUADRO_PX &&
      y <= abajo + MARGEN_RECUADRO_PX;
    return dentro ? indiceRecuadro : null;
  };
}

interface LienzoMapaProps {
  geometrias: GeometriaDepartamento[];
  unidades: UnidadResultado[];
  nombreDe: NombreDe;
  colores: ColoresCompetidores;
  etiqueta: string;
  onSelectDepartamento?: (codigo: string) => void;
}

function LienzoMapa({ geometrias, unidades, nombreDe, colores, etiqueta, onSelectDepartamento }: LienzoMapaProps) {
  const tema = useChartTheme();

  const { regiones, intensidad } = useMemo(() => {
    const porCodigo = new Map(unidades.map((u) => [u.unidad.codigo, u]));
    const conUnidad = geometrias.map((geometria) => ({
      geometria,
      unidad: porCodigo.get(geometria.departamento.codigo) ?? null,
    }));
    const escala = escalaIntensidad(
      conUnidad.flatMap(({ unidad }) => (unidad?.ganador && !unidad.empate ? [unidad.ganador.pct] : [])),
    );

    const regiones = conUnidad.map(({ geometria, unidad }): Region => {
      const primero = unidad?.ganador ? participante(unidad.ganador.id, nombreDe, colores) : null;
      const segundo = unidad?.segundo ? participante(unidad.segundo.id, nombreDe, colores) : null;
      const ganador = unidad?.ganador && !unidad.empate ? unidad.ganador : null;
      const colorPleno = ganador && primero ? primero.color : unidad?.empate ? tema.empate : tema.sinDatos;
      return {
        geometria,
        unidad,
        primero,
        segundo,
        color: ganador && primero ? withAlpha(primero.color, escala.alfa(ganador.pct)) : colorPleno,
        colorResaltado: colorPleno,
      };
    });
    return { regiones, intensidad: escala };
  }, [geometrias, unidades, nombreDe, colores, tema]);

  const indiceRecuadro = regiones.findIndex((r) => r.geometria.enRecuadro);

  const datos = useMemo<ChartData<"choropleth", IChoroplethDataPoint[], string>>(
    () => ({
      labels: regiones.map(nombreRegion),
      datasets: [
        {
          label: "Departamentos",
          outline: regiones.map((r) => r.geometria.feature),
          data: regiones.map((r) => ({ feature: r.geometria.feature, value: r.unidad?.ganador?.pct ?? 0 })),
          backgroundColor: regiones.map((r) => r.color),
          hoverBackgroundColor: regiones.map((r) => r.colorResaltado),
          borderColor: tema.superficie,
          hoverBorderColor: tema.superficie,
          borderWidth: 1,
        },
      ],
    }),
    [regiones, tema],
  );

  const opciones = useMemo<ChartOptions<"choropleth">>(
    () => ({
      events: [],
      scales: {
        projection: { axis: "x", projection: "mercator", padding: { top: 12, right: 8, bottom: 20, left: 12 } },
        color: { axis: "x", display: false },
      },
      plugins: {
        resaltadoGeo: {
          colorResaltado: tema.texto,
          colorRecuadro: tema.borde,
          colorEtiqueta: tema.textoSecundario,
          indiceRecuadro,
          etiquetaRecuadro: "San Andrés",
        },
        tooltip: {
          ...coloresTooltip(tema),
          callbacks: {
            title: (items) => {
              const region = regiones[items[0]?.dataIndex ?? -1];
              return region ? nombreRegion(region) : "";
            },
            label: (item) => {
              const { unidad, primero, segundo } = regiones[item.dataIndex] ?? {};
              if (!unidad?.ganador || !primero) return "Sin resultados";
              const lineas = [`${formatPct(unidad.ganador.pct)} · ${primero.nombre}`];
              if (unidad.segundo && segundo) lineas.push(`${formatPct(unidad.segundo.pct)} · ${segundo.nombre}`);
              return lineas;
            },
            labelColor: (item) => claveTooltip(regiones[item.dataIndex]?.colorResaltado ?? tema.sinDatos),
            footer: (items) => {
              const unidad = regiones[items[0]?.dataIndex ?? -1]?.unidad;
              if (!unidad) return "";
              const votos = `${formatNumero(unidad.totalVotos)} votos`;
              if (unidad.empate) return `${TEXTO_EMPATE} · ${votos}`;
              return unidad.margenPct === null ? votos : `Margen ${formatPuntos(unidad.margenPct)} · ${votos}`;
            },
          },
        },
      },
    }),
    [regiones, indiceRecuadro, tema],
  );

  const { chartRef, propsMarco } = useChartInteraction<"choropleth", IChoroplethDataPoint[], string>({
    total: regiones.length,
    datos,
    indiceEnEvento: indiceEnMapa(indiceRecuadro),
    describir: (indice) => (regiones[indice] ? describirRegion(regiones[indice]) : ""),
    esSeleccionable: (indice) => Boolean(regiones[indice]?.unidad),
    onSeleccionar: onSelectDepartamento
      ? (indice) => {
          const unidad = regiones[indice]?.unidad;
          if (unidad) onSelectDepartamento(unidad.unidad.codigo);
        }
      : undefined,
  });

  return (
    <div className="flex size-full min-h-0 flex-col gap-2">
      <ChartFrame etiqueta={etiqueta} className="flex-1" {...propsMarco}>
        <Chart type="choropleth" ref={chartRef} data={datos} options={opciones} plugins={PLUGINS} aria-hidden />
      </ChartFrame>
      {intensidad.maximo > intensidad.minimo && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
          <span>
            % del ganador<span className="sr-only"> (más intenso significa mayor porcentaje)</span>:
          </span>
          <span>{formatPct(intensidad.minimo)}</span>
          <span
            aria-hidden
            className="h-1.5 w-20 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${withAlpha(tema.texto, ALFA_MINIMO)}, ${tema.texto})` }}
          />
          <span>{formatPct(intensidad.maximo)}</span>
        </div>
      )}
    </div>
  );
}

function EstadoErrorMapa({ onReintentar }: { onReintentar: () => void }) {
  return (
    <Empty className="size-full min-h-56 gap-3 p-4">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="text-muted-foreground">
          <MapPinned aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No fue posible cargar el mapa</EmptyTitle>
        <EmptyDescription className="text-xs">Revise su conexión e intente de nuevo.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onReintentar}>
          <RotateCw aria-hidden />
          Reintentar
        </Button>
      </EmptyContent>
    </Empty>
  );
}

interface ChipConsuladosProps {
  unidad: UnidadResultado;
  /** Ganador, o el neutro de empate cuando lo hay; null sin resultados. */
  resultado: Participante | null;
  onSelect?: (codigo: string) => void;
}

function ChipConsulados({ unidad, resultado, onSelect }: ChipConsuladosProps) {
  const contenido = (
    <>
      <Plane aria-hidden className="size-3.5 text-muted-foreground" />
      <span className="font-medium whitespace-nowrap text-foreground">Consulados (exterior)</span>
      {resultado && unidad.ganador ? (
        <>
          <MuestraColor color={resultado.color} />
          <span className="truncate">{resultado.nombre}</span>
          <span className="font-medium text-foreground tabular-nums">{formatPct(unidad.ganador.pct)}</span>
        </>
      ) : (
        <span>Sin resultados</span>
      )}
    </>
  );
  const clases = cn(
    "inline-flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-full border bg-background px-3 py-1",
    "text-xs text-muted-foreground",
  );

  if (!onSelect) return <div className={clases}>{contenido}</div>;
  const resumen = !resultado ? "" : unidad.empate ? ": empate en el primer lugar" : `: gana ${resultado.nombre}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(unidad.unidad.codigo)}
      className={cn(
        clases,
        "transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
      aria-label={`Ver resultados de Consulados (exterior)${resumen}`}
    >
      {contenido}
    </button>
  );
}

export function MapaColombia({ unidades, competidores, colores, onSelectDepartamento }: MapaColombiaProps) {
  const tema = useChartTheme();
  const geo = useDepartamentosGeo();

  const nombreDe = useMemo<NombreDe>(() => {
    const porId = new Map(competidores.map((c) => [c.id, c.nombre]));
    return (id) => porId.get(id) ?? "Otro competidor";
  }, [competidores]);

  const { ganadores, empates, leyenda } = useMemo(() => {
    const departamentos = unidades.filter((u) => departamentoPorCodigo(u.unidad.codigo));
    const ganadores = ganadoresPorUnidades(departamentos);
    const empates = departamentos.filter((u) => u.empate).length;
    return { ganadores, empates, leyenda: entradasLeyenda(ganadores, empates, nombreDe, colores, tema) };
  }, [unidades, nombreDe, colores, tema]);

  const consulados = unidades.find((u) => u.unidad.codigo === CODIGO_CONSULADOS) ?? null;
  const resultadoConsulados = !consulados?.ganador
    ? null
    : consulados.empate
      ? { nombre: "Empate", color: tema.empate }
      : participante(consulados.ganador.id, nombreDe, colores);

  if (unidades.length === 0) {
    return <ChartVacio icono={MapPinned} descripcion="No hay resultados por departamento para esta elección." />;
  }

  const etiqueta = [
    "Mapa de Colombia por departamento, coloreado según el ganador y con mayor intensidad donde obtuvo mayor porcentaje.",
    ganadores.length > 0
      ? `${enumerar(ganadores.map((g) => `${nombreDe(g.id)} gana en ${textoDepartamentos(g.unidades)}`))}.`
      : "",
    empates > 0 ? `${TEXTO_EMPATE} en ${textoDepartamentos(empates)}.` : "",
    onSelectDepartamento ? AYUDA_SELECCION : AYUDA_TECLADO,
  ]
    .filter(Boolean)
    .join(" ");

  const leyendaVisible = leyenda.length > LIMITE_LEYENDA ? leyenda.slice(0, LIMITE_LEYENDA - 1) : leyenda;
  const entradasOcultas = leyenda.length - leyendaVisible.length;

  return (
    <div className="flex size-full min-h-0 flex-col gap-3">
      <div className="min-h-56 flex-1">
        {geo.estado === "listo" && (
          <LienzoMapa
            geometrias={geo.departamentos}
            unidades={unidades}
            nombreDe={nombreDe}
            colores={colores}
            etiqueta={etiqueta}
            onSelectDepartamento={onSelectDepartamento}
          />
        )}
        {geo.estado === "cargando" && (
          <Skeleton role="status" aria-label="Cargando el mapa" className="size-full min-h-56 rounded-xl" />
        )}
        {geo.estado === "error" && <EstadoErrorMapa onReintentar={geo.reintentar} />}
      </div>

      {(leyenda.length > 0 || consulados) && (
        <div className="flex flex-col gap-2.5">
          {leyenda.length > 0 && (
            <Leyenda aria-label="Departamentos ganados por competidor" className="gap-x-5">
              {leyendaVisible.map((entrada) => (
                <LeyendaItem
                  key={entrada.clave}
                  color={entrada.color}
                  etiqueta={entrada.etiqueta}
                  valor={textoDepartamentos(entrada.departamentos)}
                  className="max-w-full"
                />
              ))}
              {entradasOcultas > 0 && <li>y {formatNumero(entradasOcultas)} más</li>}
            </Leyenda>
          )}
          {consulados && (
            <ChipConsulados unidad={consulados} resultado={resultadoConsulados} onSelect={onSelectDepartamento} />
          )}
        </div>
      )}
    </div>
  );
}
