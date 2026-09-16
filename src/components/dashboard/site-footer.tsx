import { BrandLogo } from "@/components/brand/logo";

const ENLACES = {
  registraduria: "https://www.registraduria.gov.co",
  geoBoundaries: "https://www.geoboundaries.org",
  openStreetMap: "https://www.openstreetmap.org/copyright",
  odbl: "https://opendatacommons.org/licenses/odbl/",
} as const;

function EnlaceExterno({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-background/60">
      <div aria-hidden className="bg-tricolor h-0.5 w-full opacity-80" />
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <BrandLogo size={24} />
        <div className="flex flex-col gap-1 md:items-end md:text-right">
          <p>
            Fuente: <EnlaceExterno href={ENLACES.registraduria}>Registraduría Nacional del Estado Civil</EnlaceExterno>
          </p>
          <p>
            Mapa © <EnlaceExterno href={ENLACES.geoBoundaries}>geoBoundaries</EnlaceExterno> /{" "}
            <EnlaceExterno href={ENLACES.openStreetMap}>OpenStreetMap</EnlaceExterno>, licencia{" "}
            <EnlaceExterno href={ENLACES.odbl}>ODbL</EnlaceExterno>
          </p>
        </div>
      </div>
    </footer>
  );
}
