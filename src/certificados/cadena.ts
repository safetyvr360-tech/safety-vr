// Certificado con hash encadenado (arquitectura §3.6; backup, decisiones).
//
// Cada certificado guarda la huella SHA-256 del paquete de sesión que lo
// respalda y la huella del certificado anterior de la misma organización. Así
// se forma una cadena: cambiar un puntaje, una fecha o borrar un certificado del
// medio rompe todas las huellas siguientes, y cualquier tercero puede
// recalcularlas. No hace falta blockchain para que sea inalterable y verificable.
//
// El certificado prueba la COMPETENCIA, no el desempeño: no lleva puntaje ni
// respuestas (ADR-001). El puntaje queda en la sesión, detrás de su huella.

import type { Escenario } from '../escenario/tipos.ts';
import type { Paquete } from '../telemetria/cola.ts';
import { huella } from '../telemetria/firma.ts';
import { normalizarCodigo } from './codigo.ts';
import { fechaCivil, sumarMeses } from './vigencia.ts';

export const FORMATO_CERTIFICADO = 'safetyvr/certificado@1';

export type Certificado = {
  codigo: string;
  organizacion_id: string;
  trabajador_id: string;
  sesion_id: string;
  sesion_huella: string;     // SHA-256 del paquete firmado de la sesión aprobada
  competencia: string;       // código del escenario, p. ej. EC-01
  version_simulador: string; // la evidencia guarda la versión que la produjo
  emitido_el: string;        // ISO 8601
  vigente_hasta: string;     // AAAA-MM-DD, fecha civil de Colombia, inclusive
  hash_anterior: string | null;
  hash: string;
};

export type CodigoErrorCertificado =
  | 'sesion_no_apta' | 'escenario_distinto' | 'version_distinta'
  | 'codigo_invalido' | 'cadena_de_otra_organizacion' | 'trabajador_distinto';

export class ErrorCertificado extends Error {
  codigo: CodigoErrorCertificado;
  constructor(codigo: CodigoErrorCertificado) {
    super(codigo);
    this.name = 'ErrorCertificado';
    this.codigo = codigo;
  }
}

// Lo que entra en la huella: todo menos la huella misma.
function contenido(c: Omit<Certificado, 'hash'>) {
  return {
    formato: FORMATO_CERTIFICADO,
    codigo: c.codigo,
    organizacion_id: c.organizacion_id,
    trabajador_id: c.trabajador_id,
    sesion_id: c.sesion_id,
    sesion_huella: c.sesion_huella,
    competencia: c.competencia,
    version_simulador: c.version_simulador,
    emitido_el: c.emitido_el,
    vigente_hasta: c.vigente_hasta,
    hash_anterior: c.hash_anterior,
  };
}

export async function huellaDeCertificado(c: Omit<Certificado, 'hash'>): Promise<string> {
  return huella(contenido(c));
}

export type Emision = {
  paquete: Paquete;          // ya verificado contra la firma del dispositivo
  doc: Escenario;
  organizacion_id: string;
  anterior: Certificado | null; // el último certificado de la organización
  ahoraMs: number;
  codigo: string;
};

export async function emitirCertificado(e: Emision): Promise<Certificado> {
  const s = e.paquete.sesion;
  if (s.veredicto !== 'apto') throw new ErrorCertificado('sesion_no_apta');
  if (s.escenario !== e.doc.codigo) throw new ErrorCertificado('escenario_distinto');
  if (s.version_simulador !== `${e.doc.codigo}@${e.doc.version}`) throw new ErrorCertificado('version_distinta');
  const codigo = normalizarCodigo(e.codigo);
  if (!codigo) throw new ErrorCertificado('codigo_invalido');
  if (e.anterior && e.anterior.organizacion_id !== e.organizacion_id) throw new ErrorCertificado('cadena_de_otra_organizacion');

  const sinHash: Omit<Certificado, 'hash'> = {
    codigo,
    organizacion_id: e.organizacion_id,
    trabajador_id: s.trabajador_id,
    sesion_id: s.id,
    sesion_huella: await huella(e.paquete),
    competencia: e.doc.codigo,
    version_simulador: s.version_simulador,
    emitido_el: new Date(e.ahoraMs).toISOString(),
    vigente_hasta: sumarMeses(fechaCivil(e.ahoraMs), e.doc.vigencia_meses),
    hash_anterior: e.anterior ? e.anterior.hash : null,
  };
  return { ...sinHash, hash: await huellaDeCertificado(sinHash) };
}

export type ResultadoCadena =
  | { ok: true; eslabones: number }
  | { ok: false; indice: number; motivo: 'hash_alterado' | 'eslabon_roto' | 'organizacion_mezclada' | 'inicio_invalido' };

// Revisa una cadena completa, en orden de emisión: lo que hace un auditor con
// la exportación de una organización.
export async function verificarCadena(certs: Certificado[]): Promise<ResultadoCadena> {
  for (let i = 0; i < certs.length; i += 1) {
    const c = certs[i]!;
    if (i === 0 && c.hash_anterior !== null) return { ok: false, indice: 0, motivo: 'inicio_invalido' };
    if (i > 0 && c.organizacion_id !== certs[0]!.organizacion_id) return { ok: false, indice: i, motivo: 'organizacion_mezclada' };
    const { hash: _h, ...resto } = c;
    if (await huellaDeCertificado(resto) !== c.hash) return { ok: false, indice: i, motivo: 'hash_alterado' };
    if (i > 0 && c.hash_anterior !== certs[i - 1]!.hash) return { ok: false, indice: i, motivo: 'eslabon_roto' };
  }
  return { ok: true, eslabones: certs.length };
}

// Revisa la sesión que respalda un certificado: el paquete guardado tiene que
// dar la misma huella que quedó escrita en el certificado.
export async function respaldoIntacto(c: Certificado, paquete: Paquete): Promise<boolean> {
  return paquete.sesion.id === c.sesion_id && (await huella(paquete)) === c.sesion_huella;
}
