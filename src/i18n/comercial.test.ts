// Directiva 4 en la página comercial (comercial/plantilla.html): todo texto
// visible sale de los catálogos, cada clave existe en los dos idiomas y el
// armado escapa el texto y revienta ante una clave que no existe.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { llenar, escapar, marcaSinCorte, sinVideoProvisional } from '../../tools/construir-comercial.mjs';
import { traducir } from '../motor/presentador.ts';

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const plantilla = readFileSync(`${raiz}comercial/plantilla.html`, 'utf8') + readFileSync(`${raiz}comercial/inversion.html`, 'utf8');
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
import { PRECIOS, URLS, URLS_INVERSION, datosEstructurados, etiquetasGoogle, jsonEnScript, sitemap, validarConfig } from '../../tools/seo-comercial.mjs';
import { datosDe } from '../../tools/construir-comercial.mjs';

const tDe = (i: 'es-CO' | 'en') => (k: string, v?: Record<string, string | number>) => traducir(CATALOGOS[i], k, v);

test('ningún texto del catálogo trae un precio o una cifra de negocio escrita a mano', () => {
  for (const i of ['es-CO', 'en'] as const) {
    for (const [k, v] of Object.entries(CATALOGOS[i])) {
      if (!k.startsWith('venta.') && !k.startsWith('inv.')) continue;
      assert.ok(!/(\$|COP )\d/.test(v), `${i} ${k}: «${v}»`);
    }
  }
});

test('los datos estructurados describen el servicio, sus 3 planes y las preguntas en el idioma de la página', () => {
  const j = datosEstructurados('en', tDe('en'), 'COP 450,000') as { '@graph': Array<Record<string, any>> };
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

test('la página de inversión encuentra sus recursos y enlaza su otro idioma y la comercial', () => {
  const extra = { videos: { youtube: null, poster: 'p.jpg' }, config: { google_analytics: null, search_console: null } };
  const es = datosDe('es-CO', tDe('es-CO'), extra, 'inversion');
  const en = datosDe('en', tDe('en'), extra, 'inversion');
  assert.equal(es.raiz, '../');
  assert.equal(en.raiz, '../../');
  assert.equal(es.url_otro, '../en/investors/');
  assert.equal(en.url_otro, '../../inversion/');
  assert.equal(en.url_comercial, '../../en/');
  assert.equal(en.canonica, URLS_INVERSION.en);
});

test('el precio «desde» de la página es el del plan Piloto, en el formato del idioma', () => {
  const extra = { videos: { youtube: null, poster: 'p.jpg' }, config: { google_analytics: null, search_console: null } };
  assert.equal(datosDe('es-CO', tDe('es-CO'), extra).piloto_desde, '$450.000');
  assert.equal(datosDe('en', tDe('en'), extra).piloto_desde, ['COP', '450,000'].join(String.fromCharCode(160)));
});

test('las dos páginas cargan la capa móvil y la capa mantiene sus correcciones', () => {
  for (const p of ['plantilla', 'inversion']) {
    const html = readFileSync(`${raiz}comercial/${p}.html`, 'utf8');
    assert.ok(html.includes('href="{{@raiz}}movil.css"'), `${p} no carga movil.css`);
    assert.ok(!/user-scalable=no|maximum-scale=1/.test(html), `${p} desactiva el zoom`);
  }
  const css = readFileSync(`${raiz}comercial/movil.css`, 'utf8');
  assert.match(css, /-webkit-tap-highlight-color:\s*transparent/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /@media \(hover: none\)[\s\S]*\.btn--primary:hover\s*\{\s*background:\s*var\(--action\)/);
  assert.ok(!/body\s*\{[^}]*user-select:\s*none/.test(css), 'el contenido debe seguir seleccionable');
});

// Corre comercial/navegacion.js en un DOM mínimo: secciones con [arriba, abajo]
// en la página, una pantalla de 800 px y una lista de posiciones de scroll.
// Devuelve, para cada posición, los enlaces marcados y su valor.
function recorrerMenu(js: string, secciones: [number, number][], posiciones: number[]): string[][] {
  let scrollY = 0;
  const oyentes: Record<string, () => void> = {};
  const enlaces = secciones.map((_, i) => {
    const attrs: Record<string, string> = { href: `#${'abc'[i]}` };
    return {
      attrs,
      getAttribute: (k: string) => attrs[k] ?? null,
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      removeAttribute: (k: string) => { delete attrs[k]; },
    };
  });
  const porId = Object.fromEntries(secciones.map(([arriba, abajo], i) => [`#${'abc'[i]}`, {
    getBoundingClientRect: () => ({ top: arriba - scrollY, bottom: abajo - scrollY }),
  }]));
  const ventana = {
    innerHeight: 800,
    document: { querySelectorAll: () => enlaces, querySelector: (s: string) => porId[s] ?? null },
    addEventListener: (tipo: string, f: () => void) => { oyentes[tipo] = f; },
    requestAnimationFrame: (f: () => void) => f(),
  };
  new Function(...Object.keys(ventana), js)(...Object.values(ventana));
  return posiciones.map((y) => {
    scrollY = y;
    oyentes.scroll!();
    return enlaces.filter((a) => a.attrs['aria-current']).map((a) => `${a.attrs.href}=${a.attrs['aria-current']}`);
  });
}

test('el menú marca la sección visible y el botón secundario se separa del fondo', () => {
  const html = readFileSync(`${raiz}comercial/plantilla.html`, 'utf8');
  const js = readFileSync(`${raiz}comercial/navegacion.js`, 'utf8');
  const css = readFileSync(`${raiz}comercial/comun.css`, 'utf8');
  const armado = readFileSync(`${raiz}tools/construir-comercial.mjs`, 'utf8');
  // las dos páginas cargan los detalles comunes
  for (const p of ['plantilla', 'inversion']) {
    const h = readFileSync(`${raiz}comercial/${p}.html`, 'utf8');
    assert.ok(h.includes('<link rel="stylesheet" href="{{@raiz}}comun.css">'), `${p} no carga comun.css`);
    assert.ok(h.includes('<script src="{{@raiz}}navegacion.js" defer></script>'), `${p} no carga navegacion.js`);
  }
  assert.match(armado, /'movil\.css', 'comun\.css', 'navegacion\.js'\]/);
  // el script marca con aria-current="location" el enlace de la sección que cruza la mitad de la pantalla
  const marcados = recorrerMenu(js, [[0, 900], [900, 2000], [2000, 2600]], [0, 600, 1000, 1300, 1700, 5000]);
  assert.deepEqual(marcados, [['#a=location'], ['#b=location'], ['#b=location'], ['#b=location'], ['#c=location'], []]);
  // y la marca se ve
  assert.match(css, /^\.nav__link\[aria-current="location"\]::after \{ content: ""/m);
  // el botón secundario (tonal) lleva borde: antes quedaba a 1,02:1 de la tarjeta
  assert.match(css, /html\[data-buttons="tonal"\] \.btn--secondary, html\[data-buttons="tonal"\] \.btn--secondary:hover \{ border-color: var\(--line-strong\); \}/);
  // en el teléfono la raya del enlace va bajo el texto, no al pie de la caja táctil de 44 px
  assert.match(css, /@media \(max-width: 639px\) \{\n[^}]*\.link\.link\.link:is\(:hover, :focus-visible\) \{ background-position: 0 calc\(100% - 10px\), 0 calc\(100% - 10px\); \}/);
  // en la página de inversión, en el teléfono, la nota de cada fila usa todo el ancho y el gráfico de fondos apila nombre y monto
  const inv = readFileSync(`${raiz}comercial/inversion.html`, 'utf8');
  assert.match(inv, /@media \(max-width: 639px\) \{\n\s*\.rows > li > p \{ grid-column: 1 \/ -1; \}\n\s*\.grafico\.grafico--fondos \{ padding: var\(--s-5\); \}\n\s*\.grafico--fondos \.rubro \{ grid-template-columns: minmax\(0, 1fr\);/);
  // y «Pasos» termina con un enlace a los planes
  assert.match(html, /<a class="link" href="#planes">\{\{venta\.pasos\.cta\}\}<\/a>/);
  // la captura del visor (1146 x 624) va en un marco 16:9: en 4:3 se agrandaba 1,38 veces
  assert.match(readFileSync(`${raiz}comercial/inversion.html`, 'utf8'), /style="--ratio: 56\.25%">\n\s*<img class="frame__img" src="\{\{@raiz\}\}assets\/img\/ec01-visor\.jpg"/);
});

test('la marca no se parte entre líneas en los títulos, y solo en los títulos', () => {
  const html = '<title>SAFETY VR</title><h2 id="m">Mercado de SAFETY VR en <em>SAFETY VR</em></h2><p>SAFETY VR</p><h3 aria-label="SAFETY VR">SAFETY VR</h3>';
  assert.equal(marcaSinCorte(html), '<title>SAFETY VR</title><h2 id="m">Mercado de SAFETY&nbsp;VR en <em>SAFETY&nbsp;VR</em></h2><p>SAFETY VR</p><h3 aria-label="SAFETY VR">SAFETY&nbsp;VR</h3>');
  const { html: lleno } = llenar('<h2>{{x}}</h2>', () => 'Uso del capital semilla de SAFETY VR', {});
  assert.equal(lleno, '<h2>Uso del capital semilla de SAFETY&nbsp;VR</h2>');
  // «año 1» tampoco se parte en un título, y fuera de los títulos queda igual
  assert.equal(marcaSinCorte('<h2>Proyección del año 1</h2><p>el año 1</p>'), '<h2>Proyección del año&nbsp;1</h2><p>el año 1</p>');
});

test('sin el id de YouTube del cliente no se publica la sección de video con un póster de stock', () => {
  const comercial = readFileSync(`${raiz}comercial/plantilla.html`, 'utf8');
  assert.match(comercial, /id="videos"/);
  const sin = sinVideoProvisional(comercial, { youtube: null });
  assert.doesNotMatch(sin, /id="videos"/);
  assert.match(sin, /id="pasos"[\s\S]*<\/section>\n\n[\s\S]*id="planes"/, 'las secciones vecinas quedan');
  assert.match(sin, /CLIENT FILE video/, 'queda el recordatorio para el id');
  assert.equal(sinVideoProvisional(comercial, { youtube: 'dQw4w9WgXcQ' }), comercial);
  // el pie de inversión nombra la sección del cronograma, no su primera fila
  assert.match(readFileSync(`${raiz}comercial/inversion.html`, 'utf8'), /<a href="#ruta">\{\{inv\.pie\.cronograma\}\}<\/a>/);
});

test('las maquetas: el certificado no tacha sus pasos, los días no se parten y el gráfico del héroe deja ver su eje', () => {
  const css = readFileSync(`${raiz}comercial/comun.css`, 'utf8');
  assert.match(css, /^\.ui-checks \.ui-check\.is-done \.ui-check__label::after \{ transform: scaleX\(0\); \}/m);
  assert.match(css, /^\.ui-win__age \{ white-space: nowrap; \}/m);
  const inv = readFileSync(`${raiz}comercial/inversion.html`, 'utf8');
  assert.match(inv, /@media \(min-width: 640px\) \{ \.hero--centred \.hero__window \{ -webkit-mask-image: linear-gradient\(to bottom, #000 calc\(100% - 24px\), transparent\); mask-image: linear-gradient\(to bottom, #000 calc\(100% - 24px\), transparent\); \} \}/);
});

test('la demo tiene salida: el logo lleva a la página comercial y menú y pie a los planes', () => {
  const demo = readFileSync(`${raiz}plataforma/plantilla.html`, 'utf8');
  assert.match(demo, /<a class="marca" href="\.\.\/"/);
  assert.equal(demo.match(/href="\.\.\/#planes" data-t="plataforma\.nav\.planes"/g)?.length, 2);
  // en el teléfono la barra es una sola fila: el menú se esconde y queda en el pie
  assert.match(demo, /@media \(max-width: 640px\) \{ \.barra \.nav \{ display: none; \}/);
  for (const cat of Object.values(CATALOGOS)) assert.ok(cat['plataforma.nav.planes']);
});

test('el sitemap enlaza las dos versiones entre sí y la demo', () => {
  const x = sitemap('2026-11-09');
  for (const u of [URLS['es-CO'], URLS.en, URLS_INVERSION['es-CO'], URLS_INVERSION.en, `${URLS['es-CO']}demo/`]) assert.ok(x.includes(`<loc>${u}</loc>`), u);
  assert.equal(x.match(/hreflang="x-default"/g)?.length, 4);
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
