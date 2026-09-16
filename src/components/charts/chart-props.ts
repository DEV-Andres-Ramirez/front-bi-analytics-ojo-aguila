import type {
  Competidor,
  DetalleCompetidorResponse,
  Kpis,
  UnidadResultado,
  VotoListaPartido,
} from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";

/** Barras horizontales: ranking de competidores del ámbito. */
export interface RankingChartProps {
  competidores: Competidor[];
  colores: ColoresCompetidores;
  /** Barras visibles; el resto se agrupa en "Otros". Por defecto 10. */
  limite?: number;
  onSelect?: (competidorId: string) => void;
}

/** Dona: composición del voto (top competidores, otros, blanco, nulos, no marcados). */
export interface ComposicionChartProps {
  kpis: Kpis;
  competidores: Competidor[];
  colores: ColoresCompetidores;
}

/** Barras 100% apiladas: participación del top-N en cada unidad hija. */
export interface DistribucionChartProps {
  unidades: UnidadResultado[];
  topIds: string[];
  /** Lista completa del ámbito para resolver nombres. */
  competidores: Competidor[];
  colores: ColoresCompetidores;
  /** Unidades visibles (las de más votos). Por defecto 15. */
  limiteUnidades?: number;
  onSelectUnidad?: (codigo: string) => void;
}

/** Mapa coroplético de departamentos coloreado por ganador (solo ámbito nacional). */
export interface MapaColombiaProps {
  /** Unidades hijas del ámbito nacional (departamentos). */
  unidades: UnidadResultado[];
  competidores: Competidor[];
  colores: ColoresCompetidores;
  onSelectDepartamento?: (codigo: string) => void;
}

/** Barras apiladas: voto solo por lista vs voto preferente por partido (Congreso). */
export interface VotoListaChartProps {
  partidos: VotoListaPartido[];
  colores: ColoresCompetidores;
  /** Partidos visibles (los de más votos). Por defecto 10. */
  limite?: number;
}

/** Barras: desempeño de un competidor en las unidades hijas del ámbito. */
export interface DesempenoCompetidorChartProps {
  competidor: Competidor;
  /** Color del competidor en la respuesta del ámbito (ver `useColoresCompetidores`). */
  color: string;
  unidades: DetalleCompetidorResponse["unidades"];
  /** Métrica a graficar. Por defecto "votos". */
  metrica?: "votos" | "pct";
  /** Unidades visibles. Por defecto 15. */
  limite?: number;
  onSelectUnidad?: (codigo: string) => void;
}
