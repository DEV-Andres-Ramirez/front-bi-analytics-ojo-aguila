"use client";

import {
  BanIcon,
  CircleCheckBigIcon,
  CircleDashedIcon,
  SquareIcon,
  TrophyIcon,
  VoteIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Competidor, Kpis } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { useCountUp } from "@/hooks/use-count-up";
import { formatNumero, formatPct, formatPuntos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CompetidorDot } from "./competidor-color";

const RETRASO_ENTRADA_MS = 60;

interface KpiCardProps {
  icono: LucideIcon;
  etiqueta: string;
  valor: ReactNode;
  secundario: ReactNode;
  indice: number;
  destacado?: boolean;
}

function KpiCard({ icono: Icono, etiqueta, valor, secundario, indice, destacado = false }: KpiCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "relative animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
        destacado && "ring-gold/40",
      )}
      style={{ animationDelay: `${indice * RETRASO_ENTRADA_MS}ms` }}
    >
      {destacado && <div aria-hidden className="bg-tricolor absolute inset-x-0 top-0 h-0.5" />}
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted",
              destacado && "bg-gold/15 text-foreground",
            )}
          >
            <Icono aria-hidden className="size-3.5" />
          </span>
          <p className="truncate text-xs font-medium">{etiqueta}</p>
        </div>
        <div className="min-w-0 font-heading text-lg leading-tight font-semibold tracking-tight sm:text-xl 2xl:text-2xl">
          {valor}
        </div>
        <p className="mt-auto text-xs text-muted-foreground">{secundario}</p>
      </CardContent>
    </Card>
  );
}

function ValorAnimado({ valor }: { valor: number }) {
  const animado = useCountUp(valor);
  return (
    <span className="block truncate tabular-nums">
      <span aria-hidden>{formatNumero(animado)}</span>
      <span className="sr-only">{formatNumero(valor)}</span>
    </span>
  );
}

function Proporcion({ ratio, base }: { ratio: number; base: string }) {
  return (
    <>
      <span className="font-medium text-foreground tabular-nums">{formatPct(ratio)}</span> {base}
    </>
  );
}

function LiderValor({ lider, colores }: { lider: Competidor | undefined; colores: ColoresCompetidores }) {
  if (!lider) return <span className="text-muted-foreground">Sin datos</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CompetidorDot color={colores.competidor(lider.id)} className="size-3" />
      <span className="truncate text-base sm:text-lg" title={lider.nombre}>
        {lider.nombre}
      </span>
    </span>
  );
}

function LiderSecundario({ lider, segundo }: { lider: Competidor | undefined; segundo: Competidor | undefined }) {
  if (!lider) return "—";
  return (
    <span className="flex flex-col gap-0.5">
      <span>
        <Proporcion ratio={lider.pctValidos} base="de válidos" />
      </span>
      {segundo && (
        <span className="truncate" title={`Sobre ${segundo.nombre}`}>
          <span className="font-medium text-foreground tabular-nums">
            +{formatPuntos(lider.pctValidos - segundo.pctValidos)}
          </span>{" "}
          sobre {segundo.nombre}
        </span>
      )}
    </span>
  );
}

interface KpiGridProps {
  kpis: Kpis;
  competidores: Competidor[];
  colores: ColoresCompetidores;
}

export function KpiGrid({ kpis, competidores, colores }: KpiGridProps) {
  const [lider, segundo] = competidores;
  const pctValidos = kpis.totalVotos > 0 ? kpis.votosValidos / kpis.totalVotos : 0;

  return (
    <section aria-label="Indicadores principales" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        indice={0}
        icono={VoteIcon}
        etiqueta="Votos totales"
        valor={<ValorAnimado valor={kpis.totalVotos} />}
        secundario="Incluye nulos y no marcados"
      />
      <KpiCard
        indice={1}
        icono={CircleCheckBigIcon}
        etiqueta="Votos válidos"
        valor={<ValorAnimado valor={kpis.votosValidos} />}
        secundario={<Proporcion ratio={pctValidos} base="del total" />}
      />
      <KpiCard
        indice={2}
        icono={SquareIcon}
        etiqueta="Votos en blanco"
        valor={<ValorAnimado valor={kpis.votosBlanco} />}
        secundario={<Proporcion ratio={kpis.pctBlanco} base="de válidos" />}
      />
      <KpiCard
        indice={3}
        icono={BanIcon}
        etiqueta="Votos nulos"
        valor={<ValorAnimado valor={kpis.votosNulos} />}
        secundario={<Proporcion ratio={kpis.pctNulos} base="del total" />}
      />
      <KpiCard
        indice={4}
        icono={CircleDashedIcon}
        etiqueta="No marcados"
        valor={<ValorAnimado valor={kpis.votosNoMarcados} />}
        secundario={<Proporcion ratio={kpis.pctNoMarcados} base="del total" />}
      />
      <KpiCard
        indice={5}
        destacado
        icono={TrophyIcon}
        etiqueta="Líder"
        valor={<LiderValor lider={lider} colores={colores} />}
        secundario={<LiderSecundario lider={lider} segundo={segundo} />}
      />
    </section>
  );
}
