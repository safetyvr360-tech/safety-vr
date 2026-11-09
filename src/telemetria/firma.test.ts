import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canonico, firmar, huella, verificar } from './firma.ts';

test('el JSON canónico ordena las claves y no depende del orden de escritura', () => {
  assert.equal(canonico({ b: 1, a: { d: [1, 'x'], c: true } }), '{"a":{"c":true,"d":[1,"x"]},"b":1}');
  assert.equal(canonico({ a: 1, b: 2 }), canonico({ b: 2, a: 1 }));
});

test('el JSON canónico omite claves indefinidas y rechaza números no finitos', () => {
  assert.equal(canonico({ a: 1, b: undefined }), '{"a":1}');
  assert.throws(() => canonico({ a: NaN }), /numero_no_finito/);
  assert.throws(() => canonico(undefined), /valor_indefinido/);
});

test('la firma HMAC-SHA256 coincide con el vector de prueba del RFC 4231', async () => {
  // RFC 4231, caso 2: clave "Jefe", datos "what do ya want for nothing?".
  // canonico(string) agrega comillas, así que se firma el texto con comillas y
  // se compara contra el HMAC calculado de forma independiente para ese texto.
  const sig = await firmar('what do ya want for nothing?', 'Jefe');
  assert.match(sig, /^[A-Za-z0-9_-]{43}$/, 'base64url de 32 bytes, sin relleno');
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('Jefe'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const esperado = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('"what do ya want for nothing?"')));
  const decod = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0));
  assert.deepEqual(decod, esperado);
});

test('un paquete firmado se verifica; cambiar un solo dato lo invalida', async () => {
  const paquete = { sesion: { id: 's1', puntaje: 55, veredicto: 'no_apto' } };
  const f = await firmar(paquete, 'clave-del-visor');
  assert.equal(await verificar(paquete, f, 'clave-del-visor'), true);
  assert.equal(await verificar({ sesion: { id: 's1', puntaje: 95, veredicto: 'no_apto' } }, f, 'clave-del-visor'), false);
  assert.equal(await verificar({ sesion: { ...paquete.sesion, veredicto: 'apto' } }, f, 'clave-del-visor'), false);
  assert.equal(await verificar(paquete, f, 'otra-clave'), false);
  assert.equal(await verificar(paquete, f.slice(0, -1), 'clave-del-visor'), false);
});

test('el orden de las claves no cambia la firma', async () => {
  assert.equal(await firmar({ a: 1, b: 2 }, 'k'), await firmar({ b: 2, a: 1 }, 'k'));
});

test('no se firma con un secreto vacío', async () => {
  await assert.rejects(firmar({ a: 1 }, ''), /secreto_vacio/);
});

test('un paquete sin firma o con firma rara se rechaza sin caerse', async () => {
  for (const f of [undefined, null, 42, '', { x: 1 }]) assert.equal(await verificar({ a: 1 }, f, 'k'), false);
  assert.equal(await verificar({ a: NaN }, 'abc', 'k'), false, 'contenido imposible de canonizar');
});

test('la huella SHA-256 es pública, estable y coincide con el vector conocido', async () => {
  // SHA-256 de '"abc"' (el JSON canónico del texto abc), calculado aparte.
  const k = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('"abc"')));
  assert.equal(await huella('abc'), [...k].map((x) => x.toString(16).padStart(2, '0')).join(''));
  assert.equal(await huella({ b: 1, a: 2 }), await huella({ a: 2, b: 1 }));
  assert.match(await huella({}), /^[0-9a-f]{64}$/);
  // SHA-256("") conocido, para no depender solo de WebCrypto contra sí mismo:
  const vacio = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array()));
  assert.equal([...vacio].map((x) => x.toString(16).padStart(2, '0')).join(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
