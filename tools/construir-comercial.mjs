// Arma la página comercial en los dos idiomas a partir de comercial/plantilla.html:
//   sitio/index.html      es-CO (la raíz que publica GitHub Pages)
//   sitio/en/index.html   en
// y copia comercial/assets a sitio/assets. Los textos salen de mensajes/*.json
// con la misma `traducir` del simulador: una clave inexistente o una variable
// que falta revientan el armado en vez de publicar un hueco (directiva 4).
//
//   {{clave}}              texto del catálogo, escapado
//   {{clave|n=14|x=@dato}} con variables; @dato toma un valor del armador
//   {{@dato}}              un valor del armador (rutas, enlaces, HTML ya armado)

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const CORREO = 'safetyvr360@gmail.com'; // contacto del proyecto (contrato/MEMORIA-DEL-PROYECTO.md)
const PUBLICA = 'https://safetyvr360-tech.github.io/safety-vr/';

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

export function datosDe(idioma, t, extra) {
  const enIngles = idioma === 'en';
  const raiz = enIngles ? '../' : '';
  const datos = {
    lang: idioma,
    raiz,
    otro_lang: enIngles ? 'es-CO' : 'en',
    url_otro: enIngles ? '../' : 'en/',
    url_es: PUBLICA,
    url_en: `${PUBLICA}en/`,
    anio: String(new Date().getFullYear()),
    mailto: escapar(mailto(t('venta.accion.asunto'))),
    mailto_equipo: escapar(mailto(t('venta.accion.asunto'))),
    piloto: t('venta.plan.piloto'),
    planta: t('venta.plan.planta'),
    corporativo: t('venta.plan.corporativo'),
    creditos: `<a class="credits" href="${raiz}credits.html">${escapar(t('venta.pie.creditos'))}</a>`,
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
  const plantilla = readFileSync(`${raiz}comercial/plantilla.html`, 'utf8');
  const videos = JSON.parse(readFileSync(`${raiz}comercial/videos.json`, 'utf8'));
  if (videos.youtube !== null && !/^[\w-]{11}$/.test(videos.youtube)) throw new Error(`id_de_youtube_invalido: ${videos.youtube}`);
  const salida = {};
  for (const idioma of ['es-CO', 'en']) {
    const t = (clave, vars) => traducir(catalogos[idioma], clave, vars);
    const { html } = llenar(plantilla, t, datosDe(idioma, t, { videos }));
    const dir = idioma === 'en' ? `${raiz}sitio/en` : `${raiz}sitio`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.html`, html);
    salida[idioma] = html;
  }
  cpSync(`${raiz}comercial/assets`, `${raiz}sitio/assets`, { recursive: true });
  for (const f of ['credits.html', 'favicon.svg', 'share.jpg']) {
    if (existsSync(`${raiz}comercial/${f}`)) cpSync(`${raiz}comercial/${f}`, `${raiz}sitio/${f}`);
  }
  return salida;
}
