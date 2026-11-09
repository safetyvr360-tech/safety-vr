// Dibujo del visor de Safety VR — WebGL 2 directo, sin dependencias.
//
// Solo pinta: el panorama 360° de fondo (un triángulo que cubre la pantalla y
// un sombreador que convierte cada píxel en una dirección y la busca en la
// imagen equirrectangular) y los paneles (rectángulos con la textura del canvas
// donde se repitieron las operaciones de disposicion.ts). Sirve igual para la
// pantalla y para cada ojo del visor: recibe la proyección y la vista.

import type { Color, Medir, Op, Panel } from './disposicion.ts';
import { modeloDePanel } from './disposicion.ts';
import type { Mat4 } from './matematica.ts';
import { invertir, multiplicar, traslacion } from './matematica.ts';

export const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FUENTE_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

// Paleta oscura y de alto contraste: en el visor el fondo claro cansa y
// encandila. El amarillo de seguridad es el único acento.
export const PALETA: Record<Color, string> = {
  fondo: 'rgba(15, 20, 26, 0.93)',
  superficie: '#1d2630',
  tinta: '#eef2f5',
  tenue: '#9aa7b4',
  linea: '#34414e',
  acento: '#f2bb1d',
  acento_tinta: '#1a1400',
  bien: '#4cc38a',
  mal: '#ff6b5e',
  medio: '#e3a23b',
  boton: '#232e39',
  boton_activo: '#34434f',
  pantalla: '#07100b',
  pantalla_texto: '#9be7b4',
};

const fuenteDe = (tam: number, peso: number, mono?: boolean) => `${peso} ${tam}px ${mono ? FUENTE_MONO : FUENTE}`;

export function crearMedidor(ctx: CanvasRenderingContext2D): Medir {
  const cache = new Map<string, number>();
  return (texto, tam, peso) => {
    const k = `${peso}|${tam}|${texto}`;
    let w = cache.get(k);
    if (w === undefined) {
      ctx.font = fuenteDe(tam, peso);
      w = ctx.measureText(texto).width;
      cache.set(k, w);
    }
    return w;
  };
}

function rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function pintarOps(ctx: CanvasRenderingContext2D, ops: Op[]): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const op of ops) {
    if (op.tipo === 'rect') {
      rectRedondeado(ctx, op.x, op.y, op.w, op.h, op.radio ?? 0);
      ctx.fillStyle = PALETA[op.color];
      ctx.fill();
      if (op.borde) { ctx.lineWidth = 3; ctx.strokeStyle = PALETA[op.borde]; ctx.stroke(); }
    } else if (op.tipo === 'barra') {
      rectRedondeado(ctx, op.x, op.y, op.w, op.h, op.h / 2);
      ctx.fillStyle = PALETA.linea;
      ctx.fill();
      if (op.fraccion > 0) {
        rectRedondeado(ctx, op.x, op.y, Math.max(op.h, op.w * op.fraccion), op.h, op.h / 2);
        ctx.fillStyle = PALETA[op.color];
        ctx.fill();
      }
    } else {
      ctx.font = fuenteDe(op.tam, op.peso, op.mono);
      ctx.fillStyle = PALETA[op.color];
      ctx.textAlign = op.alinear === 'centro' ? 'center' : op.alinear === 'der' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(op.texto, op.x, op.y);
    }
  }
}

// Panorama provisional mientras no existan las fotos 360° reales de cada
// entorno (blob/...). Cielo, piso, horizonte y rumbos para orientarse, y el
// nombre del entorno escrito tres veces alrededor.
export function panoramaProvisional(titulo: string, interior: boolean, leyenda: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext('2d')!;
  const cielo = ctx.createLinearGradient(0, 0, 0, 512);
  cielo.addColorStop(0, interior ? '#0d1013' : '#4f6f91');
  cielo.addColorStop(1, interior ? '#2a2d2f' : '#c8d4de');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, 2048, 512);
  const piso = ctx.createLinearGradient(0, 512, 0, 1024);
  piso.addColorStop(0, interior ? '#3a3631' : '#7d7466');
  piso.addColorStop(1, interior ? '#141210' : '#3a352e');
  ctx.fillStyle = piso;
  ctx.fillRect(0, 512, 2048, 512);
  // Paralelos y meridianos tenues: dan sensación de volumen al girar.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  for (let lat = 1; lat < 6; lat += 1) { ctx.beginPath(); ctx.moveTo(0, lat * 1024 / 6); ctx.lineTo(2048, lat * 1024 / 6); ctx.stroke(); }
  for (let lon = 0; lon < 24; lon += 1) { ctx.beginPath(); ctx.moveTo(lon * 2048 / 24, 0); ctx.lineTo(lon * 2048 / 24, 1024); ctx.stroke(); }
  ctx.fillStyle = '#f2bb1d';
  ctx.fillRect(0, 510, 2048, 4);
  ctx.font = `600 14px ${FUENTE_MONO}`;
  ctx.textAlign = 'center';
  for (let g = 0; g < 360; g += 30) {
    const x = ((g / 360 + 0.5) % 1) * 2048;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`${g}°`, x, 534);
  }
  for (let k = 0; k < 3; k += 1) {
    const x = ((k / 3 + 0.5 + 1 / 6) % 1) * 2048;
    ctx.font = `600 18px ${FUENTE}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(titulo, x, 300);
    ctx.font = `500 12px ${FUENTE_MONO}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(leyenda, x, 322);
  }
  return c;
}

// ---------------------------------------------------------------- WebGL

const VS_PANORAMA = `#version 300 es
in vec2 p;
out vec2 ndc;
void main() { ndc = p; gl_Position = vec4(p, 0.99999, 1.0); }`;

const FS_PANORAMA = `#version 300 es
precision highp float;
in vec2 ndc;
uniform mat4 invVP;
uniform sampler2D tex;
out vec4 color;
const float PI = 3.141592653589793;
void main() {
  vec4 w = invVP * vec4(ndc, 1.0, 1.0);
  vec3 d = normalize(w.xyz / w.w);
  float u = atan(d.x, -d.z) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  color = texture(tex, vec2(u, v));
}`;

const VS_PANEL = `#version 300 es
in vec2 p;
uniform mat4 mvp;
uniform vec2 tam;
out vec2 uv;
void main() {
  uv = vec2(p.x + 0.5, 0.5 - p.y);
  gl_Position = mvp * vec4(p.x * tam.x, p.y * tam.y, 0.0, 1.0);
}`;

const FS_PANEL = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D tex;
out vec4 color;
void main() { color = texture(tex, uv); }`;

function compilar(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const prog = gl.createProgram()!;
  for (const [tipo, fuente] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(tipo)!;
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`sombreador: ${gl.getShaderInfoLog(s)}`);
    gl.attachShader(prog, s);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`programa: ${gl.getProgramInfoLog(prog)}`);
  return prog;
}

export type Textura = { tex: WebGLTexture; subir(fuente: TexImageSource): void };

export type ObjetoPanel = { panel: Panel; textura: Textura };
export type Cursor = { panel: Panel; x: number; y: number } | null; // metros en el plano del panel

export type Renderizador = {
  gl: WebGL2RenderingContext;
  crearTextura(): Textura;
  // Dibuja una vista completa (la pantalla o un ojo). `vista` es mundo → ojo.
  dibujar(proyeccion: Mat4, vista: Mat4, panorama: Textura, paneles: ObjetoPanel[], cursor: Cursor, cursorTex: Textura): void;
};

export function crearRenderizador(gl: WebGL2RenderingContext): Renderizador {
  const progPan = compilar(gl, VS_PANORAMA, FS_PANORAMA);
  const progPanel = compilar(gl, VS_PANEL, FS_PANEL);

  const vaoPan = gl.createVertexArray()!;
  gl.bindVertexArray(vaoPan);
  const bufPan = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, bufPan);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const locPan = gl.getAttribLocation(progPan, 'p');
  gl.enableVertexAttribArray(locPan);
  gl.vertexAttribPointer(locPan, 2, gl.FLOAT, false, 0, 0);

  const vaoQuad = gl.createVertexArray()!;
  gl.bindVertexArray(vaoQuad);
  const bufQuad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
  const locQuad = gl.getAttribLocation(progPanel, 'p');
  gl.enableVertexAttribArray(locQuad);
  gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uInvVP = gl.getUniformLocation(progPan, 'invVP');
  const uTexPan = gl.getUniformLocation(progPan, 'tex');
  const uMvp = gl.getUniformLocation(progPanel, 'mvp');
  const uTam = gl.getUniformLocation(progPanel, 'tam');
  const uTexPanel = gl.getUniformLocation(progPanel, 'tex');

  const crearTextura = (): Textura => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return {
      tex,
      subir(fuente) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      },
    };
  };

  const dibujarQuad = (vp: Mat4, modelo: Mat4, ancho: number, alto: number, t: Textura) => {
    gl.uniformMatrix4fv(uMvp, false, multiplicar(vp, modelo));
    gl.uniform2f(uTam, ancho, alto);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    gl,
    crearTextura,
    dibujar(proyeccion, vista, panorama, paneles, cursor, cursorTex) {
      gl.activeTexture(gl.TEXTURE0);
      // Panorama: solo la rotación de la vista. El fondo está "en el
      // infinito": acercar la cabeza no lo acerca.
      const rot = new Float32Array(vista);
      rot[12] = 0; rot[13] = 0; rot[14] = 0;
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.useProgram(progPan);
      gl.bindVertexArray(vaoPan);
      gl.uniformMatrix4fv(uInvVP, false, invertir(multiplicar(proyeccion, rot)));
      gl.uniform1i(uTexPan, 0);
      gl.bindTexture(gl.TEXTURE_2D, panorama.tex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(progPanel);
      gl.bindVertexArray(vaoQuad);
      gl.uniform1i(uTexPanel, 0);
      const vp = multiplicar(proyeccion, vista);
      for (const o of paneles) dibujarQuad(vp, modeloDePanel(o.panel), o.panel.ancho_m, o.panel.alto_m, o.textura);
      if (cursor) {
        const m = multiplicar(modeloDePanel(cursor.panel), traslacion(cursor.x, cursor.y, 0.004));
        dibujarQuad(vp, m, 0.028, 0.028, cursorTex);
      }
      gl.bindVertexArray(null);
    },
  };
}

export function texturaCursor(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(242,187,29,0.95)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(15,20,26,0.9)';
  ctx.stroke();
  return c;
}
