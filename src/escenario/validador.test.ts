import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validarEscenario, compuertaAlcanzabilidad, compuertaCobertura } from './validador.ts';
import { ec01, PELIGROS_EC01 } from './ejemplos/ec-01.ts';
import type { Escenario, Informe } from './tipos.ts';

const codigos = (i: Informe) => new Set(i.hallazgos.map((h) => h.codigo));
const nodo = (d: Escenario, id: string) => d.nodos.find((n) => n.id === id)!;
const accion = (d: Escenario, nid: string, aid: string) => nodo(d, nid).acciones.find((a) => a.id === aid)!;

// Cada prueba rompe el escenario de referencia de UNA forma y exige que la
// compuerta hable por la razón correcta. Si al romperlo la suite sigue verde,
// el hallazgo es la prueba.

test('el escenario de referencia pasa las tres compuertas', () => {
  const informe = validarEscenario(ec01(), PELIGROS_EC01);
  assert.deepEqual(informe.hallazgos, []);
  assert.equal(informe.ok, true);
});

// -------------------------------------------------------- compuerta 1
test('C1 detecta una clave obligatoria faltante', () => {
  const d = ec01();
  delete (d as Partial<Escenario>).rubrica;
  assert.ok(codigos(validarEscenario(d)).has('falta_clave'));
});

test('C1 detecta pesos que no suman 100', () => {
  const d = ec01();
  d.rubrica[0]!.peso = 19;
  assert.ok(codigos(validarEscenario(d)).has('pesos_no_suman_100'));
});

test('C1 detecta menos de dos criterios críticos', () => {
  const d = ec01();
  for (const c of d.rubrica) c.critico = false;
  d.rubrica[0]!.critico = true;
  assert.ok(codigos(validarEscenario(d)).has('criticos_insuficientes'));
});

test('C1 detecta un entorno inexistente', () => {
  const d = ec01();
  nodo(d, 'n03_apertura').entorno = 'e99_fantasma';
  assert.ok(codigos(validarEscenario(d)).has('entorno_inexistente'));
});

test('C1 detecta una acción que evalúa un criterio que no está en la rúbrica', () => {
  const d = ec01();
  accion(d, 'n01_permiso', 'a_revisar_permiso').evalua = 'c_inventado';
  assert.ok(codigos(validarEscenario(d)).has('criterio_inexistente'));
});

test('C1 detecta un objeto que no está en el inventario', () => {
  const d = ec01();
  accion(d, 'n04_ingreso', 'a_arnes').objeto = 'escalera_que_no_existe';
  assert.ok(codigos(validarEscenario(d)).has('objeto_inexistente'));
});

test('C1 detecta una acción que apunta a un nodo inexistente', () => {
  const d = ec01();
  accion(d, 'n02_atmosfera', 'a_medir').siguiente = 'n99';
  assert.ok(codigos(validarEscenario(d)).has('nodo_siguiente_inexistente'));
});

test('C1 detecta un canal que el instrumento no tiene', () => {
  const d = ec01();
  nodo(d, 'n05_alarma').al_entrar![0]!.canal = 'CH4';
  assert.ok(codigos(validarEscenario(d)).has('canal_inexistente'));
});

test('C1 detecta un requisito que ninguna acción produce', () => {
  const d = ec01();
  nodo(d, 'n03_apertura').requiere!.push('ventilacion_forzada');
  assert.ok(codigos(validarEscenario(d)).has('marca_nunca_producida'));
});

test('C1 detecta un bloque de validación prellenado', () => {
  const d = ec01();
  d.validacion.validado_por = 'quien sea';
  d.validacion.estado = 'validado';
  assert.ok(codigos(validarEscenario(d)).has('validacion_prellenada'));
});

test('C1 detecta texto sin traducir en un idioma declarado', () => {
  const d = ec01();
  d.idiomas.push('en');
  assert.ok(codigos(validarEscenario(d)).has('idioma_faltante'));
});

test('C1 detecta una acción incorrecta sin retroalimentación', () => {
  const d = ec01();
  delete accion(d, 'n05_alarma', 'a_verificar_lectura').retroalimentacion;
  assert.ok(codigos(validarEscenario(d)).has('falta_retroalimentacion'));
});

test('C1 detecta identificadores duplicados', () => {
  const d = ec01();
  d.rubrica[4]!.id = 'c_permiso';
  assert.ok(codigos(validarEscenario(d)).has('id_duplicado'));
});

test('C1 exige al_faltar_requisito en un nodo con requisitos', () => {
  const d = ec01();
  delete nodo(d, 'n04_ingreso').al_faltar_requisito;
  assert.ok(codigos(validarEscenario(d)).has('falta_al_faltar_requisito'));
});

test('C1 detecta la norma prellenada en el bloque de validación', () => {
  const d = ec01();
  d.validacion.norma = 'Resolución 0491 de 2020';
  assert.ok(codigos(validarEscenario(d)).has('validacion_prellenada'));
});

test('C1 detecta un desenlace que evalúa un criterio que no está en la rúbrica', () => {
  const d = ec01();
  nodo(d, 'n05_alarma').al_agotar_tiempo!.evalua = 'c_inventado';
  assert.ok(codigos(validarEscenario(d)).has('criterio_inexistente'));
  const e = ec01();
  nodo(e, 'n03_apertura').al_faltar_requisito!.evalua = 'c_inventado';
  assert.ok(codigos(validarEscenario(e)).has('criterio_inexistente'));
});

test('C1 detecta al_faltar_requisito apuntando a un nodo inexistente', () => {
  const d = ec01();
  nodo(d, 'n03_apertura').al_faltar_requisito!.siguiente = 'n99';
  assert.ok(codigos(validarEscenario(d)).has('nodo_siguiente_inexistente'));
});

test('C1 detecta un desenlace incorrecto sin retroalimentación', () => {
  const d = ec01();
  delete nodo(d, 'n04_ingreso').al_faltar_requisito!.retroalimentacion;
  assert.ok(codigos(validarEscenario(d)).has('falta_retroalimentacion'));
});

// Traduce al inglés todo campo de texto del documento, para probar que el
// validador revisa cada uno y no solo la situación y la etiqueta.
function bilingue(): Escenario {
  const d = ec01();
  d.idiomas.push('en');
  const visitar = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(visitar); return; }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o['es-CO'] === 'string') { o.en = `EN ${o['es-CO']}`; return; }
      Object.values(o).forEach(visitar);
    }
  };
  visitar(d);
  return d;
}

test('C1 acepta un escenario traducido entero a los dos idiomas', () => {
  assert.deepEqual(validarEscenario(bilingue(), PELIGROS_EC01).hallazgos, []);
});

test('C1 detecta retroalimentación sin traducir', () => {
  const d = bilingue();
  delete accion(d, 'n02_atmosfera', 'a_medir_despues').retroalimentacion!.en;
  assert.ok(codigos(validarEscenario(d)).has('idioma_faltante'));
  const e = bilingue();
  delete nodo(e, 'n05_alarma').al_agotar_tiempo!.retroalimentacion!.en;
  assert.ok(codigos(validarEscenario(e)).has('idioma_faltante'));
});

test('C1 detecta título, rúbrica o inventario sin traducir', () => {
  for (const romper of [
    (d: Escenario) => { delete d.titulo.en; },
    (d: Escenario) => { delete d.rubrica[2]!.etiqueta.en; },
    (d: Escenario) => { delete d.inventario[0]!.etiqueta.en; },
  ]) {
    const d = bilingue();
    romper(d);
    assert.ok(codigos(validarEscenario(d)).has('idioma_faltante'));
  }
});

// -------------------------------------------------------- compuerta 2
test('C2 detecta un nodo al que no se llega', () => {
  const d = ec01();
  for (const a of nodo(d, 'n04_ingreso').acciones) a.siguiente = 'n06_cierre';
  const c = new Set(compuertaAlcanzabilidad(d).map((h) => h.codigo));
  assert.ok(c.has('nodo_inalcanzable'));
});

test('C2 detecta un nodo desde el que el trabajador queda trabado', () => {
  const d = ec01();
  d.nodos.push({
    id: 'n07_limbo',
    entorno: 'e03_interior',
    situacion: { 'es-CO': 'Nodo que se devuelve a sí mismo.' },
    acciones: [{
      id: 'a_girar',
      etiqueta: { 'es-CO': 'Dar vueltas' },
      resultado: 'incorrecto',
      evalua: 'c_alarma',
      retroalimentacion: { 'es-CO': 'Sin salida.' },
      siguiente: 'n07_limbo',
    }],
  });
  accion(d, 'n05_alarma', 'a_verificar_lectura').siguiente = 'n07_limbo';
  const c = new Set(compuertaAlcanzabilidad(d).map((h) => h.codigo));
  assert.ok(c.has('final_inalcanzable'));
});

test('C2 detecta que no hay ningún nodo final', () => {
  const d = ec01();
  delete nodo(d, 'n06_cierre').final;
  nodo(d, 'n06_cierre').acciones = [];
  const c = new Set(compuertaAlcanzabilidad(d).map((h) => h.codigo));
  assert.ok(c.has('sin_nodo_final'));
});

test('C2 detecta un criterio de la rúbrica que ningún nodo evalúa', () => {
  const d = ec01();
  for (const a of nodo(d, 'n04_ingreso').acciones) a.evalua = 'c_permiso';
  d.nodos.find((n) => n.id === 'n04_ingreso')!.al_faltar_requisito!.evalua = 'c_permiso';
  const c = new Set(compuertaAlcanzabilidad(d).map((h) => h.codigo));
  assert.ok(c.has('criterio_no_evaluado'));
});

test('C2 detecta que haciendo todo bien no se aprueba', () => {
  const d = ec01();
  d.puntaje_aprobacion = 101;
  assert.ok(codigos(validarEscenario(d)).has('ruta_correcta_no_aprueba'));
});

test('C2 detecta un criterio crítico que no se alcanza ni haciendo todo bien', () => {
  const d = ec01();
  accion(d, 'n05_alarma', 'a_evacuar').evalua = 'c_epp';
  const c = new Set(compuertaAlcanzabilidad(d).map((h) => h.codigo));
  assert.ok(c.has('critico_fuera_de_ruta'));
});

test('C2 detecta un nodo sin ninguna acción correcta', () => {
  const d = ec01();
  accion(d, 'n02_atmosfera', 'a_medir').resultado = 'incorrecto';
  const c = new Set(compuertaAlcanzabilidad(d).map((h) => h.codigo));
  assert.ok(c.has('nodo_sin_accion_correcta'));
});

test('C2 detecta que la ruta correcta llega a un nodo con un requisito incumplido', () => {
  const d = ec01();
  for (const a of nodo(d, 'n01_permiso').acciones) a.siguiente = 'n03_apertura';
  const c = new Set(compuertaAlcanzabilidad(d).map((h) => h.codigo));
  assert.ok(c.has('ruta_correcta_incumple_requisito'));
});

// -------------------------------------------------------- compuerta 3
test('C3 detecta un peligro de la matriz que ningún nodo pone en juego', () => {
  const h = compuertaCobertura(ec01(), [...PELIGROS_EC01, 'P-EC-99']);
  assert.equal(h.length, 1);
  assert.equal(h[0]!.codigo, 'peligro_no_cubierto');
});

test('C3 no reporta nada cuando todos los peligros exigidos están cubiertos', () => {
  assert.deepEqual(compuertaCobertura(ec01(), PELIGROS_EC01), []);
});
