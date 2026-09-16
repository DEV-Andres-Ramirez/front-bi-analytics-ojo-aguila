import type { NextConfig } from "next";

const CABECERAS_SEGURIDAD = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/** Caché de un año sin revalidar: si cambia el contenido de un archivo de estas carpetas, hay que cambiarle el nombre. */
const CACHE_INMUTABLE = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: CABECERAS_SEGURIDAD },
      { source: "/geo/:path*", headers: CACHE_INMUTABLE },
      { source: "/brand/:path*", headers: CACHE_INMUTABLE },
    ];
  },
};

export default nextConfig;
