import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_COMPLETO = "/brand/ojo-aguila.svg";
/** Versión simplificada (cabeza, ojo y cinta): el mapa, la urna y las barras se vuelven ruido en tamaños pequeños. */
const LOGO_SIMPLE = "/brand/ojo-aguila-simple.svg";
const TAMANO_MINIMO_COMPLETO = 48;

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Carga prioritaria (imagen visible al cargar la página). */
  priority?: boolean;
  /** Decorativo cuando el nombre ya se muestra al lado. */
  decorative?: boolean;
}

/** Isotipo (águila sobre loseta blanca). */
export function LogoMark({ size = 40, className, priority, decorative = false }: LogoMarkProps) {
  return (
    <Image
      src={size < TAMANO_MINIMO_COMPLETO ? LOGO_SIMPLE : LOGO_COMPLETO}
      alt={decorative ? "" : "Ojo de Águila"}
      width={size}
      height={size}
      loading={priority ? "eager" : undefined}
      fetchPriority={priority ? "high" : undefined}
      unoptimized
      className={cn("shrink-0 rounded-[22%] shadow-sm ring-1 ring-black/5", className)}
    />
  );
}

interface BrandLogoProps extends Omit<LogoMarkProps, "decorative"> {
  showTagline?: boolean;
  /** Clases del eslogan (p. ej. "hidden xl:block" para mostrarlo solo en pantallas grandes). */
  taglineClassName?: string;
}

/** Isotipo + wordmark "OJO DE ÁGUILA". */
export function BrandLogo({ size = 36, className, priority, showTagline = false, taglineClassName }: BrandLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} priority={priority} decorative />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[0.95rem] font-extrabold tracking-[0.14em] whitespace-nowrap">
          OJO DE <span className="text-gold-gradient">ÁGUILA</span>
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase",
              taglineClassName,
            )}
          >
            Inteligencia electoral · Colombia
          </span>
        )}
      </span>
    </span>
  );
}
