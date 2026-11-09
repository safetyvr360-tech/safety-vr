// Visor de Safety VR — tercera capa del adaptador: une sesión, presentador,
// disposición y dibujo en un canvas.
//
// Dos modos con el mismo dibujo:
// - Pantalla (PC, teléfono, tableta): se mira alrededor arrastrando y se elige
//   tocando o haciendo clic.
// - Realidad virtual (WebXR immersive-vr, p. ej. Meta Quest): se mira con la
//   cabeza y se elige con el gatillo del control, la mano o la mirada.
// Quitarse el visor (o esconder la pestaña) pausa la sesión; volver la reanuda.

import type { Escenario } from '../escenario/tipos.ts';
import { crearSesion } from '../motor/sesion.ts';
import type { Reloj, Sesion } from '../motor/sesion.ts';
import { ErrorMotor } from '../motor/maquina.ts';
import type { Paso } from '../motor/maquina.ts';
import { presentar, traducir } from '../motor/presentador.ts';
import type { Catalogos, Idioma, Vista } from '../motor/presentador.ts';
import {
  BOTON_REPETIR, PANELES, botonEn, disponerInstrumentos, disponerPrincipal, disponerRubrica, impactoMasCercano, modeloDePanel,
} from './disposicion.ts';
import type { Dibujo, Impacto, Panel } from './disposicion.ts';
import type { Rayo } from './matematica.ts';
import { multiplicar, perspectiva, rayoDesdePantalla, rayoDesdePose, vistaDesdeAngulos } from './matematica.ts';
import { crearMedidor, crearRenderizador, panoramaProvisional, pintarOps, texturaCursor } from './dibujo.ts';
import type { Cursor, ObjetoPanel, Textura } from './dibujo.ts';

export type OpcionesVisor = {
  canvas: HTMLCanvasElement;
  doc: Escenario;
  catalogos: Catalogos;
  idioma: Idioma;
  reloj?: Reloj;
  // Fotos 360° reales por id de entorno. Sin ellas se usa el panorama provisional.
  panoramas?: Record<string, TexImageSource>;
  alCambiar?: (s: Sesion, v: Vista) => void;
};

export type Visor = {
  sesion(): Sesion;
  vista(): Vista;
  reiniciar(): void;
  // Repinta después de actuar sobre la sesión desde afuera (pausar, abandonar).
  refrescar(): void;
  cambiarIdioma(i: Idioma): void;
  mirar(yaw: number, pitch: number): void;
  // Elegir con un punto de la pantalla (píxeles CSS del canvas). Devuelve el id elegido.
  elegirEnPantalla(x: number, y: number): string | null;
  // Dónde cae en la pantalla (píxeles CSS del canvas) el centro de cada botón
  // visible del panel principal. Sirve para pruebas y para accesibilidad.
  botonesEnPantalla(): { id: string; x: number; y: number }[];
  rvDisponible(): Promise<boolean>;
  entrarRV(): Promise<void>;
  enRV(): boolean;
  destruir(): void;
};

const GRADO = Math.PI / 180;

export function crearVisor(o: OpcionesVisor): Visor {
  const canvas = o.canvas;
  const gl = canvas.getContext('webgl2', { antialias: true, xrCompatible: true } as WebGLContextAttributes) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('webgl2_no_disponible');
  const r = crearRenderizador(gl);
  const reloj = o.reloj ?? (() => performance.now());
  let idioma = o.idioma;
  let sesion = crearSesion(o.doc, reloj);
  let ultimoPaso: Paso | null = null;
  const t = (clave: string, vars?: Record<string, string | number>) => traducir(o.catalogos[idioma], clave, vars);

  // Un canvas 2D por panel; la textura se vuelve a subir solo si cambió lo dibujado.
  const lienzos = new Map<Panel['id'], { ctx: CanvasRenderingContext2D; textura: Textura; huella: string; dibujo: Dibujo | null }>();
  for (const p of PANELES) {
    const c = document.createElement('canvas');
    c.width = p.ancho_px;
    c.height = p.alto_px;
    lienzos.set(p.id, { ctx: c.getContext('2d')!, textura: r.crearTextura(), huella: '', dibujo: null });
  }
  const medir = crearMedidor(lienzos.get('principal')!.ctx);
  const objetos: ObjetoPanel[] = PANELES.map((p) => ({ panel: p, textura: lienzos.get(p.id)!.textura }));
  const cursorTex = r.crearTextura();
  cursorTex.subir(texturaCursor());

  const panoramas = new Map<string, Textura>();
  const panoramaDe = (entornoId: string): Textura => {
    let tx = panoramas.get(entornoId);
    if (!tx) {
      tx = r.crearTextura();
      const real = o.panoramas?.[entornoId];
      const ent = o.doc.entornos.find((e) => e.id === entornoId);
      const titulo = ent ? ent.titulo[idioma] ?? ent.titulo[o.doc.idiomas[0]!] ?? entornoId : entornoId;
      tx.subir(real ?? panoramaProvisional(titulo, entornoId.includes('interior'), t('visor.panorama_provisional')));
      panoramas.set(entornoId, tx);
    }
    return tx;
  };

  let yaw = 0;
  let pitch = 0;
  let resaltado: string | null = null;
  let cursor: Cursor = null;
  let vistaActual: Vista = calcularVista();
  let xr: XRSession | null = null;
  let refEspacio: XRReferenceSpace | null = null;
  let cuadro = 0;
  let pausadoPorVisibilidad = false;
  let destruido = false;

  function calcularVista(): Vista {
    return presentar({
      doc: o.doc, estado: sesion.estadoActual(), catalogos: o.catalogos, idioma, ultimoPaso,
      restanteMs: sesion.restanteMs(), enPausa: sesion.enPausa(),
    });
  }

  function repintar() {
    vistaActual = calcularVista();
    for (const p of PANELES) {
      const l = lienzos.get(p.id)!;
      let d: Dibujo;
      if (p.id === 'principal') d = disponerPrincipal(vistaActual, { ancho: p.ancho_px, alto: p.alto_px, medir, resaltado, textoRepetir: t('visor.repetir') });
      else if (p.id === 'instrumentos') d = disponerInstrumentos(vistaActual, p.ancho_px, p.alto_px, t('visor.instrumentos'));
      else d = disponerRubrica(vistaActual, p.ancho_px, p.alto_px, t('visor.rubrica'), t('motor.rubrica.critico'), medir);
      l.dibujo = d;
      const huella = JSON.stringify(d.ops);
      if (huella !== l.huella) {
        pintarOps(l.ctx, d.ops);
        l.textura.subir(l.ctx.canvas);
        l.huella = huella;
      }
    }
  }

  function apuntar(rayo: Rayo | null): Impacto | null {
    const i = rayo ? impactoMasCercano(rayo) : null;
    if (i) {
      const p = PANELES.find((x) => x.id === i.panel)!;
      cursor = { panel: p, x: (i.u - 0.5) * p.ancho_m, y: (0.5 - i.v) * p.alto_m };
    } else cursor = null;
    const id = i && i.panel === 'principal' ? botonEn(lienzos.get('principal')!.dibujo?.botones ?? [], i.px, i.py) : null;
    if (id !== resaltado) { resaltado = id; repintar(); }
    return i;
  }

  function elegir(rayo: Rayo): string | null {
    const i = apuntar(rayo);
    if (!i || i.panel !== 'principal') return null;
    const id = botonEn(lienzos.get('principal')!.dibujo?.botones ?? [], i.px, i.py);
    if (!id) return null;
    if (id === BOTON_REPETIR) { reiniciar(); return id; }
    try {
      ultimoPaso = sesion.ejecutar(id);
    } catch (e) {
      if (e instanceof ErrorMotor && e.codigo === 'en_pausa') return null;
      throw e;
    }
    avisar();
    return id;
  }

  function avisar() {
    repintar();
    o.alCambiar?.(sesion, vistaActual);
  }

  function reiniciar() {
    sesion = crearSesion(o.doc, reloj);
    ultimoPaso = null;
    sesion.iniciar();
    avisar();
  }

  // Un cuadro: revisar el reloj de la sesión y repintar si cambió algo visible.
  let ultimoSegundo: number | null = null;
  function tic() {
    const p = sesion.revisarReloj();
    if (p) { ultimoPaso = p; avisar(); return; }
    const ms = sesion.restanteMs();
    const seg = ms === null ? null : Math.ceil(ms / 1000);
    if (seg !== ultimoSegundo) { ultimoSegundo = seg; repintar(); }
  }

  // ------------------------------------------------------------ modo pantalla
  function proyeccionPantalla() {
    const aspecto = canvas.width / canvas.height;
    // Unos 62° horizontales: el panel principal (53°) llena la pantalla y se
    // lee; nunca menos de 40° verticales, para que quepa su alto (34°).
    const fovY = 2 * Math.atan(Math.max(Math.tan(20 * GRADO), Math.tan(31 * GRADO) / aspecto));
    return perspectiva(fovY, aspecto, 0.05, 100);
  }

  function ajustarTamano() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function dibujarPantalla() {
    if (xr) return;
    ajustarTamano();
    tic();
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.clearColor(0, 0, 0, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    const ent = vistaActual.entorno?.id ?? o.doc.entornos[0]!.id;
    r.dibujar(proyeccionPantalla(), vistaDesdeAngulos(yaw, pitch), panoramaDe(ent), objetos, cursor, cursorTex);
    cuadro = requestAnimationFrame(dibujarPantalla);
  }

  const rayoPantalla = (x: number, y: number): Rayo => {
    const rect = canvas.getBoundingClientRect();
    const nx = ((x - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((y - rect.top) / rect.height) * 2;
    return rayoDesdePantalla(proyeccionPantalla(), vistaDesdeAngulos(yaw, pitch), nx, ny);
  };

  let arrastre: { x: number; y: number; yaw: number; pitch: number; movio: boolean } | null = null;
  const alBajar = (e: PointerEvent) => {
    arrastre = { x: e.clientX, y: e.clientY, yaw, pitch, movio: false };
    canvas.setPointerCapture(e.pointerId);
  };
  const alMover = (e: PointerEvent) => {
    if (arrastre) {
      const dx = e.clientX - arrastre.x;
      const dy = e.clientY - arrastre.y;
      if (Math.hypot(dx, dy) > 6) arrastre.movio = true;
      if (arrastre.movio) {
        const grados = 90 / Math.max(240, canvas.clientWidth / 1.5);
        yaw = arrastre.yaw + dx * grados * GRADO;
        pitch = Math.max(-80 * GRADO, Math.min(80 * GRADO, arrastre.pitch + dy * grados * GRADO));
      }
    }
    apuntar(rayoPantalla(e.clientX, e.clientY));
  };
  const alSubir = (e: PointerEvent) => {
    const fue = arrastre;
    arrastre = null;
    if (fue && !fue.movio) elegir(rayoPantalla(e.clientX, e.clientY));
  };
  const alSalir = () => { if (!arrastre) apuntar(null); };
  const alVisibilidad = () => {
    const vivo = sesion.estadoActual().fase === 'en_curso';
    if (document.hidden && vivo && !sesion.enPausa()) { sesion.pausar(); pausadoPorVisibilidad = true; avisar(); }
    if (!document.hidden && pausadoPorVisibilidad) { sesion.reanudar(); pausadoPorVisibilidad = false; avisar(); }
  };
  canvas.addEventListener('pointerdown', alBajar);
  canvas.addEventListener('pointermove', alMover);
  canvas.addEventListener('pointerup', alSubir);
  canvas.addEventListener('pointerleave', alSalir);
  document.addEventListener('visibilitychange', alVisibilidad);
  canvas.style.touchAction = 'none';

  // ------------------------------------------------------------ modo RV
  async function entrarRV() {
    if (!navigator.xr) throw new Error('webxr_no_disponible');
    const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking'] });
    await gl!.makeXRCompatible();
    s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl!) });
    // 'local': el origen es la cabeza al entrar, así los paneles quedan a la altura de los ojos.
    refEspacio = await s.requestReferenceSpace('local');
    xr = s;
    cancelAnimationFrame(cuadro);
    s.addEventListener('select', (ev: XRInputSourceEvent) => {
      const pose = ev.frame.getPose(ev.inputSource.targetRaySpace, refEspacio!);
      if (pose) elegir(rayoDesdePose(pose.transform.matrix));
    });
    s.addEventListener('visibilitychange', () => {
      const vivo = sesion.estadoActual().fase === 'en_curso';
      if (s.visibilityState !== 'visible' && vivo && !sesion.enPausa()) { sesion.pausar(); avisar(); }
      if (s.visibilityState === 'visible' && sesion.enPausa()) { sesion.reanudar(); avisar(); }
    });
    s.addEventListener('end', () => {
      xr = null;
      refEspacio = null;
      // Al salir de la RV se vuelve a la pantalla, salvo que el visor se haya destruido.
      if (!destruido) cuadro = requestAnimationFrame(dibujarPantalla);
    });
    s.requestAnimationFrame(cuadroRV);
  }

  function cuadroRV(_t: number, frame: XRFrame) {
    const s = frame.session;
    s.requestAnimationFrame(cuadroRV);
    const pose = frame.getViewerPose(refEspacio!);
    if (!pose) return;
    tic();
    // El primer control con pose apunta; si no hay control, apunta la mirada.
    let rayo: Rayo | null = null;
    for (const fuente of s.inputSources) {
      const p = frame.getPose(fuente.targetRaySpace, refEspacio!);
      if (p) { rayo = rayoDesdePose(p.transform.matrix); break; }
    }
    if (!rayo) rayo = rayoDesdePose(pose.transform.matrix);
    apuntar(rayo);
    const capa = s.renderState.baseLayer!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, capa.framebuffer);
    gl!.clearColor(0, 0, 0, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    const ent = vistaActual.entorno?.id ?? o.doc.entornos[0]!.id;
    for (const v of pose.views) {
      const vp = capa.getViewport(v)!;
      gl!.viewport(vp.x, vp.y, vp.width, vp.height);
      r.dibujar(new Float32Array(v.projectionMatrix), new Float32Array(v.transform.inverse.matrix), panoramaDe(ent), objetos, cursor, cursorTex);
    }
  }

  sesion.iniciar();
  repintar();
  cuadro = requestAnimationFrame(dibujarPantalla);

  return {
    sesion: () => sesion,
    vista: () => vistaActual,
    reiniciar,
    refrescar: avisar,
    cambiarIdioma(i) {
      idioma = i;
      panoramas.clear(); // la leyenda del panorama provisional también cambia de idioma
      avisar();
    },
    mirar(y, p) { yaw = y; pitch = p; },
    elegirEnPantalla(x, y) {
      const rect = canvas.getBoundingClientRect();
      return elegir(rayoPantalla(rect.left + x, rect.top + y));
    },
    botonesEnPantalla() {
      const p = PANELES.find((x) => x.id === 'principal')!;
      const vp = multiplicar(proyeccionPantalla(), vistaDesdeAngulos(yaw, pitch));
      const m = multiplicar(vp, modeloDePanel(p));
      const rect = canvas.getBoundingClientRect();
      const salida: { id: string; x: number; y: number }[] = [];
      for (const b of lienzos.get('principal')!.dibujo?.botones ?? []) {
        const lx = ((b.x + b.w / 2) / p.ancho_px - 0.5) * p.ancho_m;
        const ly = (0.5 - (b.y + b.h / 2) / p.alto_px) * p.alto_m;
        const w = m[3]! * lx + m[7]! * ly + m[15]!;
        if (w <= 0) continue;
        const nx = (m[0]! * lx + m[4]! * ly + m[12]!) / w;
        const ny = (m[1]! * lx + m[5]! * ly + m[13]!) / w;
        if (Math.abs(nx) > 1 || Math.abs(ny) > 1) continue;
        salida.push({ id: b.id, x: ((nx + 1) / 2) * rect.width, y: ((1 - ny) / 2) * rect.height });
      }
      return salida;
    },
    async rvDisponible() {
      try { return !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); } catch { return false; }
    },
    entrarRV,
    enRV: () => xr !== null,
    destruir() {
      destruido = true;
      cancelAnimationFrame(cuadro);
      xr?.end();
      canvas.removeEventListener('pointerdown', alBajar);
      canvas.removeEventListener('pointermove', alMover);
      canvas.removeEventListener('pointerup', alSubir);
      canvas.removeEventListener('pointerleave', alSalir);
      document.removeEventListener('visibilitychange', alVisibilidad);
    },
  };
}
