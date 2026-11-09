// Arma las páginas públicas en los dos idiomas:
//   comercial/plantilla.html  -> sitio/index.html (es-CO) y sitio/en/index.html (en)
//   comercial/inversion.html  -> sitio/inversion/ (es-CO) y sitio/en/investors/ (en)
// y copia comercial/assets a sitio/assets. Los textos salen de mensajes/*.json
// con la misma `traducir` del simulador: una clave inexistente o una variable
// que falta revientan el armado en vez de publicar un hueco (directiva 4).
// Los precios y las cifras del negocio salen de src/negocio/: ninguna cifra se
// escribe a mano en un texto.
//
//   {{clave}}              texto del catálogo, escapado
//   {{clave|n=14|x=@dato}} con variables; @dato toma un valor del armador
//   {{@dato}}              un valor del armador (rutas, enlaces, HTML ya armado)

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PUBLICA, URLS, datosEstructurados, datosInversion, etiquetasGoogle, jsonEnScript, sitemap, validarConfig } from './seo-comercial.mjs';
import { MARCA_BLANCA_BASE, PLANES, TRM_REFERENCIA, aUSD, formatoCOP, formatoMillones, formatoPorcentaje, formatoUSD, formatoUSDMillones, preciosDe } from '../src/negocio/precios.ts';
import {
  CAPITAL_SEMILLA, EBITDA_ANIO1, EMPRESAS_OBJETIVO_ESTIMADAS, INGRESOS_ANIO1, METAS, USO_DE_FONDOS,
  mercadoDireccionable, mesQueCubreElFijo, mrrPorMes, penetracionMeta, ticketAnual, totalIngresos,
} from '../src/negocio/modelo.ts';

const CORREO = 'safetyvr360@gmail.com'; // contacto del proyecto (contrato/MEMORIA-DEL-PROYECTO.md)

// Cada página: su plantilla y su ruta en cada idioma (relativa a la raíz publicada).
export const PAGINAS = {
  comercial: { plantilla: 'comercial/plantilla.html', rutas: { 'es-CO': '', en: 'en/' } },
  inversion: { plantilla: 'comercial/inversion.html', rutas: { 'es-CO': 'inversion/', en: 'en/investors/' } },
};

export const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Reemplaza los marcadores. `datos` trae los valores @; `t` traduce. Devuelve
// el HTML y la lista de claves usadas (para comprobar que existen en los dos idiomas).
export function llenar(plantilla, t, datos) {
  const usadas = new Set();
  const html = plantilla.replace(/\{\{([^{}]+)\}\}/g, (_, dentro) => {
    const [nombre, ...pares] = dentro.trim().split('|');
    if (nombre.startsWith('@')) {
      const k = nombre.slice(1);
      if (!(k in datos)) throw new Error(`dato_inexistente: ${k}`);
      return datos[k];
    }
    const vars = {};
    for (const p of pares) {
      const [k, v = ''] = p.split('=');
      if (v.startsWith('@')) {
        if (!(v.slice(1) in datos)) throw new Error(`dato_inexistente: ${v.slice(1)}`);
        vars[k] = datos[v.slice(1)];
      } else vars[k] = v;
    }
    usadas.add(nombre);
    return escapar(t(nombre, vars));
  });
  return { html, usadas: [...usadas] };
}

const mailto = (asunto) => `mailto:${CORREO}?subject=${encodeURIComponent(asunto)}`;
const profundidad = (ruta) => '../'.repeat(ruta.split('/').filter(Boolean).length);

// Precios y cifras del negocio, ya en el formato del idioma.
export function datosNegocio(idioma, t) {
  const d = { trm: formatoCOP(TRM_REFERENCIA, idioma) };
  for (const plan of Object.keys(PLANES)) {
    const p = preciosDe(plan, idioma);
    for (const [k, v] of Object.entries(p)) d[`${plan}_${k}`] = v;
  }
  d.piloto_desde = d.piloto_mes_cop;
  d.marca_base = formatoCOP(MARCA_BLANCA_BASE, idioma);
  d.marca_base_usd = formatoUSD(aUSD(MARCA_BLANCA_BASE), idioma);
  d.capital_cop = formatoCOP(CAPITAL_SEMILLA, idioma);
  d.capital_usd = formatoUSD(aUSD(CAPITAL_SEMILLA), idioma);
  const mrr = mrrPorMes(), mrr12 = mrr[11];
  d.mrr = formatoMillones(mrr12, idioma);
  d.mrr_usd = formatoUSD(aUSD(mrr12), idioma);
  d.mrr_valores = mrr.map((v) => v / 1_000_000).join(',');
  d.mrr_previo = mrr.map((v) => (v * 0.7) / 1_000_000).join(','); // la animación sube desde el 70 %: las barras nunca desaparecen
  d.mrr_barras = barrasMRR(mrr);
  d.empresas = String(EMPRESAS_OBJETIVO_ESTIMADAS);
  d.mercado = formatoMillones(mercadoDireccionable(), idioma);
  d.mercado_usd = formatoUSDMillones(aUSD(mercadoDireccionable()), idioma);
  d.ticket = formatoMillones(ticketAnual(), idioma);
  d.penetracion = formatoPorcentaje(penetracionMeta(), idioma);
  d.meta_empresas = String(METAS.empresas);
  d.meta_partners = String(METAS.partners);
  for (const [k, v] of Object.entries(INGRESOS_ANIO1)) d[`ing_${k}`] = formatoMillones(v, idioma);
  d.ing_total = formatoMillones(totalIngresos(), idioma);
  d.ing_total_usd = formatoUSD(aUSD(totalIngresos()), idioma);
  d.ebitda = formatoMillones(EBITDA_ANIO1, idioma);
  d.ebitda_pct = formatoPorcentaje(EBITDA_ANIO1 / totalIngresos(), idioma);
  d.mes_fijo = String(mesQueCubreElFijo());
  for (const [k, v] of USO_DE_FONDOS) {
    d[`fondo_${k}`] = formatoMillones(v, idioma);
    d[`fondo_${k}_pct`] = formatoPorcentaje(v / CAPITAL_SEMILLA, idioma);
  }
  d.grafico_ingresos = graficoIngresos(t, d);
  d.grafico_fondos = graficoFondos(t, d);
  return d;
}

// Las 12 barras del ingreso recurrente, dibujadas en el HTML (sin script se ven
// igual; con script, el fragmento `stat` las anima desde cero).
export function barrasMRR(mrr) {
  const max = Math.max(...mrr) * 1.08, gap = 8, w = (400 - gap * 11) / 12;
  return mrr.map((v, i) => {
    const h = Math.max(2, (v / max) * 120);
    return `<rect rx="3" x="${(i * (w + gap)).toFixed(2)}" y="${(120 - h).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}"/>`;
  }).join('');
}

// Los ingresos del año 1 por línea: tres barras horizontales proporcionales.
export function graficoIngresos(t, d) {
  const lineas = Object.entries(INGRESOS_ANIO1);
  const max = Math.max(...lineas.map(([, v]) => v));
  const filas = lineas.map(([k, v], i) => {
    const ancho = ((v / max) * 100).toFixed(1);
    return `<rect class="barra barra--${i + 1}" x="0" y="${i * 44}" width="${ancho}%" height="28" rx="4"/>`;
  }).join('');
  const etiqueta = t('inv.proy.grafico', { a: d.ing_a_medida, b: d.ing_suscripcion, c: d.ing_marca_blanca });
  return `<svg class="grafico-ingresos" viewBox="0 0 100 116" preserveAspectRatio="none" role="img" aria-label="${escapar(etiqueta)}">${filas}</svg>`;
}

// El uso del capital semilla: una barra por rubro, proporcional a su parte del total.
export function graficoFondos(t, d) {
  const max = Math.max(...USO_DE_FONDOS.map(([, v]) => v));
  // Cada rubro: su nombre y su parte, la barra y su nota. El conjunto se lee
  // como un gráfico (role="img"), con todo dicho en su etiqueta.
  const filas = USO_DE_FONDOS.map(([k, v]) => {
    const ancho = ((v / max) * 100).toFixed(1);
    return `<div class="rubro"><b>${escapar(t(`inv.fondo.${k}`))}</b><span>${d[`fondo_${k}`]} · ${d[`fondo_${k}_pct`]}</span><i style="--w: ${ancho}%"></i><small>${escapar(t(`inv.fondo.${k}.nota`))}</small></div>`;
  }).join('');
  const lista = USO_DE_FONDOS.map(([k]) => `${t(`inv.fondo.${k}`)} ${d[`fondo_${k}_pct`]}`).join(', ');
  return `<div class="grafico grafico--fondos" role="img" aria-label="${escapar(t('inv.fondos.grafico', { lista }))}">${filas}</div>`;
}

export function datosDe(idioma, t, extra, pagina = 'comercial') {
  const rutas = PAGINAS[pagina].rutas;
  const ruta = rutas[idioma], otro = idioma === 'en' ? 'es-CO' : 'en';
  const raiz = profundidad(ruta);
  const datos = {
    lang: idioma,
    raiz,
    otro_lang: otro,
    url_otro: `${raiz}${rutas[otro]}`,
    url_es: `${PUBLICA}${rutas['es-CO']}`,
    url_en: `${PUBLICA}${rutas.en}`,
    canonica: `${PUBLICA}${ruta}`,
    // los enlaces entre páginas del mismo idioma
    url_comercial: `${raiz}${PAGINAS.comercial.rutas[idioma]}`,
    url_inversion: `${raiz}${PAGINAS.inversion.rutas[idioma]}`,
    og_locale: idioma === 'en' ? 'en_US' : 'es_CO',
    og_locale_otro: idioma === 'en' ? 'es_CO' : 'en_US',
    og_imagen: `${PUBLICA}share.jpg`,
    json_ld: jsonEnScript(pagina === 'comercial' ? datosEstructurados(idioma, t, formatoCOP(PLANES.piloto, idioma)) : datosInversion(idioma, t, `${PUBLICA}${ruta}`)),
    google: etiquetasGoogle(extra.config),
    anio: String(new Date().getFullYear()),
    mailto: escapar(mailto(t('venta.accion.asunto'))),
    mailto_equipo: escapar(mailto(t('venta.accion.asunto'))),
    mailto_inversion: escapar(mailto(t('inv.accion.asunto'))),
    piloto: t('venta.plan.piloto'),
    planta: t('venta.plan.planta'),
    corporativo: t('venta.plan.corporativo'),
    creditos: `<a class="credits" href="${raiz}credits.html">${escapar(t('venta.pie.creditos'))}</a>`,
    ...datosNegocio(idioma, t),
  };
  for (const p of ['piloto', 'planta', 'corporativo']) {
    datos[`mailto_${p}`] = escapar(mailto(t('venta.planes.pedir', { plan: datos[p] })));
  }
  // Video: con el id de YouTube del cliente, el disco lleva al video; sin él,
  // el marco queda con su póster y sin control (sections-library.md, client-slots).
  const v = extra.videos;
  datos.video_poster = `${raiz}${v.poster}`;
  datos.video_fuente = v.youtube ? 'client' : 'stand-in';
  datos.video_comentario = v.youtube
    ? `YouTube ${escapar(v.youtube)}`
    : 'comercial/videos.json, campo "youtube": el id del video del cliente; póster provisional: camión minero (Wikimedia)';
  datos.video_play = v.youtube
    ? `<a class="ly-play" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.youtube)}" aria-label="${escapar(t('venta.videos.ver'))}"><span class="ly-play__disc" aria-hidden="true"></span></a>`
    : '';
  return datos;
}

export function armarComercial(raiz, catalogos, traducir) {
  const videos = JSON.parse(readFileSync(`${raiz}comercial/videos.json`, 'utf8'));
  if (videos.youtube !== null && !/^[\w-]{11}$/.test(videos.youtube)) throw new Error(`id_de_youtube_invalido: ${videos.youtube}`);
  // Google Analytics y Search Console: los ids que da el cliente (null: no se carga nada)
  const config = validarConfig(JSON.parse(readFileSync(`${raiz}comercial/sitio.json`, 'utf8')));
  const salida = {};
  for (const [nombre, pagina] of Object.entries(PAGINAS)) {
    const plantilla = readFileSync(`${raiz}${pagina.plantilla}`, 'utf8');
    for (const idioma of ['es-CO', 'en']) {
      const t = (clave, vars) => traducir(catalogos[idioma], clave, vars);
      const { html } = llenar(plantilla, t, datosDe(idioma, t, { videos, config }, nombre));
      const dir = `${raiz}sitio/${pagina.rutas[idioma]}`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}index.html`, html);
      salida[`${nombre}:${idioma}`] = html;
    }
  }
  cpSync(`${raiz}comercial/assets`, `${raiz}sitio/assets`, { recursive: true });
  for (const f of ['credits.html', 'favicon.svg', 'share.jpg']) {
    if (existsSync(`${raiz}comercial/${f}`)) cpSync(`${raiz}comercial/${f}`, `${raiz}sitio/${f}`);
  }
  writeFileSync(`${raiz}sitio/sitemap.xml`, sitemap(new Date().toISOString().slice(0, 10)));
  return salida;
}
