import { ChartPieIcon, LandmarkIcon, MapPinnedIcon, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { CintaTricolor } from "./cinta-tricolor";

interface PropuestaDeValor {
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  retraso: string;
}

const PROPUESTAS: PropuestaDeValor[] = [
  {
    icono: LandmarkIcon,
    titulo: "Resultados históricos de Presidencia y Congreso",
    detalle: "Congreso desde 2014 y Presidencia desde 2018.",
    retraso: "delay-300",
  },
  {
    icono: MapPinnedIcon,
    titulo: "Del nivel nacional al puesto de votación",
    detalle: "Departamento, municipio, zona y puesto en pocos clics.",
    retraso: "delay-500",
  },
  {
    icono: ChartPieIcon,
    titulo: "Análisis por candidato y partido",
    detalle: "Ranking, composición del voto y fortalezas territoriales.",
    retraso: "delay-700",
  },
];

/** Panel de marca de la pantalla de login (solo escritorio, siempre oscuro). */
export function BrandPanel() {
  return (
    <aside
      aria-label="Ojo de Águila"
      className="dark relative isolate hidden overflow-hidden bg-[oklch(0.13_0.016_262)] text-foreground lg:order-first lg:flex lg:flex-col"
    >
      <FondoDecorativo />
      <CintaTricolor className="absolute inset-x-0 top-0 h-1.5" />

      <div className="flex flex-1 flex-col justify-center gap-12 px-12 py-16 xl:px-20">
        <div className="flex flex-col items-start gap-8 animate-in duration-700 fill-mode-both fade-in slide-in-from-bottom-4">
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-gold/25 blur-3xl" />
            <LogoMark size={120} className="relative animate-float shadow-2xl shadow-black/60 ring-white/10" />
          </div>
          <div className="space-y-3">
            <h2 className="font-heading text-4xl font-extrabold tracking-[0.12em] uppercase xl:text-5xl">
              Ojo de <span className="text-gold-gradient">Águila</span>
            </h2>
            <p className="text-lg text-muted-foreground xl:text-xl">Inteligencia electoral de Colombia</p>
          </div>
        </div>

        <ul className="grid max-w-md gap-6">
          {PROPUESTAS.map(({ icono: Icono, titulo, detalle, retraso }) => (
            <li
              key={titulo}
              className={`flex items-start gap-4 animate-in duration-500 fill-mode-both fade-in slide-in-from-bottom-2 ${retraso}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
                <Icono aria-hidden="true" className="size-5" />
              </span>
              <span className="space-y-1 pt-0.5">
                <span className="block font-medium text-foreground">{titulo}</span>
                <span className="block text-sm text-muted-foreground">{detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="border-t border-border px-12 py-6 text-xs text-muted-foreground xl:px-20">
        Fuente: Registraduría Nacional del Estado Civil
      </footer>
    </aside>
  );
}

function FondoDecorativo() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-grid-pattern mask-radial-at-top-left mask-radial-from-5% mask-radial-to-85%" />
      <div className="absolute -top-48 -left-40 size-[36rem] rounded-full bg-gold/15 blur-3xl" />
      <div className="absolute top-1/3 -right-48 size-[26rem] rounded-full bg-flag-blue/25 blur-3xl" />
      <div className="absolute -right-32 -bottom-56 size-[34rem] rounded-full bg-gold/10 blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/40 to-transparent" />
    </div>
  );
}
