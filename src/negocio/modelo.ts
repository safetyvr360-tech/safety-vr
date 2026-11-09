// El modelo de negocio del año 1, tal como lo fija el modelo financiero
// corregido (SAFETYVR-modelo-financiero.md). Lo que el documento deriva se
// calcula aquí desde sus supuestos, y las pruebas exigen que dé las mismas
// cifras que el documento: si alguien cambia un supuesto, se nota.

import { MARCA_BLANCA_BASE, PLANES } from './precios.ts';
import type { Plan } from './precios.ts';

// Metas del año 1 (la tabla que gobierna el documento).
export const METAS = { modulos: 14, apps_nativas: 10, escenarios_webxr: 4, empresas: 5, partners: 2, proyectos_a_medida: 2, trabajadores: 650 } as const;

// Capital semilla y su uso, en COP.
export const CAPITAL_SEMILLA = 20_000_000;
export const USO_DE_FONDOS = [
  ['fabrica_ia', 4_700_000],
  ['hardware', 4_700_000],
  ['plataforma', 3_400_000],
  ['marketing', 3_200_000],
  ['licencias', 2_000_000],
  ['legal', 2_000_000],
] as const;

// Calendario de entrada de clientes (supuestos del documento, mes del año 1).
export const ENTRADAS: ReadonlyArray<{ mes: number; tipo: Plan | 'partner' }> = [
  { mes: 4, tipo: 'piloto' }, { mes: 6, tipo: 'piloto' }, { mes: 7, tipo: 'planta' },
  { mes: 9, tipo: 'planta' }, { mes: 10, tipo: 'corporativo' },
  { mes: 8, tipo: 'partner' }, { mes: 10, tipo: 'partner' },
];

const cuota = (tipo: Plan | 'partner') => (tipo === 'partner' ? MARCA_BLANCA_BASE : PLANES[tipo]);

// Ingreso recurrente de cada mes (1 a 12): suscripciones directas más la base
// de los partners de marca blanca (su margen variable no es recurrente fijo).
export function mrrPorMes(): number[] {
  return Array.from({ length: 12 }, (_, i) => ENTRADAS.filter((e) => e.mes <= i + 1).reduce((s, e) => s + cuota(e.tipo), 0));
}

// Lo facturado en el año por suscripción directa (sin partners).
export function suscripcionDirectaAnio(): number {
  return Array.from({ length: 12 }, (_, i) => ENTRADAS.filter((e) => e.tipo !== 'partner' && e.mes <= i + 1).reduce((s, e) => s + cuota(e.tipo), 0))
    .reduce((a, b) => a + b, 0);
}

// Ingresos del año 1 por línea, en COP (del documento; la suscripción directa se comprueba arriba).
export const INGRESOS_ANIO1 = { a_medida: 70_000_000, suscripcion: 31_500_000, marca_blanca: 17_400_000 } as const;
export const totalIngresos = () => Object.values(INGRESOS_ANIO1).reduce((a, b) => a + b, 0);
export const EBITDA_ANIO1 = 39_100_000; // con los fundadores fuera de nómina (el documento lo advierte)
export const COSTO_FIJO_MES = 1_200_000;

// El primer mes en que el ingreso recurrente cubre el costo fijo.
export function mesQueCubreElFijo(): number {
  return mrrPorMes().findIndex((m) => m > COSTO_FIJO_MES) + 1;
}

// Mercado direccionable de Barranquilla: empresas objetivo por el ticket del plan Planta.
// Las 700 empresas son una estimación que el documento marca «a sustentar con la Cámara de Comercio».
export const EMPRESAS_OBJETIVO_ESTIMADAS = 700;
export const ticketAnual = () => PLANES.planta * 12;
export const mercadoDireccionable = () => EMPRESAS_OBJETIVO_ESTIMADAS * ticketAnual();
export const penetracionMeta = () => METAS.empresas / EMPRESAS_OBJETIVO_ESTIMADAS;
