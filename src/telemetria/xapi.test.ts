import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crearStatements, duracionIso, VERBOS, VERSION_XAPI } from './xapi.ts';
import type { ContextoSesion, Statement } from './xapi.ts';
import { crearGeneradorUuidv7, FORMATO_UUIDV7 } from './uuidv7.ts';
import { crearSesion } from '../motor/sesion.ts';
import { ec01 } from '../escenario/ejemplos/ec-01.ts';

const V = ec01().version;
const RUTA = ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar'];
const CTX: ContextoSesion = {
  perfil: 'https://perfil.ejemplo/xapi/safetyvr/',
  plataforma: 'https://plataforma.ejemplo',
  trabajadorId: 'trab-7f3a',
  sesionId: '0196a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  versionSimulador: 'EC-01@1.0.0',
  dispositivoId: 'quest-planta-02',
  idioma: 'es-CO',
  iniciadaEnMs: Date.UTC(2026, 10, 8, 13, 0, 0),
};

function correr(acciones: string[], cada = 5_000, alFinal?: (s: ReturnType<typeof crearSesion>) => void) {
  let t = 0;
  const s = crearSesion(ec01(), () => t);
  s.iniciar();
  for (const a of acciones) { t += cada; s.ejecutar(a); }
  alFinal?.(s);
  return { s, statements: crearStatements(ec01(), s.eventos(), { ...CTX, duracionS: s.duracionS() }, crearGeneradorUuidv7(() => CTX.iniciadaEnMs)) };
}
const verbos = (st: Statement[]) => st.map((x) => x.verb.id.split('/').pop());

test('la ruta correcta produce inició, cinco respuestas y aprobó con 100', () => {
  const { statements } = correr(RUTA);
  assert.deepEqual(verbos(statements), ['initialized', 'answered', 'answered', 'answered', 'answered', 'answered', 'passed']);
  for (const r of statements.filter((x) => x.verb.id === VERBOS.respondio.id)) {
    assert.equal(r.result!.success, true, `${r.result!.response} fue un acierto`);
  }
  const fin = statements.at(-1)!;
  assert.deepEqual(fin.result!.score, { raw: 100, min: 0, max: 100, scaled: 1 });
  assert.equal(fin.result!.success, true);
  assert.equal(fin.result!.completion, true);
  assert.equal(fin.result!.duration, 'PT25S');
});

test('cada respuesta dice el nodo, la acción, el criterio y si acertó', () => {
  const { statements } = correr(['a_subir_directo']);
  const r = statements[1]!;
  assert.equal(r.verb.id, VERBOS.respondio.id);
  assert.equal(r.object.id, `https://perfil.ejemplo/xapi/safetyvr/escenarios/EC-01/${V}/nodos/n01_permiso`);
  assert.equal(r.result!.response, 'a_subir_directo');
  assert.equal(r.result!.success, false);
  assert.equal(r.result!.extensions!['https://perfil.ejemplo/xapi/safetyvr/extensiones/criterio'], 'c_permiso');
  assert.equal(r.result!.extensions!['https://perfil.ejemplo/xapi/safetyvr/extensiones/resultado'], 'incorrecto');
  assert.equal(r.context.contextActivities!.parent![0]!.id, `https://perfil.ejemplo/xapi/safetyvr/escenarios/EC-01/${V}`);
});

test('el requisito faltante y el tiempo agotado quedan como hechos auditables', () => {
  const { statements } = correr(['a_subir_directo', 'a_medir', 'a_designar_vigia', 'a_arnes']);
  assert.ok(verbos(statements).includes('omitio-requisito'));
  let t = 0;
  const s = crearSesion(ec01(), () => t);
  s.iniciar();
  for (const a of RUTA.slice(0, 4)) { t += 1_000; s.ejecutar(a); }
  t += 25_000;
  s.revisarReloj();
  const st = crearStatements(ec01(), s.eventos(), CTX, crearGeneradorUuidv7(() => 0));
  const agoto = st.find((x) => x.verb.id.endsWith('/verbos/agoto-tiempo'))!;
  assert.equal(agoto.result!.success, false);
  assert.equal(agoto.verb.display['es-CO'], 'agotó el tiempo');
  assert.equal(st.at(-1)!.verb.id, VERBOS.reprobo.id);
});

test('abandonar produce terminated sin completar, con la duración activa', () => {
  let t = 0;
  const s = crearSesion(ec01(), () => t);
  s.iniciar();
  t += 10_000;
  s.pausar();
  t += 600_000; // diez minutos con el visor quitado
  s.reanudar();
  t += 5_000;
  s.abandonar();
  const st = crearStatements(ec01(), s.eventos(), { ...CTX, duracionS: s.duracionS() }, crearGeneradorUuidv7(() => 0));
  const fin = st.at(-1)!;
  assert.equal(fin.verb.id, VERBOS.abandono.id);
  assert.equal(fin.result!.completion, false);
  assert.equal(fin.result!.duration, 'PT15S', 'la pausa no cuenta');
});

test('ADR-001: el actor es una cuenta sin nombre ni correo', () => {
  const { statements } = correr(RUTA);
  for (const st of statements) {
    assert.deepEqual(st.actor, { objectType: 'Agent', account: { homePage: 'https://plataforma.ejemplo', name: 'trab-7f3a' } });
    const plano = JSON.stringify(st);
    assert.ok(!/mbox|"name":"[^"]*@|email/i.test(plano));
  }
});

test('todos llevan la sesión como registration, la versión del simulador y la hora real', () => {
  const { statements } = correr(RUTA);
  for (const st of statements) {
    assert.equal(st.version, VERSION_XAPI);
    assert.match(st.id, FORMATO_UUIDV7);
    assert.equal(st.context.registration, CTX.sesionId);
    assert.equal(st.context.extensions['https://perfil.ejemplo/xapi/safetyvr/extensiones/version-simulador'], 'EC-01@1.0.0');
  }
  assert.equal(statements[0]!.timestamp, '2026-11-08T13:00:00.000Z');
  assert.equal(statements.at(-1)!.timestamp, '2026-11-08T13:00:25.000Z');
  assert.equal(new Set(statements.map((s) => s.id)).size, statements.length, 'ids únicos');
});

test('los verbos se muestran en los dos idiomas', () => {
  const { statements } = correr(RUTA);
  for (const st of statements) assert.deepEqual(Object.keys(st.verb.display).sort(), ['en', 'es-CO']);
});

test('la duración ISO 8601 redondea a centésimas y nunca es negativa', () => {
  assert.equal(duracionIso(83.256), 'PT83.26S');
  assert.equal(duracionIso(0), 'PT0S');
  assert.equal(duracionIso(-3), 'PT0S');
});
