// Precios de SAFETY VR: una sola fuente para la página comercial, la página de
// inversión y los datos estructurados que lee Google. Los valores son los del
// modelo financiero corregido (docs de negocio, SAFETYVR-modelo-financiero.md):
// precios en pesos colombianos; los dólares se calculan con la TRM de
// referencia del mismo documento, nunca se escriben a mano.

import type { Idioma } from '../motor/presentador.ts';

export const TRM_REFERENCIA = 4360; // COP por USD

export type Plan = 'piloto' | 'planta' | 'corporativo';
export const PLANES: Record<Plan, number> = { piloto: 450_000, planta: 1_350_000, corporativo: 3_600_000 }; // COP al mes
export const MARCA_BLANCA_BASE = 1_800_000; // COP al mes, más el margen
export const MARCA_BLANCA_MARGEN = 0.3; // sobre lo que factura el partner
export const A_MEDIDA_USD: readonly [number, number] = [5_000, 15_000]; // por simulador nativo

export const aUSD = (cop: number): number => Math.round(cop / TRM_REFERENCIA);

const miles = (n: number, idioma: Idioma) => new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-CO', { maximumFractionDigits: 0 }).format(n);

// $450.000 en español; COP 450,000 en inglés (el «$» solo, en inglés, se leería como dólares).
export function formatoCOP(cop: number, idioma: Idioma): string {
  return idioma === 'en' ? `COP ${miles(cop, idioma)}` : `$${miles(cop, idioma)}`;
}

export function formatoUSD(usd: number, idioma: Idioma): string {
  return `USD ${miles(usd, idioma)}`;
}

// Los precios de un plan, listos para mostrar: mes y año, en pesos y en dólares.
export function preciosDe(plan: Plan, idioma: Idioma) {
  const mes = PLANES[plan], anio = mes * 12;
  return {
    mes_cop: formatoCOP(mes, idioma), mes_usd: formatoUSD(aUSD(mes), idioma),
    anio_cop: formatoCOP(anio, idioma), anio_usd: formatoUSD(aUSD(anio), idioma),
  };
}

// Cifras grandes en millones con un decimal: $10,8 M / COP 10.8 M.
export function formatoMillones(cop: number, idioma: Idioma): string {
  const m = new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(cop / 1_000_000);
  return idioma === 'en' ? `COP ${m} M` : `$${m} M`;
}

// Dólares grandes en millones con un decimal: USD 2,6 M / USD 2.6 M.
export function formatoUSDMillones(usd: number, idioma: Idioma): string {
  const m = new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-CO', { maximumFractionDigits: 1 }).format(usd / 1_000_000);
  return `USD ${m} M`;
}

// Un porcentaje con un decimal: 32,9 % / 32.9%.
export function formatoPorcentaje(fraccion: number, idioma: Idioma): string {
  const n = new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-CO', { maximumFractionDigits: 1 }).format(fraccion * 100);
  return idioma === 'en' ? `${n}%` : `${n} %`;
}
