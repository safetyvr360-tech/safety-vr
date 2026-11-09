// SEO de la página comercial: lo que Google necesita para encontrarla y
// mostrarla bien. Funciones puras (las prueba src/i18n/comercial.test.ts).
//
// - Datos estructurados (JSON-LD): la organización, el sitio, el servicio con
//   sus tres planes en pesos y las preguntas frecuentes. Los textos salen del
//   catálogo del idioma; los precios, de PRECIOS (y una prueba exige que
//   coincidan con los del catálogo, para que nunca digan cosas distintas).
// - sitemap.xml con las dos versiones enlazadas entre sí (hreflang).
// - Google Analytics y la verificación de Search Console: solo si
//   comercial/sitio.json trae el id; si no, no se carga nada.

export const PUBLICA = 'https://safetyvr360-tech.github.io/safety-vr/';
export const URLS = { 'es-CO': PUBLICA, en: `${PUBLICA}en/` };

export const PRECIOS = { piloto: 450000, planta: 1350000, corporativo: 3600000 }; // COP al mes (modelo financiero)
const PREGUNTAS = [1, 2, 3, 4, 6]; // las que muestra la página

// Dentro de <script> un "</script>" en un texto cerraría la etiqueta: se escapa «<».
export const jsonEnScript = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

export function datosEstructurados(idioma, t) {
  const url = URLS[idioma];
  const org = { '@id': `${PUBLICA}#organizacion` };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', ...org, name: 'SAFETY VR', url: PUBLICA, logo: `${PUBLICA}favicon.svg`,
        parentOrganization: { '@type': 'Organization', name: 'ULTRAMEDIA COMPANY' },
        address: { '@type': 'PostalAddress', addressLocality: 'Barranquilla', addressCountry: 'CO' },
      },
      { '@type': 'WebSite', '@id': `${url}#sitio`, url, name: 'SAFETY VR', inLanguage: idioma, publisher: org },
      {
        '@type': 'Service', '@id': `${url}#servicio`, name: t('venta.seo.servicio'), serviceType: t('venta.seo.tipo'),
        description: t('venta.meta.descripcion'), provider: org, areaServed: { '@type': 'Country', name: 'Colombia' },
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

export function sitemap(fecha) {
  const alternos = Object.entries(URLS)
    .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${URLS['es-CO']}"/>`)
    .join('\n');
  const url = (loc, extra = '') => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${fecha}</lastmod>\n${extra}  </url>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    url(URLS['es-CO'], `${alternos}\n`),
    url(URLS.en, `${alternos}\n`),
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
