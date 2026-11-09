import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crearMaquina, combinar, ErrorMotor } from './maquina.ts';
import type { Estado, Maquina } from './maquina.ts';
import { ec01 } from '../escenario/ejemplos/ec-01.ts';
import type { Escenario } from '../escenario/tipos.ts';

// Cada prueba nombra la regla del motor que defiende. Si se rompe esa regla en
// maquina.ts y la prueba sigue verde, el hallazgo es la prueba.

const RUTA_CORRECTA = ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar'];

const nodo = (d: Escenario, id: string) => d.nodos.find((n) => n.id === id)!;
const accion = (d: Escenario, nid: string, aid: string) => nodo(d, nid).acciones.find((a) => a.id === aid)!;

function correr(m: Maquina, acciones: string[]): Estado {
  m.iniciar();
  let e = m.estadoActual();
  for (const a of acciones) e = m.ejecutar(a).estado;
  return e;
}

function codigoDe(fn: () => unknown): string {
  try { fn(); } catch (e) { if (e instanceof ErrorMotor) return e.codigo; throw e; }
  return 'no_lanzo';
}

// ------------------------------------------------------------ ciclo de vida
test('antes de iniciar no hay nodo y no se puede actuar', () => {
  const m = crearMaquina(ec01());
  assert.equal(m.estadoActual().fase, 'sin_iniciar');
  assert.equal(m.estadoActual().nodo, null);
  assert.equal(codigoDe(() => m.ejecutar('a_revisar_permiso')), 'no_iniciada');
  assert.equal(codigoDe(() => m.agotarTiempo()), 'no_iniciada');
});

test('iniciar entra al primer nodo y no se puede iniciar dos veces', () => {
  const m = crearMaquina(ec01());
  const e = m.iniciar();
  assert.equal(e.fase, 'en_curso');
  assert.equal(e.nodo!.id, 'n01_permiso');
  assert.deepEqual(e.eventos.map((x) => x.tipo), ['inicio', 'entrada_nodo']);
  assert.equal(codigoDe(() => m.iniciar()), 'ya_iniciada');
});

test('el motor rechaza un escenario que no pasa el validador', () => {
  const d = ec01();
  d.rubrica[0]!.peso = 19;
  assert.equal(codigoDe(() => crearMaquina(d)), 'escenario_invalido');
});

// ------------------------------------------------------------ ruta y puntaje
test('haciendo todo bien EC-01 termina apto con 100 puntos', () => {
  const e = correr(crearMaquina(ec01()), RUTA_CORRECTA);
  assert.equal(e.fase, 'terminada');
  assert.equal(e.nodo!.id, 'n06_cierre');
  assert.equal(e.puntaje, 100);
  assert.equal(e.veredicto, 'apto');
  assert.deepEqual(e.criticos_fallidos, []);
  assert.deepEqual(e.marcas, ['atmosfera_medida', 'epp_puesto', 'permiso_verificado', 'vigia_designado']);
});

test('fallar un criterio crítico es no apto aunque el puntaje alcance', () => {
  // Dudar del detector: 80 puntos, justo el mínimo, y aun así no apto.
  const e = correr(crearMaquina(ec01()), ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_verificar_lectura']);
  assert.equal(e.puntaje, 80);
  assert.deepEqual(e.criticos_fallidos, ['c_alarma']);
  assert.equal(e.veredicto, 'no_apto');
});

test('saltarse el permiso también dispara el requisito faltante de n03', () => {
  // n03 exige permiso_verificado y su al_faltar_requisito evalúa c_medicion:
  // el error del permiso cuesta dos criterios críticos, no uno.
  const e = correr(crearMaquina(ec01()), ['a_subir_directo', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar']);
  assert.equal(e.puntaje, 55);
  assert.deepEqual(e.criticos_fallidos, ['c_permiso', 'c_medicion']);
  assert.equal(e.veredicto, 'no_apto');
});

test('fallar un criterio no crítico resta puntos pero puede aprobar', () => {
  const e = correr(crearMaquina(ec01()), ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_bajar_sin_arnes', 'a_evacuar']);
  assert.equal(e.puntaje, 85);
  assert.equal(e.criterios.c_epp, 'incorrecto');
  assert.equal(e.veredicto, 'apto');
});

test('quedar por debajo del puntaje de aprobación es no apto', () => {
  const d = ec01();
  d.puntaje_aprobacion = 90;
  const e = correr(crearMaquina(d), ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_bajar_sin_arnes', 'a_evacuar']);
  assert.equal(e.puntaje, 85);
  assert.deepEqual(e.criticos_fallidos, []);
  assert.equal(e.veredicto, 'no_apto');
});

test('un resultado parcial vale la mitad del peso', () => {
  const d = ec01();
  accion(d, 'n04_ingreso', 'a_bajar_sin_arnes').resultado = 'parcial';
  const e = correr(crearMaquina(d), ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_bajar_sin_arnes', 'a_evacuar']);
  assert.equal(e.puntaje, 93); // 85 + 7,5 redondeado
  assert.equal(e.criterios.c_epp, 'parcial');
});

test('durante la sesión un crítico sin evaluar no figura como fallado', () => {
  const m = crearMaquina(ec01());
  assert.deepEqual(m.iniciar().criticos_fallidos, []);
  const p = m.ejecutar('a_subir_directo');
  assert.deepEqual(p.estado.criticos_fallidos, ['c_permiso']);
  assert.equal(p.estado.veredicto, null);
});

test('al cerrar, un crítico que nunca se calificó cuenta como fallado', () => {
  const m = crearMaquina(ec01());
  m.iniciar();
  m.ejecutar('a_revisar_permiso');
  const e = m.abandonar();
  assert.deepEqual(e.criticos_fallidos, ['c_medicion', 'c_vigia', 'c_alarma']);
});

test('combinar se queda con el peor resultado: un error no se borra acertando', () => {
  assert.equal(combinar(undefined, 'correcto'), 'correcto');
  assert.equal(combinar('correcto', 'incorrecto'), 'incorrecto');
  assert.equal(combinar('incorrecto', 'correcto'), 'incorrecto');
  assert.equal(combinar('parcial', 'correcto'), 'parcial');
  assert.equal(combinar('parcial', 'incorrecto'), 'incorrecto');
});

// ------------------------------------------------------------ requisitos
test('entrar a un nodo sin el requisito califica, retroalimenta y deja seguir', () => {
  const m = crearMaquina(ec01());
  m.iniciar();
  m.ejecutar('a_revisar_permiso');
  const p = m.ejecutar('a_medir_despues'); // no produce atmosfera_medida
  assert.equal(p.estado.nodo!.id, 'n03_apertura');
  assert.equal(p.estado.criterios.c_medicion, 'incorrecto');
  assert.match(p.retroalimentacion!['es-CO']!, /sin haber medido la atmósfera/);
  assert.ok(p.estado.eventos.some((e) => e.tipo === 'requisito_faltante' && e.nodo === 'n03_apertura'));
  assert.equal(p.estado.nodo!.acciones.length, 2, 'el trabajador sigue con las acciones del nodo');
  const sigue = m.ejecutar('a_designar_vigia');
  assert.equal(sigue.estado.nodo!.id, 'n04_ingreso');
});

test('con los requisitos cumplidos no se aplica al_faltar_requisito', () => {
  const m = crearMaquina(ec01());
  m.iniciar();
  m.ejecutar('a_revisar_permiso');
  const p = m.ejecutar('a_medir');
  assert.equal(p.estado.criterios.c_medicion, 'correcto');
  assert.ok(!p.estado.eventos.some((e) => e.tipo === 'requisito_faltante'));
  assert.match(p.retroalimentacion!['es-CO']!, /La medición se hace desde afuera/);
});

test('al_faltar_requisito con siguiente salta a ese nodo', () => {
  const d = ec01();
  nodo(d, 'n04_ingreso').al_faltar_requisito!.siguiente = 'n06_cierre';
  const m = crearMaquina(d);
  m.iniciar();
  m.ejecutar('a_revisar_permiso');
  m.ejecutar('a_medir');
  const p = m.ejecutar('a_abrir_primero'); // n04 exige vigia_designado
  assert.equal(p.estado.nodo!.id, 'n06_cierre');
  assert.equal(p.estado.fase, 'terminada');
  assert.equal(p.estado.veredicto, 'no_apto');
});

// ------------------------------------------------------------ tiempo
test('agotar el tiempo con desenlace califica y mueve al nodo indicado', () => {
  const m = crearMaquina(ec01());
  correr(m, ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes']);
  const p = m.agotarTiempo();
  assert.equal(p.resultado, 'incorrecto');
  assert.equal(p.estado.criterios.c_alarma, 'incorrecto');
  assert.equal(p.estado.nodo!.id, 'n06_cierre');
  assert.equal(p.estado.veredicto, 'no_apto');
  assert.match(p.retroalimentacion!['es-CO']!, /No reaccionó/);
});

test('agotar el tiempo sin desenlace solo se registra y no penaliza', () => {
  const m = crearMaquina(ec01());
  m.iniciar();
  const p = m.agotarTiempo(); // n01 tiene 90 s y no declara al_agotar_tiempo
  assert.equal(p.resultado, null);
  assert.equal(p.estado.nodo!.id, 'n01_permiso');
  assert.deepEqual(p.estado.criterios, {});
  assert.equal(p.estado.eventos.at(-1)!.tipo, 'tiempo_agotado');
});

test('agotar el tiempo en un nodo sin límite es un error del adaptador', () => {
  const m = crearMaquina(ec01());
  correr(m, ['a_revisar_permiso', 'a_medir']); // n03 no tiene tiempo_limite_s
  assert.equal(codigoDe(() => m.agotarTiempo()), 'sin_limite_de_tiempo');
});

// ------------------------------------------------------------ instrumentos
test('al_entrar fija la lectura y la alarma del instrumento', () => {
  const m = crearMaquina(ec01());
  m.iniciar();
  const h2s = (e: Estado) => e.instrumentos.detector4!.find((l) => l.clave === 'H2S')!;
  assert.equal(h2s(m.estadoActual()).valor, 0);
  assert.equal(h2s(m.estadoActual()).alarma, false);
  const e = correr(crearMaquina(ec01()), ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes']);
  assert.equal(e.nodo!.id, 'n05_alarma');
  assert.equal(h2s(e).valor, 18);
  assert.equal(h2s(e).alarma, true);
  assert.equal(h2s(e).fuera_de_rango, true);
});

// ------------------------------------------------------------ errores de uso
test('una acción que no es del nodo actual se rechaza sin cambiar nada', () => {
  const m = crearMaquina(ec01());
  m.iniciar();
  const antes = m.estadoActual();
  assert.equal(codigoDe(() => m.ejecutar('a_medir')), 'accion_inexistente');
  assert.equal(codigoDe(() => m.ejecutar('no_existe')), 'accion_inexistente');
  assert.deepEqual(m.estadoActual(), antes);
});

test('después de terminar no se puede actuar ni abandonar', () => {
  const m = crearMaquina(ec01());
  correr(m, RUTA_CORRECTA);
  assert.equal(codigoDe(() => m.ejecutar('a_evacuar')), 'ya_terminada');
  assert.equal(codigoDe(() => m.agotarTiempo()), 'ya_terminada');
  assert.equal(codigoDe(() => m.abandonar()), 'ya_terminada');
});

test('siguiente null termina la sesión', () => {
  const d = ec01();
  accion(d, 'n05_alarma', 'a_verificar_lectura').siguiente = null;
  const e = correr(crearMaquina(d), ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_verificar_lectura']);
  assert.equal(e.fase, 'terminada');
  assert.equal(e.nodo!.id, 'n05_alarma');
  assert.equal(e.veredicto, 'no_apto');
});

// ------------------------------------------------------------ directiva 6
test('desde cualquier punto de la sesión abandonar lleva a un estado final', () => {
  for (let k = 0; k < RUTA_CORRECTA.length; k += 1) {
    const m = crearMaquina(ec01());
    correr(m, RUTA_CORRECTA.slice(0, k));
    const e = m.abandonar();
    assert.equal(e.fase, 'abandonada');
    assert.equal(e.veredicto, 'incompleta');
    assert.equal(codigoDe(() => m.ejecutar('a_evacuar')), 'ya_terminada');
  }
  const sinIniciar = crearMaquina(ec01());
  assert.equal(sinIniciar.abandonar().veredicto, 'incompleta');
});

test('todas las combinaciones de decisiones de EC-01 terminan: nadie queda trabado', () => {
  const doc = ec01();
  let finales = 0;
  const explorar = (camino: string[], tiempo: boolean[]) => {
    if (camino.length > 20) assert.fail(`camino sin fin: ${camino.join(' > ')}`);
    const m = crearMaquina(doc);
    m.iniciar();
    let e = m.estadoActual();
    camino.forEach((a, i) => { e = tiempo[i] ? m.agotarTiempo().estado : m.ejecutar(a).estado; });
    if (e.fase === 'terminada') {
      finales += 1;
      assert.ok(e.veredicto === 'apto' || e.veredicto === 'no_apto');
      return;
    }
    for (const a of e.nodo!.acciones) explorar([...camino, a.id], [...tiempo, false]);
    const n = doc.nodos.find((x) => x.id === e.nodo!.id)!;
    if (n.al_agotar_tiempo?.siguiente) explorar([...camino, '(tiempo)'], [...tiempo, true]);
  };
  explorar([], []);
  assert.equal(finales, 48); // 2·2·2·2·(2 acciones + tiempo agotado)
});

// ------------------------------------------------------------ doble ciega del contenido
test('el estado visible no sopla la respuesta: sin resultado, evalua ni siguiente', () => {
  const m = crearMaquina(ec01());
  const e = m.iniciar();
  for (const a of e.nodo!.acciones) {
    assert.deepEqual(Object.keys(a).sort(), a.objeto ? ['etiqueta', 'id', 'objeto'] : ['etiqueta', 'id']);
  }
  const plano = JSON.stringify(e.nodo);
  assert.ok(!plano.includes('correcto') && !plano.includes('c_permiso') && !plano.includes('n02_atmosfera'));
});

// ------------------------------------------------------------ aislamiento del estado
test('mutar el estado devuelto o el documento original no altera la sesión', () => {
  const d = ec01();
  const m = crearMaquina(d);
  const e = m.iniciar();
  e.marcas.push('permiso_verificado');
  e.nodo!.acciones.length = 0;
  e.instrumentos.detector4![0]!.valor = 0;
  accion(d, 'n01_permiso', 'a_subir_directo').resultado = 'correcto';
  const otra = m.estadoActual();
  assert.deepEqual(otra.marcas, []);
  assert.equal(otra.nodo!.acciones.length, 2);
  assert.equal(otra.instrumentos.detector4![0]!.valor, 20.9);
  assert.equal(m.ejecutar('a_subir_directo').resultado, 'incorrecto');
});

// ------------------------------------------------------------ eventos para xAPI
test('cada decisión deja un evento con nodo, criterio y resultado', () => {
  const e = correr(crearMaquina(ec01()), RUTA_CORRECTA);
  const acciones = e.eventos.filter((x) => x.tipo === 'accion');
  assert.deepEqual(acciones.map((x) => [x.nodo, x.accion, x.criterio, x.resultado]), [
    ['n01_permiso', 'a_revisar_permiso', 'c_permiso', 'correcto'],
    ['n02_atmosfera', 'a_medir', 'c_medicion', 'correcto'],
    ['n03_apertura', 'a_designar_vigia', 'c_vigia', 'correcto'],
    ['n04_ingreso', 'a_arnes', 'c_epp', 'correcto'],
    ['n05_alarma', 'a_evacuar', 'c_alarma', 'correcto'],
  ]);
  assert.deepEqual(e.eventos.map((x) => x.n), e.eventos.map((_, i) => i + 1));
  assert.equal(e.eventos.at(-1)!.tipo, 'fin');
  assert.equal(e.eventos.at(-1)!.veredicto, 'apto');
  assert.equal(e.eventos.at(-1)!.puntaje, 100, 'el cierre lleva el puntaje');
});

test('el estado dice a qué resultado corresponde la retroalimentación visible', () => {
  const m = crearMaquina(ec01());
  assert.equal(m.iniciar().retroalimentacion_resultado, null);
  assert.equal(m.ejecutar('a_subir_directo').estado.retroalimentacion_resultado, 'incorrecto');
  const p = m.ejecutar('a_medir'); // acierto, pero n03 exige el permiso
  assert.equal(p.resultado, 'correcto');
  assert.equal(p.estado.retroalimentacion_resultado, 'incorrecto');
});
