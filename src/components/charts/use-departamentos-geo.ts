"use client";

import { useCallback, useEffect, useState } from "react";
import { topojson } from "chartjs-chart-geo";
import { departamentoPorIso, type Departamento } from "@/domain/departamentos";

/** Nombre versionado: se sirve con caché inmutable (ver `next.config.ts`); cambiar el archivo exige subir la versión. */
const URL_TOPOJSON = "/geo/colombia-departamentos.v1.json";
const ISO_SAN_ANDRES = "CO-SAP";

/**
 * San Andrés queda a ~700 km de la costa y mide pocos píxeles a escala nacional: se dibuja
 * ampliado frente al Caribe, dentro del recuadro de Colombia continental, como en la cartografía oficial.
 */
const RECUADRO_SAN_ANDRES = { longitud: -78.35, latitud: 10.75, escala: 3.5 } as const;

type Topologia = Parameters<typeof topojson.feature>[0];
type ColeccionGeo = Extract<ReturnType<typeof topojson.feature>, { type: "FeatureCollection" }>;
type FeatureGeo = ColeccionGeo["features"][number];
type Poligono = Extract<FeatureGeo["geometry"], { type: "Polygon" }>;
type MultiPoligono = Extract<FeatureGeo["geometry"], { type: "MultiPolygon" }>;
type Posicion = Poligono["coordinates"][number][number];

export interface GeometriaDepartamento {
  departamento: Departamento;
  feature: FeatureGeo;
  /** Geometría reubicada y ampliada (recuadro insular). */
  enRecuadro: boolean;
}

function reubicarEnRecuadro(feature: FeatureGeo): FeatureGeo {
  const { geometry } = feature;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return feature;

  const anillos = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  const puntos = anillos.flat();
  const longitudes = puntos.map(([longitud]) => longitud);
  const latitudes = puntos.map(([, latitud]) => latitud);
  const centroLongitud = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  const centroLatitud = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const { longitud, latitud, escala } = RECUADRO_SAN_ANDRES;

  const mover = ([lon, lat]: Posicion): Posicion => [
    longitud + (lon - centroLongitud) * escala,
    latitud + (lat - centroLatitud) * escala,
  ];

  if (geometry.type === "Polygon") {
    const poligono: Poligono = { ...geometry, coordinates: geometry.coordinates.map((anillo) => anillo.map(mover)) };
    return { ...feature, geometry: poligono };
  }
  const multipoligono: MultiPoligono = {
    ...geometry,
    coordinates: geometry.coordinates.map((poligono) => poligono.map((anillo) => anillo.map(mover))),
  };
  return { ...feature, geometry: multipoligono };
}

async function descargarDepartamentos(): Promise<GeometriaDepartamento[]> {
  const respuesta = await fetch(URL_TOPOJSON);
  if (!respuesta.ok) throw new Error(`No fue posible cargar el mapa (HTTP ${respuesta.status}).`);
  const topologia = (await respuesta.json()) as Topologia;
  const [objeto] = Object.values(topologia.objects);
  const geo = topojson.feature(topologia, objeto);
  const features = geo.type === "FeatureCollection" ? geo.features : [geo];

  return features
    .flatMap((feature) => {
      const departamento = departamentoPorIso(String(feature.properties?.shapeISO ?? ""));
      if (!departamento) return [];
      const enRecuadro = departamento.iso === ISO_SAN_ANDRES;
      return [{ departamento, enRecuadro, feature: enRecuadro ? reubicarEnRecuadro(feature) : feature }];
    })
    .sort((a, b) => a.departamento.nombre.localeCompare(b.departamento.nombre, "es-CO"));
}

let promesa: Promise<GeometriaDepartamento[]> | null = null;
let cache: GeometriaDepartamento[] | null = null;

/** Descarga perezosa y única por sesión; un fallo libera la promesa para poder reintentar. */
export function cargarDepartamentos(): Promise<GeometriaDepartamento[]> {
  promesa ??= descargarDepartamentos().then(
    (departamentos) => (cache = departamentos),
    (error: unknown) => {
      promesa = null;
      throw error;
    },
  );
  return promesa;
}

type EstadoGeo =
  | { estado: "cargando" }
  | { estado: "listo"; departamentos: GeometriaDepartamento[] }
  | { estado: "error" };

export function useDepartamentosGeo() {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<EstadoGeo>(() =>
    cache ? { estado: "listo", departamentos: cache } : { estado: "cargando" },
  );

  useEffect(() => {
    let vigente = true;
    cargarDepartamentos().then(
      (departamentos) => vigente && setEstado({ estado: "listo", departamentos }),
      () => vigente && setEstado({ estado: "error" }),
    );
    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setEstado({ estado: "cargando" });
    setIntento((n) => n + 1);
  }, []);

  return { ...estado, reintentar };
}
