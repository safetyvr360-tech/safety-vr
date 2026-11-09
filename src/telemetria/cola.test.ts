import { test } from 'node:test';
import assert from 'node:assert/strict';

import { almacenEnMemoria, armarPaquete, contenidoFirmado, crearCola, espera } from './cola.ts';
import type { Enviar, Paquete, ResumenSesion, Respuesta } from './cola.ts';
import { verificar } from './firma.ts';

const SECRETO = 'token-del-quest-02';

function resumen(id: string, puntaje = 100): ResumenSesion {
  return {
    id, trabajador_id: 'trab-7f3a', version_simulador: 'EC-01@1.0.0', dispositivo_id: 'quest-02', escenario: 'EC-01',
    iniciada_en: '2026-11-08T13:00:00.000Z', duracion_s: 25, puntaje, veredicto: puntaje >= 80 ? 'apto' : 'no_apto',
  };
}
const paquete = (id: string, puntaje?: number) => armarPaquete(resumen(id, puntaje), [], SECRETO);

// Servidor de mentira: responde según un guion y anota lo que recibió.
function servidor(guion: Respuesta[]) {
  const recibidos: string[] = [];
  const enviar: Enviar = async (p) => { recibidos.push(p.sesion.id); return guion.shift() ?? 'aceptado'; };
  return { enviar, recibidos };
}

test('el paquete va firmado y la firma lo protege', async () => {
  const p = await paquete('0196-a');
  assert.equal(p.formato, 'safetyvr/sesion@1');
  assert.equal(await verificar(contenidoFirmado(p), p.firma, SECRETO), true);
  const alterado: Paquete = { ...p, sesion: { ...p.sesion, puntaje: 100, veredicto: 'apto' } };
  const bajo = await paquete('0196-b', 40);
  assert.equal(await verificar(contenidoFirmado({ ...bajo, sesion: alterado.sesion }), bajo.firma, SECRETO), false);
});

test('encolar el mismo paquete dos veces no lo duplica', async () => {
  const cola = crearCola(almacenEnMemoria());
  const p = await paquete('0196-a');
  assert.equal(cola.encolar(p), true);
  assert.equal(cola.encolar(p), false);
  assert.equal(cola.estado().pendientes.length, 1);
});

test('con red, sincronizar envía todo en orden de fecha y vacía la cola', async () => {
  const cola = crearCola(almacenEnMemoria(), () => 0);
  cola.encolar(await paquete('0196-c'));
  cola.encolar(await paquete('0196-a'));
  cola.encolar(await paquete('0196-b'));
  const srv = servidor([]);
  const inf = await cola.sincronizar(srv.enviar);
  assert.deepEqual(srv.recibidos, ['0196-a', '0196-b', '0196-c']);
  assert.deepEqual(inf, { enviados: 3, rechazados: 0, pendientes: 0 });
});

test('sin red no se pierde nada y se reintenta con espera creciente', async () => {
  let t = 0;
  const cola = crearCola(almacenEnMemoria(), () => t);
  cola.encolar(await paquete('0196-a'));
  cola.encolar(await paquete('0196-b'));
  const srv = servidor(['sin_red']);
  const inf = await cola.sincronizar(srv.enviar);
  assert.deepEqual(srv.recibidos, ['0196-a'], 'sin red no insiste con los demás');
  assert.equal(inf.pendientes, 2);
  const a = cola.estado().pendientes.find((x) => x.paquete.sesion.id === '0196-a')!;
  assert.equal(a.intentos, 1);
  assert.equal(a.proximo_intento_ms, 2_000);
  // Antes de la espera, no se vuelve a intentar ese paquete.
  t = 1_000;
  const srv2 = servidor([]);
  await cola.sincronizar(srv2.enviar);
  assert.deepEqual(srv2.recibidos, ['0196-b']);
  t = 2_000;
  const srv3 = servidor([]);
  await cola.sincronizar(srv3.enviar);
  assert.deepEqual(srv3.recibidos, ['0196-a']);
  assert.equal(cola.estado().pendientes.length, 0);
});

test('cuando vuelve la red, forzar envía sin esperar el reintento', async () => {
  const cola = crearCola(almacenEnMemoria(), () => 0);
  cola.encolar(await paquete('0196-a'));
  await cola.sincronizar(servidor(['sin_red']).enviar);
  const normal = servidor([]);
  await cola.sincronizar(normal.enviar);
  assert.deepEqual(normal.recibidos, [], 'sin forzar, respeta la espera');
  const forzado = servidor([]);
  const inf = await cola.sincronizar(forzado.enviar, { forzar: true });
  assert.deepEqual(forzado.recibidos, ['0196-a']);
  assert.equal(inf.pendientes, 0);
});

test('un error del servidor sigue con los demás paquetes', async () => {
  const cola = crearCola(almacenEnMemoria(), () => 0);
  cola.encolar(await paquete('0196-a'));
  cola.encolar(await paquete('0196-b'));
  const srv = servidor(['error_servidor', 'aceptado']);
  const inf = await cola.sincronizar(srv.enviar);
  assert.deepEqual(srv.recibidos, ['0196-a', '0196-b']);
  assert.deepEqual(inf, { enviados: 1, rechazados: 0, pendientes: 1 });
});

test('un envío que lanza excepción cuenta como sin red, no rompe la cola', async () => {
  const cola = crearCola(almacenEnMemoria(), () => 0);
  cola.encolar(await paquete('0196-a'));
  const inf = await cola.sincronizar(async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(inf.pendientes, 1);
  assert.equal(cola.estado().pendientes[0]!.ultimo_error, 'sin_red');
});

test('un paquete rechazado se aparta para revisión y no se reintenta', async () => {
  const cola = crearCola(almacenEnMemoria(), () => 0);
  cola.encolar(await paquete('0196-a'));
  const inf = await cola.sincronizar(servidor(['rechazado']).enviar);
  assert.deepEqual(inf, { enviados: 0, rechazados: 1, pendientes: 0 });
  assert.equal(cola.estado().rechazados[0]!.paquete.sesion.id, '0196-a');
  const srv = servidor([]);
  await cola.sincronizar(srv.enviar);
  assert.deepEqual(srv.recibidos, []);
  assert.equal(cola.encolar(await paquete('0196-a')), false, 'tampoco vuelve a entrar');
});

test('la espera crece 2, 4, 8 s… y se topa en 15 minutos', () => {
  assert.deepEqual([1, 2, 3, 4].map(espera), [2_000, 4_000, 8_000, 16_000]);
  assert.equal(espera(30), 15 * 60_000);
});

test('dos sincronizaciones a la vez no envían el mismo paquete dos veces', async () => {
  const cola = crearCola(almacenEnMemoria(), () => 0);
  cola.encolar(await paquete('0196-a'));
  let soltar!: () => void;
  const recibidos: string[] = [];
  const lento: Enviar = (p) => new Promise((r) => { recibidos.push(p.sesion.id); soltar = () => r('aceptado'); });
  const primera = cola.sincronizar(lento);
  const segunda = await cola.sincronizar(lento);
  assert.equal(segunda.omitida, 'en_curso');
  soltar();
  await primera;
  assert.deepEqual(recibidos, ['0196-a']);
});

test('la cola sobrevive a un reinicio del visor: el almacén guarda lo pendiente', async () => {
  const almacen = almacenEnMemoria();
  crearCola(almacen, () => 0).encolar(await paquete('0196-a'));
  const despuesDeReiniciar = crearCola(almacen, () => 0);
  assert.equal(despuesDeReiniciar.estado().pendientes.length, 1);
});

test('un almacén dañado no tumba la cola: arranca vacía', () => {
  const cola = crearCola({ leer: () => { throw new SyntaxError('JSON dañado'); }, escribir: () => {} });
  assert.deepEqual(cola.estado(), { pendientes: [], rechazados: [] });
  const raro = crearCola({ leer: () => ({ basura: true } as never), escribir: () => {} });
  assert.deepEqual(raro.estado(), { pendientes: [], rechazados: [] });
});
