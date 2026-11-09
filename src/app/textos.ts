// Los textos de la app salen de mensajes/*.json (directiva 4), con la misma
// función `traducir` del simulador: una clave inexistente o una variable que
// falta revientan en lugar de mostrar un texto vacío.

import es from '../../mensajes/es-CO.json';
import en from '../../mensajes/en.json';
import { traducir } from '../motor/presentador.ts';
import type { Catalogo, Idioma } from '../motor/presentador.ts';

const CATALOGOS: Record<Idioma, Catalogo> = { 'es-CO': es, en };

export type Traductor = (clave: string, vars?: Record<string, string | number>) => string;

export function textos(idioma: Idioma): Traductor {
  const catalogo = CATALOGOS[idioma];
  return (clave, vars) => traducir(catalogo, clave, vars);
}
