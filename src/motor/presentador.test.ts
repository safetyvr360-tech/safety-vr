import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { presentar, traducir, idiomaDeContenido } from './presentador.ts';
import type { Catalogos, Idioma } from './presentador.ts';
import { crearMaquina } from './maquina.ts';
import type { Paso } from './maquina.ts';
import { ec01 } from '../escenario/ejemplos/ec-01.ts';
import type { Escenario } from '../escenario/tipos.ts';

const leer = (i: Idioma) => JSON.parse(readFileSync(new URL(`../../mensajes/${i}.json`, import.meta.url), 'utf8'));
const CATALOGOS: Catalogos = { 'es-CO': leer('es-CO'), en: leer('en') };

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

function vistaTras(acciones: string[], idioma: Idioma = 'es-CO', doc: Escenario = ec01(), restanteMs: number | null = null) {
  const m = crearMaquina(doc);
  m.iniciar();
  let paso: Paso | null = null;
  for (const a of acciones) paso = m.ejecutar(a);
  return presentar({ doc, estado: m.estadoActual(), catalogos: CATALOGOS, idioma, ultimoPaso: paso, restanteMs });
}

test('traducir interpola variables y falla con una clave o variable inexistente', () => {
  assert.equal(traducir({ a: 'Hola {x}' }, 'a', { x: 'usted' }), 'Hola usted');
  assert.throws(() => traducir({}, 'no.existe'), /clave_de_catalogo_inexistente/);
  assert.throws(() => traducir({ a: '{x}' }, 'a'), /variable_faltante/);
});

test('la vista inicial muestra la situación, las acciones y el entorno en español', () => {
  const v = vistaTras([]);
  assert.equal(v.encabezado.codigo, 'EC-01');
  assert.equal(v.entorno!.fuente, 'blob/pan-tanque-exterior-4k');
  assert.match(v.situacion!, /tanque TK-204/);
  assert.deepEqual(v.acciones.map((a) => a.id), ['a_revisar_permiso', 'a_subir_directo']);
  assert.equal(v.acciones[0]!.objeto, 'Usa: Permiso de trabajo en espacio confinado');
  assert.equal(v.acciones[1]!.objeto, null);
  assert.equal(v.aviso_idioma, null);
  assert.equal(v.cierre, null);
});

test('la retroalimentación lleva el tono del resultado de la última acción', () => {
  assert.equal(vistaTras(['a_revisar_permiso']).retroalimentacion!.tono, 'correcto');
  const mal = vistaTras(['a_subir_directo']);
  assert.equal(mal.retroalimentacion!.tono, 'incorrecto');
  assert.match(mal.retroalimentacion!.texto, /permiso estaba vencido|sin verificar el permiso/);
});

test('con el escenario traducido, la vista en inglés usa el texto inglés y la interfaz inglesa', () => {
  const v = vistaTras(['a_revisar_permiso'], 'en', bilingue());
  assert.equal(v.idioma_contenido, 'en');
  assert.equal(v.aviso_idioma, null);
  assert.match(v.situacion!, /^EN /);
  assert.ok(v.acciones.every((a) => a.texto.startsWith('EN ')));
  assert.equal(v.rubrica[0]!.estado, 'Correct');
  assert.equal(v.rubrica[1]!.estado, 'Not assessed');
});

test('si el escenario no está en el idioma pedido, se muestra en el suyo y se avisa, sin mezclar', () => {
  const v = vistaTras([], 'en'); // EC-01 solo declara es-CO
  assert.equal(v.idioma_contenido, 'es-CO');
  assert.equal(v.aviso_idioma, 'This scenario is not available in English. It is shown in Spanish.');
  assert.match(v.situacion!, /Lo asignaron/);
  assert.equal(idiomaDeContenido(ec01(), 'en'), 'es-CO');
});

test('los números se formatean según el idioma: coma decimal en es-CO, punto en inglés', () => {
  const es = vistaTras([]);
  const o2 = (v: typeof es) => v.instrumentos[0]!.canales.find((c) => c.clave === 'O2')!;
  assert.equal(o2(es).valor, '20,9');
  assert.equal(o2(es).rango, '19,5–23,5');
  const en = vistaTras([], 'en', bilingue());
  assert.equal(o2(en).valor, '20.9');
});

test('la alarma del instrumento aparece como alerta legible', () => {
  const v = vistaTras(['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes']);
  const h2s = v.instrumentos[0]!.canales.find((c) => c.clave === 'H2S')!;
  assert.equal(h2s.alarma, true);
  assert.equal(h2s.valor, '18');
  assert.deepEqual(v.alarmas, ['Detector de cuatro gases: alarma de H2S, fuera del rango seguro.']);
  assert.deepEqual(vistaTras([]).alarmas, []);
});

test('el reloj muestra segundos redondeados hacia arriba y se vuelve urgente al final', () => {
  const doc = ec01();
  const enAlarma = ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes']; // 25 s
  const r1 = vistaTras(enAlarma, 'es-CO', doc, 24_200).reloj!;
  assert.equal(r1.segundos, 25);
  assert.equal(r1.texto, '25 s restantes');
  assert.equal(r1.urgente, false);
  const r2 = vistaTras(enAlarma, 'es-CO', doc, 8_000).reloj!;
  assert.equal(r2.urgente, true);
  assert.equal(r2.fraccion, 8 / 25);
  assert.equal(vistaTras(['a_revisar_permiso', 'a_medir'], 'es-CO', doc, 5_000).reloj, null, 'n03 no tiene límite');
});

test('en pausa no se ofrecen acciones y se muestra el aviso', () => {
  const doc = ec01();
  const m = crearMaquina(doc);
  const estado = m.iniciar();
  const v = presentar({ doc, estado, catalogos: CATALOGOS, idioma: 'es-CO', enPausa: true });
  assert.deepEqual(v.acciones, []);
  assert.equal(v.pausa, 'En pausa. Póngase el visor para continuar.');
});

test('el cierre apto, no apto por crítico e incompleto usan el catálogo', () => {
  const apto = vistaTras(['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar']);
  assert.deepEqual(apto.cierre, { veredicto: 'apto', titulo: 'Apto', detalle: 'Cumplió el procedimiento y ningún criterio crítico falló.' });
  assert.deepEqual(apto.acciones, []);
  const noApto = vistaTras(['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_verificar_lectura']);
  assert.equal(noApto.cierre!.titulo, 'No apto');
  assert.equal(noApto.cierre!.detalle, 'Criterios críticos fallados: Reacción ante alarma de gas.');
  assert.equal(noApto.puntaje, 'Puntaje 80 de 100. Se aprueba con 80.');
  const doc = ec01();
  const m = crearMaquina(doc);
  m.iniciar();
  const inc = presentar({ doc, estado: m.abandonar(), catalogos: CATALOGOS, idioma: 'en' });
  assert.equal(inc.cierre!.titulo, 'Incomplete');
});

test('no apto por puntaje, sin críticos fallados, lo dice así', () => {
  const doc = ec01();
  doc.puntaje_aprobacion = 90;
  const v = vistaTras(['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_bajar_sin_arnes', 'a_evacuar'], 'es-CO', doc);
  assert.equal(v.cierre!.detalle, 'No alcanzó el puntaje de aprobación.');
});

test('la vista no sopla la respuesta', () => {
  const plano = JSON.stringify(vistaTras([]).acciones);
  assert.ok(!/correcto|incorrecto|c_permiso|n02_atmosfera/.test(plano));
});

test('un acierto que entra a un nodo con requisito faltante muestra el error en tono incorrecto', () => {
  // Sin permiso, medir bien lleva a n03, que exige el permiso.
  const v = vistaTras(['a_subir_directo', 'a_medir']);
  assert.match(v.retroalimentacion!.texto, /sin haber medido la atmósfera/);
  assert.equal(v.retroalimentacion!.tono, 'incorrecto');
});
