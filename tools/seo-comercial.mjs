// SEO de las páginas públicas: lo que Google necesita para encontrarlas y
// mostrarlas bien. Funciones puras (las prueba src/i18n/comercial.test.ts).
//
// - Datos estructurados (JSON-LD): en la página comercial, la organización, el
//   sitio, el servicio con sus tres planes en pesos y las preguntas frecuentes;
//   en la de inversión, la organización y la página. Los textos salen del
//   catálogo del idioma; los precios, de src/negocio/precios.ts.
// - sitemap.xml con cada página en sus dos idiomas enlazados (hreflang).
// - Google Analytics y la verificación de Search Console: solo si
//   comercial/sitio.json trae el id; si no, no se carga nada.

// Los precios salen de la única fuente.
import { PLANES as PRECIOS } from '../src/negocio/precios.ts';
export { PRECIOS };

export const PUBLICA = 'https://safetyvr.com.co/';
export const URLS = { 'es-CO': PUBLICA, en: `${PUBLICA}en/` };
export const URLS_INVERSION = { 'es-CO': `${PUBLICA}inversion/`, en: `${PUBLICA}en/investors/` };

const PREGUNTAS = [1, 2, 3, 4, 6]; // las que muestra la página comercial

// Dentro de <script> un "</script>" en un texto cerraría la etiqueta: se escapa «<».
export const jsonEnScript = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

const organizacion = () => ({
  '@type': 'Organization', '@id': `${PUBLICA}#organizacion`, name: 'SAFETY VR', url: PUBLICA, logo: `${PUBLICA}favicon.svg`,
  parentOrganization: { '@type': 'Organization', name: 'ULTRAMEDIA COMPANY' },
  address: { '@type': 'PostalAddress', addressLocality: 'Barranquilla', addressCountry: 'CO' },
});

export function datosEstructurados(idioma, t, desde) {
  const url = URLS[idioma];
  const org = { '@id': `${PUBLICA}#organizacion` };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizacion(),
      { '@type': 'WebSite', '@id': `${url}#sitio`, url, name: 'SAFETY VR', inLanguage: idioma, publisher: org },
      {
        '@type': 'Service', '@id': `${url}#servicio`, name: t('venta.seo.servicio'), serviceType: t('venta.seo.tipo'),
        description: t('venta.meta.descripcion', { piloto: desde }), provider: org,
        areaServed: { '@type': 'Country', name: 'Colombia' },
        offers: Object.entries(PRECIOS).map(([plan, precio]) => ({
          '@type': 'Offer', name: t(`venta.plan.${plan}`), description: t(`venta.plan.${plan}.para`),
          price: String(precio), priceCurrency: 'COP',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: String(precio), priceCurrency: 'COP', unitCode: 'MON' },
        })),
      },
      {
        '@type': 'FAQPage', '@id': `${url}#preguntas`, inLanguage: idioma,
        mainEntity: PREGUNTAS.map((n) => ({
          '@type': 'Question', name: t(`venta.faq.${n}.p`),
          acceptedAnswer: { '@type': 'Answer', text: t(`venta.faq.${n}.r`) },
        })),
      },
    ],
  };
}

// La página de inversión: la organización y la página, sin servicio ni preguntas (no las muestra).
export function datosInversion(idioma, t, url) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizacion(),
      {
        '@type': 'WebPage', '@id': `${url}#pagina`, url, name: t('inv.meta.titulo'), description: t('inv.meta.descripcion'),
        inLanguage: idioma, about: { '@id': `${PUBLICA}#organizacion` },
      },
    ],
  };
}

export function sitemap(fecha) {
  const alternos = (urls) => Object.entries(urls)
    .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${urls['es-CO']}"/>`)
    .join('\n');
  const url = (loc, extra = '') => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${fecha}</lastmod>\n${extra}  </url>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...[URLS, URLS_INVERSION].flatMap((u) => [url(u['es-CO'], `${alternos(u)}\n`), url(u.en, `${alternos(u)}\n`)]),
    url(`${PUBLICA}demo/`),
    '</urlset>',
    '',
  ].join('\n');
}

// Los ids que pone el cliente en comercial/sitio.json. Un id con forma rara
// revienta el armado: mejor que publicar una etiqueta que Google ignora.
export function validarConfig(c) {
  if (c.google_analytics !== null && !/^G-[A-Z0-9]{6,12}$/.test(c.google_analytics)) throw new Error(`id_de_analytics_invalido: ${c.google_analytics}`);
  if (c.search_console !== null && !/^[\w-]{20,64}$/.test(c.search_console)) throw new Error(`token_de_search_console_invalido: ${c.search_console}`);
  return c;
}

export function etiquetasGoogle(c) {
  const partes = [];
  if (c.search_console) partes.push(`<meta name="google-site-verification" content="${c.search_console}">`);
  if (c.google_analytics) {
    partes.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${c.google_analytics}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${c.google_analytics}');</script>`,
    );
  }
  return partes.join('\n');
}
