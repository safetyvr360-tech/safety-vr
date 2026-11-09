// Directiva 4: es-CO y en son de primera clase. Esta prueba falla si un
// catálogo tiene una clave que el otro no, un texto vacío, variables distintas
// entre idiomas, o si el español tutea o vosea en vez de tratar de usted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (i: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`../../mensajes/${i}.json`, import.meta.url), 'utf8'));

const ES = leer('es-CO');
const EN = leer('en');
const variables = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('los dos catálogos tienen exactamente las mismas claves', () => {
  assert.deepEqual(Object.keys(ES).sort(), Object.keys(EN).sort());
});

test('ningún texto está vacío', () => {
  for (const [i, cat] of [['es-CO', ES], ['en', EN]] as const) {
    for (const [k, v] of Object.entries(cat)) assert.ok(typeof v === 'string' && v.trim() !== '', `${i}: ${k} vacío`);
  }
});

test('cada clave usa las mismas variables en los dos idiomas', () => {
  for (const k of Object.keys(ES)) assert.deepEqual(variables(ES[k]!), variables(EN[k] ?? ''), k);
});

test('el español trata de usted: sin tuteo ni voseo', () => {
  const tuteo = /\b(tú|vos|te|ti|contigo|tienes|puedes|eres|estás|quieres|debes|tenés|podés|sos|pon|ponte|haz|sal|ven)\b/i;
  for (const [k, v] of Object.entries(ES)) assert.ok(!tuteo.test(v), `${k}: «${v}»`);
});

test('el inglés no trae español pegado', () => {
  const espanol = /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|usted)\b/i;
  for (const [k, v] of Object.entries(EN)) assert.ok(!espanol.test(v), `${k}: «${v}»`);
});
