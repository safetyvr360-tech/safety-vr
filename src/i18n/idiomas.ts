// Idioma de la app web (directiva 4). Lógica pura: la usan el middleware de
// Next, el selector de idioma y las pruebas.
//
// - La ruta manda: /es-CO/… o /en/…. Toda página vive bajo su idioma.
// - En la raíz (/), se elige así: la preferencia guardada (cookie) si es
//   válida; si no, el mejor idioma del navegador (Accept-Language con sus
//   pesos q); si no, es-CO.
// - Cualquier variante de español (es, es-MX, es-ES…) va a es-CO y cualquier
//   variante de inglés a en: la app no tiene más idiomas que esos dos.

import type { Idioma } from '../motor/presentador.ts';

export const IDIOMAS: readonly Idioma[] = ['es-CO', 'en'];
export const IDIOMA_POR_OMISION: Idioma = 'es-CO';
export const COOKIE_IDIOMA = 'svr-idioma';

export function esIdioma(x: unknown): x is Idioma {
  return typeof x === 'string' && (IDIOMAS as readonly string[]).includes(x);
}

// Lleva una etiqueta de idioma (es, es-MX, en-GB…) a uno de los dos de la app.
function aIdiomaDeLaApp(etiqueta: string): Idioma | null {
  const base = etiqueta.trim().toLowerCase().split('-')[0];
  if (base === 'es') return 'es-CO';
  if (base === 'en') return 'en';
  return null;
}

export function negociarIdioma(acceptLanguage: string | null | undefined, preferido?: string | null): Idioma {
  if (esIdioma(preferido)) return preferido;
  const opciones = (acceptLanguage ?? '')
    .split(',')
    .map((parte, orden) => {
      const [etiqueta = '', ...params] = parte.split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const peso = q === undefined ? 1 : Number(q.slice(2));
      return { idioma: aIdiomaDeLaApp(etiqueta), peso: Number.isFinite(peso) ? peso : 0, orden };
    })
    .filter((o) => o.idioma !== null && o.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.orden - b.orden);
  return opciones[0]?.idioma ?? IDIOMA_POR_OMISION;
}

// El idioma que encabeza una ruta, o null si la ruta no lo trae.
export function idiomaDeRuta(ruta: string): Idioma | null {
  const primero = ruta.split('/')[1] ?? '';
  return esIdioma(primero) ? primero : null;
}

// La misma página en otro idioma: cambia solo el primer segmento.
export function rutaEnIdioma(ruta: string, idioma: Idioma): string {
  const [camino = '/', resto = ''] = separarConsulta(ruta);
  const partes = camino.split('/');
  if (idiomaDeRuta(camino) !== null) partes[1] = idioma;
  else partes.splice(1, 0, idioma);
  const nuevo = partes.join('/').replace(/\/$/, '') || `/${idioma}`;
  return nuevo + resto;
}

// Separa el camino de la consulta y el fragmento (?… y #…), que se conservan.
function separarConsulta(ruta: string): [string, string] {
  const i = ruta.search(/[?#]/);
  return i < 0 ? [ruta, ''] : [ruta.slice(0, i), ruta.slice(i)];
}
