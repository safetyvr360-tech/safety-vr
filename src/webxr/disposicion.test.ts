import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BOTON_REPETIR, PANELES, botonEn, disponerInstrumentos, disponerPrincipal, disponerRubrica,
  envolver, impactoEnPanel, impactoMasCercano,
} from './disposicion.ts';
import type { Dibujo, Medir, Op } from './disposicion.ts';
import { perspectiva, rayoDesdePantalla, vistaDesdeAngulos } from './matematica.ts';
import { presentar } from '../motor/presentador.ts';
import type { Catalogos, Idioma } from '../motor/presentador.ts';
import { crearMaquina } from '../motor/maquina.ts';
import type { Paso } from '../motor/maquina.ts';
import { ec01 } from '../escenario/ejemplos/ec-01.ts';

// Medidor de mentira: cada carácter ocupa la mitad del tamaño de letra.
const medir: Medir = (t, tam) => t.length * tam * 0.5;
const leer = (i: Idioma) => JSON.parse(readFileSync(new URL(`../../mensajes/${i}.json`, import.meta.url), 'utf8'));
const CATALOGOS: Catalogos = { 'es-CO': leer('es-CO'), en: leer('en') };
const principal = PANELES.find((p) => p.id === 'principal')!;

function vistaTras(acciones: string[]) {
  const doc = ec01();
  const m = crearMaquina(doc);
  m.iniciar();
  let paso: Paso | null = null;
  for (const a of acciones) paso = m.ejecutar(a);
  return presentar({ doc, estado: m.estadoActual(), catalogos: CATALOGOS, idioma: 'es-CO', ultimoPaso: paso, restanteMs: 20_000 });
}
const dibujar = (acciones: string[], resaltado: string | null = null): Dibujo =>
  disponerPrincipal(vistaTras(acciones), { ancho: principal.ancho_px, alto: principal.alto_px, medir, resaltado, textoRepetir: 'Repetir escenario' });
const textos = (d: Dibujo) => d.ops.filter((o): o is Extract<Op, { tipo: 'texto' }> => o.tipo === 'texto').map((o) => o.texto);
const fondo = (d: Dibujo) => Math.max(...d.ops.map((op) => ('h' in op ? op.y + op.h : op.y)).filter((_, i) => i > 0));

// ------------------------------------------------------------ geometría
test('mirando al frente, el centro de la vista cae en el centro del panel principal', () => {
  const i = impactoEnPanel({ origen: [0, 0, 0], direccion: [0, 0, -1] }, principal)!;
  assert.equal(i.panel, 'principal');
  assert.ok(Math.abs(i.u - 0.5) < 1e-6);
  assert.ok(Math.abs(i.t - principal.distancia) < 1e-6);
  assert.ok(Math.abs(i.v - (0.5 + principal.altura / principal.alto_m)) < 1e-6);
});

test('apuntar a la esquina superior izquierda del panel da los píxeles de esa esquina', () => {
  const p = principal;
  const x = -p.ancho_m / 2 + 0.01;
  const y = p.altura + p.alto_m / 2 - 0.01;
  const i = impactoEnPanel({ origen: [0, 0, 0], direccion: [x, y, -p.distancia] }, p)!;
  assert.ok(i.px < 15 && i.py < 15, `${i.px}, ${i.py}`);
});

test('un rayo que mira hacia atrás o fuera del panel no lo toca', () => {
  assert.equal(impactoEnPanel({ origen: [0, 0, 0], direccion: [0, 0, 1] }, principal), null);
  assert.equal(impactoEnPanel({ origen: [0, 0, 0], direccion: [0, 1, -0.2] }, principal), null);
});

test('girando 50° a la izquierda se mira el panel de instrumentos; a la derecha, la rúbrica', () => {
  const proy = perspectiva(1.2, 16 / 9, 0.05, 100);
  const izq = impactoMasCercano(rayoDesdePantalla(proy, vistaDesdeAngulos(50 * Math.PI / 180, -0.06), 0, 0));
  assert.equal(izq!.panel, 'instrumentos');
  const der = impactoMasCercano(rayoDesdePantalla(proy, vistaDesdeAngulos(-50 * Math.PI / 180, -0.06), 0, 0));
  assert.equal(der!.panel, 'rubrica');
  assert.equal(impactoMasCercano(rayoDesdePantalla(proy, vistaDesdeAngulos(Math.PI, 0), 0, 0)), null);
});

// ------------------------------------------------------------ texto
test('envolver parte en palabras sin pasarse del ancho', () => {
  const lineas = envolver('Revisar el permiso antes de hacer nada', 200, 20, 400, medir); // 20 caracteres por línea
  assert.deepEqual(lineas, ['Revisar el permiso', 'antes de hacer nada']);
  for (const l of lineas) assert.ok(medir(l, 20, 400) <= 200);
});

test('envolver respeta los saltos de línea y no corta una palabra larga', () => {
  assert.deepEqual(envolver('uno\ndos', 1000, 20, 400, medir), ['uno', 'dos']);
  assert.deepEqual(envolver('Supercalifragilístico sí', 50, 20, 400, medir), ['Supercalifragilístico', 'sí']);
});

// ------------------------------------------------------------ panel principal
test('el panel principal trae la situación y un botón por acción, en orden', () => {
  const d = dibujar([]);
  assert.deepEqual(d.botones.map((b) => b.id), ['a_revisar_permiso', 'a_subir_directo']);
  assert.ok(textos(d).some((t) => t.includes('Lo asignaron')));
  assert.ok(d.botones[0]!.y + d.botones[0]!.h <= d.botones[1]!.y, 'los botones no se pisan');
});

test('el botón bajo el rayo es el que se selecciona', () => {
  const d = dibujar([]);
  const b = d.botones[1]!;
  assert.equal(botonEn(d.botones, b.x + 5, b.y + b.h / 2), 'a_subir_directo');
  assert.equal(botonEn(d.botones, b.x - 5, b.y + b.h / 2), null);
  assert.equal(botonEn(d.botones, 10, 10), null);
});

test('el botón resaltado se dibuja distinto', () => {
  const normal = dibujar([]);
  const resaltado = dibujar([], 'a_revisar_permiso');
  const colorDe = (d: Dibujo) => d.ops.find((o) => o.tipo === 'rect' && o.x === d.botones[0]!.x && o.y === d.botones[0]!.y)!;
  assert.notDeepEqual(colorDe(normal), colorDe(resaltado));
});

test('con la alarma activa el panel muestra la alerta y el reloj', () => {
  const d = dibujar(['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes']);
  assert.ok(textos(d).some((t) => t.includes('alarma de H2S')));
  assert.ok(d.ops.some((o) => o.tipo === 'barra'));
  assert.ok(textos(d).includes('20 s restantes'));
});

test('el cierre muestra el veredicto y un único botón para repetir', () => {
  const d = dibujar(['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar']);
  assert.deepEqual(d.botones.map((b) => b.id), [BOTON_REPETIR]);
  assert.ok(textos(d).includes('APTO'));
  assert.ok(textos(d).includes('Repetir escenario'));
});

test('todo cabe en el panel: con mucho texto se reduce la letra', () => {
  const v = vistaTras(['a_subir_directo']);
  const largo = { ...v, situacion: `${v.situacion} `.repeat(8) };
  const d = disponerPrincipal(largo, { ancho: principal.ancho_px, alto: principal.alto_px, medir, resaltado: null, textoRepetir: 'R' });
  assert.ok(d.escala < 1, 'se redujo');
  assert.ok(d.escala >= 0.6, 'nunca por debajo del 60 %');
  const normal = dibujar([]);
  assert.equal(normal.escala, 1);
  assert.ok(fondo(normal) <= principal.alto_px - 40);
});

test('ningún texto del panel principal se sale por los lados', () => {
  for (const acciones of [[], ['a_subir_directo'], ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes']]) {
    const d = dibujar(acciones);
    for (const o of d.ops) {
      if (o.tipo === 'texto' && o.alinear !== 'centro' && o.alinear !== 'der') {
        assert.ok(o.x + medir(o.texto, o.tam, o.peso) <= principal.ancho_px - 40, `«${o.texto}» se sale`);
      }
    }
  }
});

// ------------------------------------------------------------ paneles laterales
test('el panel de instrumentos dibuja cada canal y marca la alarma en rojo', () => {
  const v = vistaTras(['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes']);
  const d = disponerInstrumentos(v, 800, 600, 'Instrumentos');
  const h2s = d.ops.find((o) => o.tipo === 'texto' && o.texto === 'H2S')!;
  assert.equal((h2s as Extract<Op, { tipo: 'texto' }>).color, 'mal');
  const o2 = d.ops.find((o) => o.tipo === 'texto' && o.texto === 'O2')!;
  assert.equal((o2 as Extract<Op, { tipo: 'texto' }>).color, 'pantalla_texto');
  assert.ok(textos(d).includes('20,9'));
  assert.ok(fondo(d) <= 600);
});

test('el panel de rúbrica muestra cada criterio con su estado y el puntaje', () => {
  const v = vistaTras(['a_subir_directo']);
  const d = disponerRubrica(v, 800, 800, 'Rúbrica', 'Crítico', medir);
  assert.ok(textos(d).includes('INCORRECTO · CRÍTICO'));
  assert.ok(textos(d).some((t) => t.startsWith('Puntaje 0 de 100')));
  assert.ok(fondo(d) <= 800);
});
