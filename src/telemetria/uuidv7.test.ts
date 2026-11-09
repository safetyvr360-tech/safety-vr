import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crearGeneradorUuidv7, FORMATO_UUIDV7, msDeUuidv7 } from './uuidv7.ts';

const azarFijo = (v: number) => (b: Uint8Array) => b.fill(v);

test('el id tiene formato UUIDv7: versión 7 y variante RFC', () => {
  const g = crearGeneradorUuidv7(() => 1_794_112_000_000);
  for (let i = 0; i < 50; i += 1) assert.match(g(), FORMATO_UUIDV7);
  const conAzarExtremo = crearGeneradorUuidv7(() => 1_794_112_000_000, azarFijo(0xff));
  assert.match(conAzarExtremo(), FORMATO_UUIDV7);
});

test('los primeros 48 bits son los milisegundos Unix', () => {
  const ms = Date.UTC(2026, 10, 8, 7, 30);
  const id = crearGeneradorUuidv7(() => ms)();
  assert.equal(msDeUuidv7(id), ms);
});

test('dentro del mismo milisegundo los ids salen en orden y sin repetirse', () => {
  const g = crearGeneradorUuidv7(() => 1_000_000, azarFijo(0xff)); // arranque del contador alto
  const ids = Array.from({ length: 5_000 }, g);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), ids, 'orden lexicográfico = orden de creación');
});

test('si el reloj retrocede, el orden no se rompe', () => {
  let t = 2_000_000;
  const g = crearGeneradorUuidv7(() => t);
  const a = g();
  t = 1_000_000; // el reloj del visor se corrigió hacia atrás
  const b = g();
  assert.ok(a < b);
  assert.ok(msDeUuidv7(b) >= msDeUuidv7(a));
});

test('ids de milisegundos distintos se ordenan por fecha', () => {
  let t = 5_000;
  const g = crearGeneradorUuidv7(() => t);
  const a = g();
  t += 1;
  const b = g();
  assert.ok(a < b);
});
