import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { presentarVerificacion, verificarCodigo } from './verificacion.ts';
import type { Buscar } from './verificacion.ts';
import { emitirCertificado, huellaDeCertificado } from './cadena.ts';
import type { Certificado } from './cadena.ts';
import { generarCodigo } from './codigo.ts';
import { armarPaquete } from '../telemetria/cola.ts';
import { ec01 } from '../escenario/ejemplos/ec-01.ts';
import type { Catalogos } from '../motor/presentador.ts';

const DOC = ec01();
const leer = (i: string) => JSON.parse(readFileSync(new URL(`../../mensajes/${i}.json`, import.meta.url), 'utf8'));
const CAT: Catalogos = { 'es-CO': leer('es-CO'), en: leer('en') };
const nombre = (c: string) => (c === DOC.codigo ? DOC.titulo : null);

async function dos(): Promise<Certificado[]> {
  const out: Certificado[] = [];
  for (const id of ['s1', 's2']) {
    const p = await armarPaquete({
      id, trabajador_id: 't1', version_simulador: `${DOC.codigo}@${DOC.version}`, dispositivo_id: 'q', escenario: DOC.codigo,
      iniciada_en: '2026-11-08T17:00:00.000Z', duracion_s: 200, puntaje: 90, veredicto: 'apto',
    }, [], 'k');
    out.push(await emitirCertificado({ paquete: p, doc: DOC, organizacion_id: 'org', anterior: out.at(-1) ?? null, ahoraMs: Date.UTC(2026, 10, 8, 18), codigo: generarCodigo() }));
  }
  return out;
}
// "Base de datos" de mentira: busca por código y devuelve el siguiente de la cadena.
const base = (certs: Certificado[]): Buscar => async (codigo) => {
  const i = certs.findIndex((c) => c.codigo === codigo);
  return i < 0 ? null : { cert: certs[i]!, siguiente: certs[i + 1] ?? null };
};

test('un certificado vigente e íntegro se verifica con el código tal como lo teclean', async () => {
  const certs = await dos();
  const v = await verificarCodigo(certs[0]!.codigo.toLowerCase().replace(/-/g, ' '), base(certs), '2026-12-01');
  assert.equal(v.veredicto, 'vigente');
});

test('por vencer y vencido según la fecha de hoy', async () => {
  const certs = await dos();
  assert.equal((await verificarCodigo(certs[0]!.codigo, base(certs), '2027-10-20')).veredicto, 'por_vencer');
  assert.equal((await verificarCodigo(certs[0]!.codigo, base(certs), '2027-11-09')).veredicto, 'vencido');
});

test('un código con error de escritura no llega a la base de datos', async () => {
  const certs = await dos();
  let consultas = 0;
  const contar: Buscar = async (c) => { consultas += 1; return base(certs)(c); };
  const c = certs[0]!.codigo;
  const malo = c.slice(0, -1) + (c.endsWith('0') ? '1' : '0');
  assert.equal((await verificarCodigo(malo, contar, '2026-12-01')).veredicto, 'codigo_invalido');
  assert.equal(consultas, 0);
});

test('un código bien formado que no existe es «no encontrado»', async () => {
  assert.equal((await verificarCodigo(generarCodigo(), base(await dos()), '2026-12-01')).veredicto, 'no_encontrado');
});

test('un registro alterado se denuncia aunque alguien recalcule su huella', async () => {
  const certs = await dos();
  // Le alargan la vigencia al primero y recalculan su huella...
  const { hash: _h, ...resto } = { ...certs[0]!, vigente_hasta: '2035-01-01' };
  const falso = [{ ...resto, hash: await huellaDeCertificado(resto) }, certs[1]!];
  // ...pero el siguiente de la cadena todavía apunta a la huella original.
  assert.equal((await verificarCodigo(certs[0]!.codigo, base(falso), '2034-01-01')).veredicto, 'alterado');
  // Y si no recalculan la huella, la propia huella no cuadra.
  const burdo = [{ ...certs[1]!, vigente_hasta: '2035-01-01' }];
  assert.equal((await verificarCodigo(certs[1]!.codigo, base(burdo), '2034-01-01')).veredicto, 'alterado');
});

test('la página pública dice qué competencia y hasta cuándo, en el idioma del visitante, sin puntaje', async () => {
  const certs = await dos();
  const v = await verificarCodigo(certs[0]!.codigo, base(certs), '2026-12-01');
  const es = presentarVerificacion(v, CAT['es-CO'], 'es-CO', nombre);
  assert.equal(es.titulo, 'Certificado vigente');
  assert.equal(es.confiable, true);
  assert.ok(es.filas.some((f) => f.etiqueta === 'Vigente hasta' && f.valor === '8 de noviembre de 2027'));
  assert.ok(es.filas.some((f) => f.valor.includes('(EC-01)')));
  const en = presentarVerificacion(v, CAT.en, 'en', nombre);
  assert.ok(en.filas.some((f) => f.etiqueta === 'Valid until' && f.valor === 'November 8, 2027'));
  assert.ok(!/puntaje|score|t1/i.test(JSON.stringify(es)), 'ni puntaje ni id del trabajador');
});

test('los veredictos no confiables lo dicen sin rodeos', async () => {
  const certs = await dos();
  const vencido = presentarVerificacion(await verificarCodigo(certs[0]!.codigo, base(certs), '2028-01-01'), CAT['es-CO'], 'es-CO', nombre);
  assert.equal(vencido.confiable, false);
  assert.match(vencido.detalle, /recertificarse/);
  const invalido = presentarVerificacion(await verificarCodigo('SVR-1', base(certs), '2026-12-01'), CAT['es-CO'], 'es-CO', nombre);
  assert.equal(invalido.titulo, 'Código no válido');
  assert.deepEqual(invalido.filas, []);
});
