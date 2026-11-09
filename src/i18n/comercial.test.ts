// Directiva 4 en la página comercial (comercial/plantilla.html): todo texto
// visible sale de los catálogos, cada clave existe en los dos idiomas y el
// armado escapa el texto y revienta ante una clave que no existe.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { llenar, escapar } from '../../tools/construir-comercial.mjs';
import { traducir } from '../motor/presentador.ts';

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const plantilla = readFileSync(`${raiz}comercial/plantilla.html`, 'utf8');
const leer = (i: string): Record<string, string> => JSON.parse(readFileSync(`${raiz}mensajes/${i}.json`, 'utf8'));
const CATALOGOS = { 'es-CO': leer('es-CO'), en: leer('en') };

const claves = [...plantilla.matchAll(/\{\{([^{}@][^{}|]*)/g)].map((m) => m[1]!.trim());

// El texto que queda fuera de los marcadores, sin comentarios, estilos ni scripts.
// Solo se aceptan la marca, códigos de la interfaz simulada y signos.
export function textosCrudos(html: string): string[] {
  const limpio = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ');
  const PERMITIDO = /^(SAFETY VR|T-\d{4}|T\d|[A-Z]{2}|[/#]|\d+)$/;
  return [...limpio.matchAll(/>([^<>]*)</g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s !== '' && /\p{L}/u.test(s) && !PERMITIDO.test(s));
}

test('la página comercial no trae texto visible escrito a mano', () => {
  assert.deepEqual(textosCrudos(plantilla), []);
});

test('el detector de texto crudo ve una palabra suelta en la plantilla', () => {
  assert.deepEqual(textosCrudos('<p>{{a}} Hola</p><span>T-0412</span><b>SAFETY VR</b>'), ['Hola']);
});

test('cada clave de la página existe en los dos catálogos', () => {
  assert.ok(claves.length > 100, `se esperaban las claves de la página (${claves.length})`);
  for (const [idioma, cat] of Object.entries(CATALOGOS)) {
    const faltan = claves.filter((k) => !(k in cat));
    assert.deepEqual(faltan, [], `faltan en ${idioma}`);
  }
});

test('el armado escapa el texto del catálogo', () => {
  const t = (k: string) => traducir({ k: 'A <b> & "c"' }, k);
  assert.equal(llenar('<p>{{k}}</p>', t, {}).html, '<p>A &lt;b&gt; &amp; &quot;c&quot;</p>');
  assert.equal(escapar('<'), '&lt;');
});

test('una clave o un dato inexistente revientan el armado', () => {
  const t = (k: string) => traducir({}, k);
  assert.throws(() => llenar('{{no.existe}}', t, {}), /clave_de_catalogo_inexistente/);
  assert.throws(() => llenar('{{@nada}}', t, {}), /dato_inexistente/);
});

test('las variables llegan al texto, también las que toma del armador', () => {
  const t = (k: string, v?: Record<string, string | number>) => traducir({ p: 'Pedir el plan {plan}', d: '{n} d' }, k, v);
  assert.equal(llenar('{{p|plan=@x}} {{d|n=12}}', t, { x: 'Piloto' }).html, 'Pedir el plan Piloto 12 d');
});

// ---- SEO (tools/seo-comercial.mjs)
import { PRECIOS, URLS, datosEstructurados, etiquetasGoogle, jsonEnScript, sitemap, validarConfig } from '../../tools/seo-comercial.mjs';
import { datosDe } from '../../tools/construir-comercial.mjs';

const tDe = (i: 'es-CO' | 'en') => (k: string, v?: Record<string, string | number>) => traducir(CATALOGOS[i], k, v);

test('los precios de los datos estructurados son los mismos que muestra la página', () => {
  for (const i of ['es-CO', 'en'] as const) {
    for (const [plan, precio] of Object.entries(PRECIOS)) {
      const texto = CATALOGOS[i][`venta.plan.${plan}.precio`]!;
      assert.equal(Number(texto.replace(/\D/g, '')), precio, `${i} ${plan}: «${texto}»`);
    }
  }
});

test('los datos estructurados describen el servicio, sus 3 planes y las preguntas en el idioma de la página', () => {
  const j = datosEstructurados('en', tDe('en')) as { '@graph': Array<Record<string, any>> };
  const tipo = (t: string) => j['@graph'].find((x) => x['@type'] === t)!;
  assert.deepEqual(tipo('Service').offers.map((o: any) => [o.name, o.price, o.priceCurrency]), [['Pilot', '450000', 'COP'], ['Plant', '1350000', 'COP'], ['Corporate', '3600000', 'COP']]);
  assert.equal(tipo('FAQPage').mainEntity.length, 5);
  assert.equal(tipo('WebSite').url, URLS.en);
});

test('el JSON-LD no puede cerrar su etiqueta <script>', () => {
  const salida = jsonEnScript({ a: '</script><b>' });
  assert.ok(!salida.includes('<'), salida);
  assert.deepEqual(JSON.parse(salida), { a: '</script><b>' });
});

test('cada idioma se declara canónico a sí mismo', () => {
  const extra = { videos: { youtube: null, poster: 'p.jpg' }, config: { google_analytics: null, search_console: null } };
  assert.equal(datosDe('es-CO', tDe('es-CO'), extra).canonica, URLS['es-CO']);
  assert.equal(datosDe('en', tDe('en'), extra).canonica, URLS.en);
});

test('el sitemap enlaza las dos versiones entre sí y la demo', () => {
  const x = sitemap('2026-11-09');
  for (const u of [URLS['es-CO'], URLS.en, `${URLS['es-CO']}demo/`]) assert.ok(x.includes(`<loc>${u}</loc>`), u);
  assert.equal(x.match(/hreflang="x-default"/g)?.length, 2);
  assert.ok(x.includes('<lastmod>2026-11-09</lastmod>'));
});

test('sin ids, la página no carga nada de Google; con ids, sí', () => {
  assert.equal(etiquetasGoogle({ google_analytics: null, search_console: null }), '');
  const g = etiquetasGoogle({ google_analytics: 'G-AB12CD34', search_console: 'abcDEF123_abcDEF123-xyz' });
  assert.ok(g.includes('gtag/js?id=G-AB12CD34') && g.includes('google-site-verification'));
});

test('un id de Google con forma rara revienta el armado', () => {
  assert.throws(() => validarConfig({ google_analytics: 'UA-123', search_console: null }), /id_de_analytics_invalido/);
  assert.throws(() => validarConfig({ google_analytics: null, search_console: '<x>' }), /token_de_search_console_invalido/);
  assert.doesNotThrow(() => validarConfig({ google_analytics: null, search_console: null }));
});
