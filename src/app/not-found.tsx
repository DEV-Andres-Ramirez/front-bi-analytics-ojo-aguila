import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative isolate flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
      <div
        aria-hidden
        className="bg-grid-pattern absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]"
      />
      <BrandLogo size={44} showTagline />
      <div className="flex max-w-md flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p aria-hidden className="text-gold-gradient font-heading text-7xl font-extrabold tracking-tight sm:text-8xl">
          404
        </p>
        <div aria-hidden className="bg-tricolor h-1 w-24 rounded-full" />
        <h1 className="font-heading text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="text-sm text-balance text-muted-foreground">
          La dirección que buscas no existe o fue movida. Vuelve al inicio para seguir explorando los resultados
          electorales.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/">
            <CompassIcon aria-hidden />
            Volver al inicio
          </Link>
        </Button>
      </div>
    </main>
  );
}
