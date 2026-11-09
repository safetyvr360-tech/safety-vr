import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ALFABETO, digitoControl, generarCodigo, normalizarCodigo } from './codigo.ts';

const FORMA = /^SVR-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

test('el código tiene la forma SVR-XXXX-XXXX-XXXX y solo letras que no se confunden', () => {
  for (let i = 0; i < 200; i += 1) {
    const c = generarCodigo();
    assert.match(c, FORMA);
    assert.ok(!/[ILOU]/.test(c.slice(4)));
  }
});

test('todo código generado pasa su propio dígito de control', () => {
  for (let i = 0; i < 500; i += 1) {
    const c = generarCodigo();
    assert.equal(normalizarCodigo(c), c);
  }
});

test('se acepta como lo teclea una persona: minúsculas, espacios, sin prefijo, O por 0, I y L por 1', () => {
  const c = generarCodigo(() => new Uint8Array([0, 1, 24, 2, 3, 4, 5, 6, 7, 8, 9])); // incluye 0 y 1
  const tecleado = c.slice(4).toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
  assert.equal(normalizarCodigo(tecleado), c);
  assert.equal(normalizarCodigo(` ${c.toLowerCase()} `), c);
});

test('un carácter mal tecleado se detecta antes de ir al servidor', () => {
  let detectados = 0;
  let total = 0;
  for (let k = 0; k < 50; k += 1) {
    const c = generarCodigo().replace(/^SVR-/, '').replace(/-/g, '');
    for (let i = 0; i < c.length; i += 1) {
      for (const otro of ALFABETO) {
        if (otro === c[i]) continue;
        total += 1;
        if (normalizarCodigo(c.slice(0, i) + otro + c.slice(i + 1)) === null) detectados += 1;
      }
    }
  }
  assert.equal(detectados, total, 'Luhn mod N detecta todo error de un carácter');
});

test('dos caracteres vecinos intercambiados casi siempre se detectan', () => {
  let detectados = 0;
  let total = 0;
  for (let k = 0; k < 300; k += 1) {
    const c = generarCodigo().replace(/^SVR-/, '').replace(/-/g, '');
    for (let i = 0; i < c.length - 1; i += 1) {
      if (c[i] === c[i + 1]) continue;
      total += 1;
      const t = c.slice(0, i) + c[i + 1] + c[i] + c.slice(i + 2);
      if (normalizarCodigo(t) === null) detectados += 1;
    }
  }
  assert.ok(detectados / total > 0.95, `${detectados}/${total}`);
});

test('se rechazan longitudes y letras que no existen en el alfabeto', () => {
  assert.equal(normalizarCodigo('SVR-1234'), null);
  assert.equal(normalizarCodigo('SVR-UUUU-UUUU-UUUU'), null);
  assert.equal(normalizarCodigo(''), null);
});

test('el dígito de control es determinista', () => {
  assert.equal(digitoControl('0000000000'), '0');
  assert.equal(digitoControl('ABC'), digitoControl('ABC'));
});
