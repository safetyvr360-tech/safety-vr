// Disposición de los paneles del visor de Safety VR — pura y probada.
//
// Cada panel es un rectángulo flotando en la escena 360°. Aquí se decide dónde
// está cada panel, qué se dibuja en él (una lista de operaciones que el dibujo
// solo repite sobre un canvas) y qué botón hay bajo el rayo del control. Nada
// de esto toca WebGL ni el DOM: se mide el texto con una función inyectada.

import type { Vista } from '../motor/presentador.ts';
import type { Mat4, Rayo } from './matematica.ts';
import { invertir, multiplicar, rotacionY, transformarDireccion, transformarPunto, traslacion } from './matematica.ts';

export type Panel = {
  id: 'principal' | 'instrumentos' | 'rubrica';
  yaw: number;       // giro alrededor del trabajador; positivo = a su izquierda
  altura: number;    // metros respecto a los ojos
  distancia: number; // metros
  ancho_m: number;
  alto_m: number;
  ancho_px: number;
  alto_px: number;
};

const GRADO = Math.PI / 180;

// El principal al frente, a la distancia de lectura cómoda; los de consulta a
// los lados, para que el trabajador gire la cabeza como lo haría en la planta.
export const PANELES: Panel[] = [
  { id: 'principal', yaw: 0, altura: -0.05, distancia: 1.6, ancho_m: 1.6, alto_m: 1.0, ancho_px: 1536, alto_px: 960 },
  { id: 'instrumentos', yaw: 50 * GRADO, altura: -0.1, distancia: 1.5, ancho_m: 0.8, alto_m: 0.6, ancho_px: 800, alto_px: 600 },
  { id: 'rubrica', yaw: -50 * GRADO, altura: -0.1, distancia: 1.5, ancho_m: 0.8, alto_m: 0.8, ancho_px: 800, alto_px: 800 },
];

export function modeloDePanel(p: Panel): Mat4 {
  return multiplicar(rotacionY(p.yaw), traslacion(0, p.altura, -p.distancia));
}

export type Impacto = { panel: Panel['id']; u: number; v: number; px: number; py: number; t: number };

// Dónde toca el rayo al panel, en píxeles del canvas del panel (origen arriba
// a la izquierda). null si no lo toca o si el panel está detrás.
export function impactoEnPanel(rayo: Rayo, p: Panel): Impacto | null {
  const inv = invertir(modeloDePanel(p));
  const o = transformarPunto(inv, rayo.origen);
  const d = transformarDireccion(inv, rayo.direccion);
  if (Math.abs(d[2]) < 1e-9) return null;
  const t = -o[2] / d[2];
  if (t <= 0) return null;
  const x = o[0] + d[0] * t;
  const y = o[1] + d[1] * t;
  const u = x / p.ancho_m + 0.5;
  const v = 0.5 - y / p.alto_m;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { panel: p.id, u, v, px: u * p.ancho_px, py: v * p.alto_px, t };
}

// El panel más cercano que toca el rayo.
export function impactoMasCercano(rayo: Rayo, paneles: Panel[] = PANELES): Impacto | null {
  let mejor: Impacto | null = null;
  for (const p of paneles) {
    const i = impactoEnPanel(rayo, p);
    if (i && (!mejor || i.t < mejor.t)) mejor = i;
  }
  return mejor;
}

// ---------------------------------------------------------------- operaciones

export type Color =
  | 'fondo' | 'superficie' | 'tinta' | 'tenue' | 'linea' | 'acento' | 'acento_tinta'
  | 'bien' | 'mal' | 'medio' | 'boton' | 'boton_activo' | 'pantalla' | 'pantalla_texto';

export type Op =
  | { tipo: 'rect'; x: number; y: number; w: number; h: number; color: Color; radio?: number; borde?: Color }
  | { tipo: 'texto'; x: number; y: number; texto: string; tam: number; peso: number; color: Color; alinear?: 'izq' | 'der' | 'centro'; mono?: boolean }
  | { tipo: 'barra'; x: number; y: number; w: number; h: number; fraccion: number; color: Color };

export type Boton = { id: string; x: number; y: number; w: number; h: number };

export type Medir = (texto: string, tam: number, peso: number) => number;

export type Dibujo = { ops: Op[]; botones: Boton[]; escala: number };

export function botonEn(botones: Boton[], px: number, py: number): string | null {
  for (const b of botones) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b.id;
  return null;
}

// Parte el texto en líneas que caben en `ancho`. Una palabra más larga que la
// línea queda sola en la suya, sin cortarla.
export function envolver(texto: string, ancho: number, tam: number, peso: number, medir: Medir): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (actual && medir(prueba, tam, peso) > ancho) {
        lineas.push(actual);
        actual = palabra;
      } else actual = prueba;
    }
    lineas.push(actual);
  }
  return lineas;
}

const TONO: Record<string, Color> = { correcto: 'bien', incorrecto: 'mal', parcial: 'medio', neutro: 'tenue' };

// El ID de botón que reinicia el escenario desde el cierre.
export const BOTON_REPETIR = '__repetir__';

export type OpcionesPrincipal = {
  ancho: number;
  alto: number;
  medir: Medir;
  resaltado: string | null;
  textoRepetir: string;
};

// Panel principal: situación, retroalimentación, reloj y acciones; o el
// cierre con el veredicto. Si el contenido no cabe, se reduce la letra en
// pasos hasta que quepa (nunca por debajo del 60 %, para que se lea en el visor).
export function disponerPrincipal(vista: Vista, o: OpcionesPrincipal): Dibujo {
  let ultimo: Dibujo | null = null;
  for (const escala of [1, 0.9, 0.8, 0.7, 0.6]) {
    const d = intentarPrincipal(vista, o, escala);
    ultimo = d;
    // La primera operación es el fondo del panel: no cuenta como contenido.
    const fondo = Math.max(0, ...d.ops.slice(1).map((op) => ('h' in op ? op.y + op.h : op.y)));
    if (fondo <= o.alto - 40) return d;
  }
  return ultimo!;
}

function intentarPrincipal(vista: Vista, o: OpcionesPrincipal, escala: number): Dibujo {
  const M = 56;
  const ancho = o.ancho - 2 * M;
  const ops: Op[] = [{ tipo: 'rect', x: 0, y: 0, w: o.ancho, h: o.alto, color: 'fondo', radio: 28 }];
  const botones: Boton[] = [];
  let y = M;
  const s = (n: number) => Math.round(n * escala);

  const parrafo = (texto: string, tam: number, peso: number, color: Color, x = M, w = ancho, interlinea = 1.32) => {
    for (const linea of envolver(texto, w, tam, peso, o.medir)) {
      ops.push({ tipo: 'texto', x, y: y + tam, texto: linea, tam, peso, color });
      y += Math.round(tam * interlinea);
    }
  };
  const recuadro = (texto: string, tam: number, color: Color, franja: Color) => {
    const lineas = envolver(texto, ancho - 56, tam, 500, o.medir);
    const h = lineas.length * Math.round(tam * 1.3) + 36;
    ops.push({ tipo: 'rect', x: M, y, w: ancho, h, color: 'superficie', radio: 14 });
    ops.push({ tipo: 'rect', x: M, y, w: 10, h, color: franja, radio: 4 });
    let yy = y + 18;
    for (const l of lineas) { ops.push({ tipo: 'texto', x: M + 36, y: yy + tam, texto: l, tam, peso: 500, color }); yy += Math.round(tam * 1.3); }
    y += h + s(20);
  };

  ops.push({ tipo: 'texto', x: M, y: y + s(26), texto: `${vista.encabezado.codigo} · ${vista.encabezado.titulo}`, tam: s(26), peso: 500, color: 'tenue', mono: true });
  y += s(26) + s(24);

  if (vista.aviso_idioma) recuadro(vista.aviso_idioma, s(26), 'tenue', 'linea');
  for (const a of vista.alarmas) recuadro(a, s(30), 'mal', 'mal');
  if (vista.retroalimentacion) recuadro(vista.retroalimentacion.texto, s(30), 'tinta', TONO[vista.retroalimentacion.tono]!);

  if (vista.cierre) {
    const color: Color = vista.cierre.veredicto === 'apto' ? 'bien' : vista.cierre.veredicto === 'no_apto' ? 'mal' : 'medio';
    y += s(10);
    ops.push({ tipo: 'texto', x: M, y: y + s(110), texto: vista.cierre.titulo.toUpperCase(), tam: s(110), peso: 800, color });
    y += s(110) + s(28);
    parrafo(vista.cierre.detalle, s(36), 500, 'tinta');
    y += s(8);
    parrafo(vista.puntaje, s(28), 500, 'tenue');
    y += s(28);
    const h = s(96);
    botones.push({ id: BOTON_REPETIR, x: M, y, w: ancho, h });
    ops.push({ tipo: 'rect', x: M, y, w: ancho, h, color: o.resaltado === BOTON_REPETIR ? 'boton_activo' : 'acento', radio: 16 });
    ops.push({ tipo: 'texto', x: M + ancho / 2, y: y + h / 2 + s(12), texto: o.textoRepetir, tam: s(34), peso: 700, color: 'acento_tinta', alinear: 'centro' });
    y += h;
    return { ops, botones, escala };
  }

  if (vista.situacion) parrafo(vista.situacion, s(40), 500, 'tinta');
  y += s(16);
  if (vista.pausa) recuadro(vista.pausa, s(30), 'tenue', 'linea');

  if (vista.reloj) {
    const color: Color = vista.reloj.urgente ? 'mal' : 'acento';
    ops.push({ tipo: 'texto', x: M, y: y + s(26), texto: vista.reloj.texto, tam: s(26), peso: 600, color: vista.reloj.urgente ? 'mal' : 'tenue', mono: true });
    y += s(26) + s(12);
    ops.push({ tipo: 'barra', x: M, y, w: ancho, h: s(12), fraccion: vista.reloj.fraccion, color });
    y += s(12) + s(28);
  }

  for (const a of vista.acciones) {
    const tam = s(34);
    const lineas = envolver(a.texto, ancho - 64, tam, 600, o.medir);
    const sub = a.objeto ? s(24) : 0;
    const h = lineas.length * Math.round(tam * 1.25) + (sub ? sub + s(12) : 0) + s(44);
    const activo = o.resaltado === a.id;
    botones.push({ id: a.id, x: M, y, w: ancho, h });
    ops.push({ tipo: 'rect', x: M, y, w: ancho, h, color: activo ? 'boton_activo' : 'boton', radio: 16, borde: activo ? 'acento' : 'linea' });
    let yy = y + s(22);
    for (const l of lineas) { ops.push({ tipo: 'texto', x: M + 32, y: yy + tam, texto: l, tam, peso: 600, color: 'tinta' }); yy += Math.round(tam * 1.25); }
    if (a.objeto) { yy += s(8); ops.push({ tipo: 'texto', x: M + 32, y: yy + sub, texto: a.objeto, tam: sub, peso: 500, color: 'tenue', mono: true }); }
    y += h + s(16);
  }
  return { ops, botones, escala };
}

// Panel de instrumentos: la pantalla del detector, canal por canal.
export function disponerInstrumentos(vista: Vista, ancho: number, alto: number, titulo: string): Dibujo {
  const ops: Op[] = [{ tipo: 'rect', x: 0, y: 0, w: ancho, h: alto, color: 'fondo', radio: 24 }];
  const M = 40;
  let y = M;
  ops.push({ tipo: 'texto', x: M, y: y + 28, texto: titulo.toUpperCase(), tam: 28, peso: 700, color: 'tenue' });
  y += 28 + 24;
  for (const ins of vista.instrumentos) {
    ops.push({ tipo: 'texto', x: M, y: y + 26, texto: ins.etiqueta, tam: 26, peso: 500, color: 'tinta' });
    y += 26 + 18;
    const cols = 2;
    const gap = 16;
    const w = (ancho - 2 * M - gap) / cols;
    const h = 150;
    const area = { x: M, y, w: ancho - 2 * M, h: Math.ceil(ins.canales.length / cols) * (h + gap) + gap };
    ops.push({ tipo: 'rect', x: area.x - 8, y: area.y - 8, w: area.w + 16, h: area.h, color: 'pantalla', radio: 16 });
    ins.canales.forEach((c, i) => {
      const x = M + (i % cols) * (w + gap);
      const yy = y + Math.floor(i / cols) * (h + gap);
      const color: Color = c.alarma ? 'mal' : 'pantalla_texto';
      ops.push({ tipo: 'rect', x, y: yy, w, h, color: 'pantalla', radio: 10, borde: c.alarma ? 'mal' : 'linea' });
      ops.push({ tipo: 'texto', x: x + 20, y: yy + 34, texto: c.clave, tam: 24, peso: 600, color, mono: true });
      ops.push({ tipo: 'texto', x: x + 20, y: yy + 96, texto: c.valor, tam: 56, peso: 600, color, mono: true });
      ops.push({ tipo: 'texto', x: x + 20, y: yy + 132, texto: `${c.unidad} · ${c.rango}`, tam: 20, peso: 400, color, mono: true });
    });
    y += area.h + 16;
  }
  return { ops, botones: [], escala: 1 };
}

// Panel de rúbrica: criterio, peso, estado y puntaje.
export function disponerRubrica(vista: Vista, ancho: number, alto: number, titulo: string, textoCritico: string, medir: Medir): Dibujo {
  const ops: Op[] = [{ tipo: 'rect', x: 0, y: 0, w: ancho, h: alto, color: 'fondo', radio: 24 }];
  const M = 40;
  let y = M;
  ops.push({ tipo: 'texto', x: M, y: y + 28, texto: titulo.toUpperCase(), tam: 28, peso: 700, color: 'tenue' });
  y += 28 + 28;
  for (const c of vista.rubrica) {
    const lineas = envolver(c.etiqueta, ancho - 2 * M - 70, 26, 500, medir);
    for (const l of lineas) { ops.push({ tipo: 'texto', x: M, y: y + 26, texto: l, tam: 26, peso: 500, color: 'tinta' }); y += 34; }
    ops.push({ tipo: 'texto', x: ancho - M, y: y - 34 * lineas.length + 26, texto: String(c.peso), tam: 24, peso: 500, color: 'tenue', alinear: 'der', mono: true });
    const color: Color = c.resultado === 'correcto' ? 'bien' : c.resultado === 'incorrecto' ? 'mal' : c.resultado === 'parcial' ? 'medio' : 'tenue';
    let estado = c.estado.toUpperCase();
    if (c.critico) estado += ` · ${textoCritico.toUpperCase()}`;
    ops.push({ tipo: 'texto', x: M, y: y + 24, texto: estado, tam: 20, peso: 600, color, mono: true });
    y += 24 + 22;
  }
  ops.push({ tipo: 'rect', x: M, y, w: ancho - 2 * M, h: 2, color: 'linea' });
  y += 20;
  for (const l of envolver(vista.puntaje, ancho - 2 * M, 26, 600, medir)) {
    ops.push({ tipo: 'texto', x: M, y: y + 26, texto: l, tam: 26, peso: 600, color: 'tinta' });
    y += 34;
  }
  return { ops, botones: [], escala: 1 };
}
