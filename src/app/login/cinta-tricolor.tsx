import { cn } from "@/lib/utils";

/** Cinta con los colores de la bandera que crece al entrar y deja pasar un destello periódico. */
export function CintaTricolor({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("overflow-hidden", className)}>
      <div className="relative size-full bg-tricolor animate-in duration-1000 ease-out fill-mode-both slide-in-from-left-full">
        <div className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/60 to-transparent bg-size-[200%_100%] bg-no-repeat animation-duration-[5s] motion-reduce:hidden" />
      </div>
    </div>
  );
}
