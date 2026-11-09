import { test } from 'node:test';
import assert from 'node:assert/strict';
import { negociarIdioma, rutaEnIdioma, idiomaDeRuta, esIdioma } from './idiomas.ts';

test('sin pistas, la app abre en español de Colombia', () => {
  assert.equal(negociarIdioma(null), 'es-CO');
  assert.equal(negociarIdioma(''), 'es-CO');
  assert.equal(negociarIdioma('fr-FR,de;q=0.8'), 'es-CO');
});

test('cualquier español va a es-CO y cualquier inglés a en', () => {
  assert.equal(negociarIdioma('es-MX'), 'es-CO');
  assert.equal(negociarIdioma('ES'), 'es-CO');
  assert.equal(negociarIdioma('en-GB'), 'en');
  assert.equal(negociarIdioma('fr-FR,en-US;q=0.5'), 'en');
});

test('gana el idioma de mayor peso q, no el primero de la lista', () => {
  assert.equal(negociarIdioma('es;q=0.3,en;q=0.9'), 'en');
  assert.equal(negociarIdioma('en;q=0.4, es-CO'), 'es-CO');
});

test('a igual peso, gana el que el navegador puso primero', () => {
  assert.equal(negociarIdioma('en,es'), 'en');
  assert.equal(negociarIdioma('es,en'), 'es-CO');
});

test('q=0 significa «no lo quiero»', () => {
  assert.equal(negociarIdioma('en;q=0'), 'es-CO');
  assert.equal(negociarIdioma('es;q=0, en;q=0.1'), 'en');
});

test('la preferencia guardada manda sobre el navegador, si es válida', () => {
  assert.equal(negociarIdioma('es-CO', 'en'), 'en');
  assert.equal(negociarIdioma('en', 'fr'), 'en');
  assert.equal(negociarIdioma('en', 'es'), 'en', '«es» no es un idioma de la app; se ignora');
});

test('el idioma de una ruta sale solo del primer segmento', () => {
  assert.equal(idiomaDeRuta('/en/sistema'), 'en');
  assert.equal(idiomaDeRuta('/es-CO'), 'es-CO');
  assert.equal(idiomaDeRuta('/sistema/en'), null);
  assert.equal(idiomaDeRuta('/'), null);
  assert.equal(esIdioma('es'), false);
});

test('cambiar de idioma conserva la página, la consulta y el fragmento', () => {
  assert.equal(rutaEnIdioma('/es-CO/sistema', 'en'), '/en/sistema');
  assert.equal(rutaEnIdioma('/en', 'es-CO'), '/es-CO');
  assert.equal(rutaEnIdioma('/en/', 'es-CO'), '/es-CO');
  assert.equal(rutaEnIdioma('/', 'en'), '/en');
  assert.equal(rutaEnIdioma('/sistema', 'en'), '/en/sistema');
  assert.equal(rutaEnIdioma('/es-CO/verificar?codigo=SVR-1#r', 'en'), '/en/verificar?codigo=SVR-1#r');
});
