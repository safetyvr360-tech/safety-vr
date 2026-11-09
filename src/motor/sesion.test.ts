import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crearSesion } from './sesion.ts';
import { ErrorMotor } from './maquina.ts';
import { ec01 } from '../escenario/ejemplos/ec-01.ts';

// Reloj de mentira: el tiempo avanza solo cuando la prueba lo dice.
function relojFalso(inicio = 1_000) {
  let ahora = inicio;
  return { reloj: () => ahora, avanzar: (ms: number) => { ahora += ms; } };
}

const HASTA_ALARMA = ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes'];

function codigoDe(fn: () => unknown): string {
  try { fn(); } catch (e) { if (e instanceof ErrorMotor) return e.codigo; throw e; }
  return 'no_lanzo';
}

test('al entrar a un nodo con límite arranca la cuenta regresiva', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar(); // n01: 90 s
  assert.equal(s.restanteMs(), 90_000);
  r.avanzar(30_000);
  assert.equal(s.restanteMs(), 60_000);
});

test('un nodo sin límite no tiene cuenta regresiva', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  s.ejecutar('a_revisar_permiso');
  s.ejecutar('a_medir'); // n03 no tiene tiempo_limite_s
  assert.equal(s.restanteMs(), null);
  r.avanzar(600_000);
  assert.equal(s.revisarReloj(), null);
});

test('cambiar de nodo reinicia la cuenta con el límite del nodo nuevo', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  r.avanzar(80_000);
  s.ejecutar('a_revisar_permiso'); // n02: 90 s nuevos
  assert.equal(s.restanteMs(), 90_000);
});

test('antes del plazo revisar el reloj no hace nada', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  for (const a of HASTA_ALARMA) s.ejecutar(a); // n05: 25 s
  r.avanzar(24_999);
  assert.equal(s.revisarReloj(), null);
  assert.equal(s.estadoActual().nodo!.id, 'n05_alarma');
});

test('al vencer el plazo se agota el tiempo una sola vez', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  for (const a of HASTA_ALARMA) s.ejecutar(a);
  r.avanzar(25_000);
  const p = s.revisarReloj();
  assert.ok(p);
  assert.equal(p.estado.criterios.c_alarma, 'incorrecto');
  assert.equal(p.estado.fase, 'terminada');
  assert.equal(s.revisarReloj(), null);
});

test('un límite orientativo se registra una vez y no se repite en cada cuadro', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar(); // n01: 90 s sin al_agotar_tiempo
  r.avanzar(90_000);
  assert.ok(s.revisarReloj());
  r.avanzar(90_000);
  assert.equal(s.revisarReloj(), null);
  assert.equal(s.eventos().filter((e) => e.tipo === 'tiempo_agotado').length, 1);
  assert.equal(s.restanteMs(), null);
});

test('el evento de tiempo agotado lleva la hora del vencimiento, no la de la revisión', () => {
  const r = relojFalso(0);
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  for (const a of HASTA_ALARMA) s.ejecutar(a); // entra a n05 en t=0
  r.avanzar(70_000); // el visor se durmió: se revisa 45 s tarde
  s.revisarReloj();
  const agotado = s.eventos().find((e) => e.tipo === 'tiempo_agotado')!;
  assert.equal(agotado.en_ms, 25_000);
  assert.equal(s.eventos().at(-1)!.en_ms, 25_000);
});

test('cada evento sale fechado con el reloj en el momento en que ocurrió', () => {
  const r = relojFalso(0);
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  r.avanzar(4_000);
  s.ejecutar('a_revisar_permiso');
  const ev = s.eventos();
  assert.deepEqual(ev.map((e) => [e.tipo, e.en_ms]), [
    ['inicio', 0], ['entrada_nodo', 0], ['accion', 4_000], ['entrada_nodo', 4_000],
  ]);
  assert.deepEqual(ev.map((e) => e.n), [1, 2, 3, 4]);
});

test('en pausa el plazo se congela y al reanudar sigue donde iba', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  for (const a of HASTA_ALARMA) s.ejecutar(a); // 25 s
  r.avanzar(10_000);
  s.pausar();
  r.avanzar(120_000);
  assert.equal(s.restanteMs(), 15_000);
  assert.equal(s.revisarReloj(), null, 'en pausa no vence');
  s.reanudar();
  assert.equal(s.restanteMs(), 15_000);
  r.avanzar(15_000);
  assert.ok(s.revisarReloj());
});

test('en pausa no se puede actuar', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  s.pausar();
  assert.equal(s.enPausa(), true);
  assert.equal(codigoDe(() => s.ejecutar('a_revisar_permiso')), 'en_pausa');
  s.reanudar();
  assert.equal(s.ejecutar('a_revisar_permiso').estado.nodo!.id, 'n02_atmosfera');
});

test('pausar antes de iniciar es un error de uso con su propio código', () => {
  const s = crearSesion(ec01(), relojFalso().reloj);
  assert.equal(codigoDe(() => s.pausar()), 'no_iniciada');
});

test('la duración no cuenta el tiempo en pausa y se detiene al terminar', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  r.avanzar(20_000);
  s.pausar();
  r.avanzar(300_000);
  assert.equal(s.duracionS(), 20);
  s.reanudar();
  r.avanzar(10_000);
  for (const a of [...HASTA_ALARMA, 'a_evacuar']) s.ejecutar(a);
  assert.equal(s.duracionS(), 30);
  r.avanzar(500_000);
  assert.equal(s.duracionS(), 30, 'terminada, ya no corre');
});

test('abandonar en pausa cierra la sesión y la duración excluye la pausa', () => {
  const r = relojFalso();
  const s = crearSesion(ec01(), r.reloj);
  s.iniciar();
  r.avanzar(5_000);
  s.pausar();
  r.avanzar(60_000);
  const e = s.abandonar();
  assert.equal(e.veredicto, 'incompleta');
  assert.equal(s.enPausa(), false);
  assert.equal(s.duracionS(), 5);
  assert.equal(codigoDe(() => s.pausar()), 'ya_terminada');
});

test('el tiempo agotado que lleva a otro nodo arranca su plazo desde el vencimiento', () => {
  const d = ec01();
  // n05 al agotarse lleva a n06 (final) en EC-01; aquí lo desviamos a n04 (60 s).
  d.nodos.find((n) => n.id === 'n05_alarma')!.al_agotar_tiempo!.siguiente = 'n04_ingreso';
  const r = relojFalso(0);
  const s = crearSesion(d, r.reloj);
  s.iniciar();
  for (const a of HASTA_ALARMA) s.ejecutar(a);
  r.avanzar(40_000); // venció en t=25 s, se revisa en t=40 s
  s.revisarReloj();
  assert.equal(s.estadoActual().nodo!.id, 'n04_ingreso');
  assert.equal(s.restanteMs(), 45_000); // 60 s desde t=25 s
});

test('pausar antes de iniciar avisa que la sesión no ha empezado', () => {
  const s = crearSesion(ec01(), relojFalso().reloj);
  assert.equal(codigoDe(() => s.pausar()), 'no_iniciada');
});
