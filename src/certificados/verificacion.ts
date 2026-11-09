// Verificación pública por URL: lo que ve un tercero (el contratista en la
// portería, un auditor) cuando escanea el QR o teclea el código.
//
// Responde solo lo que hace falta para confiar: qué competencia, desde y hasta
// cuándo, si está vigente y si el registro está íntegro. Sin puntaje, sin
// respuestas, sin el id interno del trabajador (ADR-001).

import type { Texto } from '../escenario/tipos.ts';
import type { Catalogo, Idioma } from '../motor/presentador.ts';
import { traducir } from '../motor/presentador.ts';
import type { Certificado } from './cadena.ts';
import { huellaDeCertificado } from './cadena.ts';
import { normalizarCodigo } from './codigo.ts';
import type { EstadoVigencia } from './vigencia.ts';
import { estadoVigencia } from './vigencia.ts';

export type Consulta = { cert: Certificado; siguiente: Certificado | null } | null;
// Cómo se busca en el servidor. `siguiente` es el certificado que viene después
// en la cadena, si lo hay: si su hash_anterior no coincide, el registro guardado
// fue alterado aunque su propia huella cuadre.
export type Buscar = (codigo: string) => Promise<Consulta>;

export type Veredicto = 'codigo_invalido' | 'no_encontrado' | 'alterado' | EstadoVigencia;

export type Verificacion = {
  veredicto: Veredicto;
  codigo: string | null;
  cert: Certificado | null;
};

export async function verificarCodigo(texto: string, buscar: Buscar, hoy: string): Promise<Verificacion> {
  const codigo = normalizarCodigo(texto);
  if (!codigo) return { veredicto: 'codigo_invalido', codigo: null, cert: null };
  const r = await buscar(codigo);
  if (!r) return { veredicto: 'no_encontrado', codigo, cert: null };
  const { hash: _h, ...resto } = r.cert;
  const propio = (await huellaDeCertificado(resto)) === r.cert.hash;
  const enlace = r.siguiente === null || r.siguiente.hash_anterior === r.cert.hash;
  if (!propio || !enlace || r.cert.codigo !== codigo) return { veredicto: 'alterado', codigo, cert: r.cert };
  return { veredicto: estadoVigencia(r.cert.vigente_hasta, hoy), codigo, cert: r.cert };
}

export type VistaVerificacion = {
  veredicto: Veredicto;
  titulo: string;
  detalle: string;
  filas: { etiqueta: string; valor: string }[];
  confiable: boolean;
};

// Texto listo para la página pública, en el idioma del visitante.
export function presentarVerificacion(
  v: Verificacion,
  catalogo: Catalogo,
  idioma: Idioma,
  nombreCompetencia: (codigo: string) => Texto | null,
): VistaVerificacion {
  const t = (k: string, vars?: Record<string, string | number>) => traducir(catalogo, k, vars);
  const fecha = (iso: string) => new Intl.DateTimeFormat(idioma, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
  const confiable = v.veredicto === 'vigente' || v.veredicto === 'por_vencer';
  const base = { veredicto: v.veredicto, titulo: t(`cert.veredicto.${v.veredicto}`), confiable };
  if (!v.cert || v.veredicto === 'codigo_invalido' || v.veredicto === 'no_encontrado') {
    return { ...base, detalle: t(`cert.detalle.${v.veredicto}`), filas: [] };
  }
  const c = v.cert;
  const nombre = nombreCompetencia(c.competencia);
  const competencia = nombre ? (nombre[idioma] ?? Object.values(nombre)[0] ?? c.competencia) : c.competencia;
  return {
    ...base,
    detalle: t(`cert.detalle.${v.veredicto}`),
    filas: [
      { etiqueta: t('cert.campo.codigo'), valor: c.codigo },
      { etiqueta: t('cert.campo.competencia'), valor: `${competencia} (${c.competencia})` },
      { etiqueta: t('cert.campo.emitido'), valor: fecha(c.emitido_el) },
      { etiqueta: t('cert.campo.vigente_hasta'), valor: fecha(c.vigente_hasta) },
      { etiqueta: t('cert.campo.huella'), valor: `${c.hash.slice(0, 16)}…` },
    ],
  };
}
