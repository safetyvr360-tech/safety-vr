// El servidor local de sitio/ (tools/servir-sitio.mjs): solo entrega archivos de su carpeta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, sep } from 'node:path';
import { rutaSegura } from '../../tools/servir-sitio.mjs';

const raiz = resolve('sitio');

test('una ruta normal queda dentro de la carpeta', () => {
  assert.equal(rutaSegura(raiz, '/inversion/index.html?x=1'), `${raiz}${sep}inversion${sep}index.html`);
  assert.equal(rutaSegura(raiz, '/'), raiz);
});

test('subir con .. o con %2e%2e no sale de la carpeta', () => {
  for (const u of ['/../package.json', '/%2e%2e/%2e%2e/secreto', '/a/../../b']) {
    const r = rutaSegura(raiz, u);
    assert.ok(r === null || r.startsWith(raiz), u);
  }
});
