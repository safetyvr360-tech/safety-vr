import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  identidad, invertir, multiplicar, perspectiva, rayoDesdePantalla, rayoDesdePose,
  rotacionX, rotacionY, transformarPunto, traslacion, vistaDesdeAngulos,
} from './matematica.ts';
import type { Vec3 } from './matematica.ts';

const cerca = (a: number, b: number, eps = 1e-5) => Math.abs(a - b) < eps;
const igualVec = (a: Vec3, b: Vec3, eps = 1e-5) => assert.ok(a.every((x, i) => cerca(x, b[i]!, eps)), `${a} ≠ ${b}`);

test('multiplicar por la identidad deja la matriz igual', () => {
  const m = multiplicar(rotacionY(0.7), traslacion(1, 2, 3));
  assert.deepEqual([...multiplicar(m, identidad())], [...m]);
  assert.deepEqual([...multiplicar(identidad(), m)], [...m]);
});

test('una matriz por su inversa es la identidad', () => {
  const m = multiplicar(multiplicar(rotacionY(0.4), rotacionX(-0.3)), traslacion(0.5, -1, 2));
  const p = multiplicar(m, invertir(m));
  for (let i = 0; i < 16; i += 1) assert.ok(cerca(p[i]!, identidad()[i]!), `posición ${i}: ${p[i]}`);
  assert.throws(() => invertir(new Float32Array(16)), /matriz_singular/);
});

test('rotar 90° a la izquierda lleva el frente (−Z) hacia −X', () => {
  igualVec(transformarPunto(rotacionY(Math.PI / 2), [0, 0, -1]), [-1, 0, 0]);
  igualVec(transformarPunto(rotacionX(Math.PI / 2), [0, 0, -1]), [0, 1, 0], 1e-6);
});

test('la proyección lleva el centro del cuadro cercano al centro de la pantalla', () => {
  const p = perspectiva(Math.PI / 2, 1, 0.1, 100);
  const enPantalla = transformarPunto(p, [0, 0, -0.1]);
  igualVec(enPantalla, [0, 0, -1]);
  const borde = transformarPunto(p, [1, 0, -1]); // 45° con fov de 90°
  assert.ok(cerca(borde[0], 1));
});

test('la proyección respeta la proporción de la pantalla', () => {
  // Pantalla el doble de ancha que de alta, 90° verticales: a 45° hacia un lado
  // el punto cae a mitad de camino del borde, no en el borde.
  const p = perspectiva(Math.PI / 2, 2, 0.1, 100);
  assert.ok(cerca(transformarPunto(p, [1, 0, -1])[0], 0.5));
  assert.ok(cerca(transformarPunto(p, [0, 1, -1])[1], 1));
});

test('el rayo por el centro de la pantalla apunta hacia donde mira la cámara', () => {
  const proy = perspectiva(70 * Math.PI / 180, 16 / 9, 0.05, 100);
  const r = rayoDesdePantalla(proy, vistaDesdeAngulos(0, 0), 0, 0);
  igualVec(r.direccion, [0, 0, -1]);
  const girado = rayoDesdePantalla(proy, vistaDesdeAngulos(Math.PI / 2, 0), 0, 0);
  igualVec(girado.direccion, [-1, 0, 0]);
  const arriba = rayoDesdePantalla(proy, vistaDesdeAngulos(0, 0), 0, 1);
  assert.ok(arriba.direccion[1] > 0.5, 'el borde superior de la pantalla mira hacia arriba');
});

test('el rayo de una pose de WebXR sale de su origen hacia su −Z', () => {
  const pose = multiplicar(traslacion(0.2, -0.3, -0.1), rotacionY(Math.PI / 2));
  const r = rayoDesdePose(pose);
  igualVec(r.origen, [0.2, -0.3, -0.1]);
  igualVec(r.direccion, [-1, 0, 0]);
});
