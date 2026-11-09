import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emitirCertificado, ErrorCertificado, huellaDeCertificado, respaldoIntacto, verificarCadena } from './cadena.ts';
import type { Certificado } from './cadena.ts';
import { generarCodigo } from './codigo.ts';
import { armarPaquete } from '../telemetria/cola.ts';
import type { Paquete, ResumenSesion } from '../telemetria/cola.ts';
import { ec01 } from '../escenario/ejemplos/ec-01.ts';

const DOC = ec01();
const ORG = 'org-constructora-andina';
const AHORA = Date.UTC(2026, 10, 8, 18, 0); // 8 nov 2026, 1 p. m. en Bogotá

async function paquete(id: string, puntaje = 100, cambios: Partial<ResumenSesion> = {}): Promise<Paquete> {
  return armarPaquete({
    id, trabajador_id: `trab-${id}`, version_simulador: `${DOC.codigo}@${DOC.version}`, dispositivo_id: 'quest-02',
    escenario: DOC.codigo, iniciada_en: '2026-11-08T17:50:00.000Z', duracion_s: 300, puntaje,
    veredicto: puntaje >= 80 ? 'apto' : 'no_apto', ...cambios,
  }, [], 'secreto');
}

async function cadena(n: number): Promise<Certificado[]> {
  const certs: Certificado[] = [];
  for (let i = 0; i < n; i += 1) {
    certs.push(await emitirCertificado({
      paquete: await paquete(`s${i}`), doc: DOC, organizacion_id: ORG,
      anterior: certs.at(-1) ?? null, ahoraMs: AHORA + i * 60_000, codigo: generarCodigo(),
    }));
  }
  return certs;
}

test('el primer certificado abre la cadena y vence según la vigencia del escenario', async () => {
  const [c] = await cadena(1);
  assert.equal(c!.hash_anterior, null);
  assert.match(c!.hash, /^[0-9a-f]{64}$/);
  assert.equal(c!.competencia, 'EC-01');
  assert.equal(c!.vigente_hasta, '2027-11-08'); // vigencia_meses: 12
  assert.equal(c!.emitido_el, '2026-11-08T18:00:00.000Z');
});

test('cada certificado nuevo apunta a la huella del anterior', async () => {
  const certs = await cadena(4);
  for (let i = 1; i < certs.length; i += 1) assert.equal(certs[i]!.hash_anterior, certs[i - 1]!.hash);
  assert.deepEqual(await verificarCadena(certs), { ok: true, eslabones: 4 });
});

test('ADR-001: el certificado no lleva puntaje ni respuestas', async () => {
  const [c] = await cadena(1);
  assert.ok(!('puntaje' in c!));
  assert.ok(!/puntaje|respuesta|criterio/.test(JSON.stringify(c)));
});

test('cambiar cualquier dato de un certificado rompe la cadena en ese punto', async () => {
  for (const campo of ['trabajador_id', 'vigente_hasta', 'competencia', 'emitido_el', 'sesion_huella'] as const) {
    const certs = await cadena(3);
    certs[1] = { ...certs[1]!, [campo]: campo === 'vigente_hasta' ? '2030-01-01' : `${certs[1]![campo]}x` };
    const r = await verificarCadena(certs);
    assert.deepEqual(r, { ok: false, indice: 1, motivo: 'hash_alterado' }, campo);
  }
});

test('recalcular la huella del alterado no basta: se rompe el eslabón siguiente', async () => {
  const certs = await cadena(3);
  const { hash: _h, ...resto } = { ...certs[1]!, vigente_hasta: '2030-01-01' };
  certs[1] = { ...resto, hash: await huellaDeCertificado(resto) };
  assert.deepEqual(await verificarCadena(certs), { ok: false, indice: 2, motivo: 'eslabon_roto' });
});

test('borrar un certificado del medio se detecta', async () => {
  const certs = await cadena(4);
  certs.splice(2, 1);
  assert.deepEqual(await verificarCadena(certs), { ok: false, indice: 2, motivo: 'eslabon_roto' });
});

test('una cadena que no empieza en el primero, o que mezcla organizaciones, se rechaza', async () => {
  const certs = await cadena(3);
  assert.deepEqual(await verificarCadena(certs.slice(1)), { ok: false, indice: 0, motivo: 'inicio_invalido' });
  const mezcla = [...certs];
  mezcla[2] = { ...mezcla[2]!, organizacion_id: 'otra' };
  assert.equal((await verificarCadena(mezcla) as { motivo: string }).motivo, 'organizacion_mezclada');
});

test('una sesión no apta, de otro escenario o de otra versión no se certifica', async () => {
  const base = { doc: DOC, organizacion_id: ORG, anterior: null, ahoraMs: AHORA, codigo: generarCodigo() };
  const codigo = async (p: Promise<Paquete>) => {
    try { await emitirCertificado({ ...base, paquete: await p }); return 'emitido'; } catch (e) { return (e as ErrorCertificado).codigo; }
  };
  assert.equal(await codigo(paquete('a', 55)), 'sesion_no_apta');
  assert.equal(await codigo(paquete('b', 100, { veredicto: 'incompleta' })), 'sesion_no_apta');
  assert.equal(await codigo(paquete('c', 100, { escenario: 'EC-02' })), 'escenario_distinto');
  assert.equal(await codigo(paquete('d', 100, { version_simulador: 'EC-01@0.9.0' })), 'version_distinta');
});

test('no se emite con un código mal formado ni encadenado a otra organización', async () => {
  const [otra] = await cadena(1);
  await assert.rejects(emitirCertificado({ paquete: await paquete('x'), doc: DOC, organizacion_id: ORG, anterior: null, ahoraMs: AHORA, codigo: 'SVR-0000-0000-0001' }), /codigo_invalido/);
  await assert.rejects(emitirCertificado({ paquete: await paquete('y'), doc: DOC, organizacion_id: 'otra-org', anterior: otra!, ahoraMs: AHORA, codigo: generarCodigo() }), /cadena_de_otra_organizacion/);
});

test('la sesión que respalda el certificado se puede comprobar con su huella', async () => {
  const p = await paquete('s0');
  const c = await emitirCertificado({ paquete: p, doc: DOC, organizacion_id: ORG, anterior: null, ahoraMs: AHORA, codigo: generarCodigo() });
  assert.equal(await respaldoIntacto(c, p), true);
  const inflado = { ...p, sesion: { ...p.sesion, puntaje: 99 } };
  assert.equal(await respaldoIntacto(c, inflado), false, 'tocar el puntaje de la sesión se nota');
});
