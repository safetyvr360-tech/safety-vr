// Sesión de Safety VR — el motor con reloj. Primera capa del adaptador WebXR.
//
// maquina.ts no sabe qué hora es, a propósito: así se prueba entero. Esta capa
// le pone el tiempo encima con un reloj INYECTADO (en el visor, performance.now;
// en las pruebas, un reloj de mentira), y se encarga de tres cosas:
// 1. El plazo de cada nodo: al entrar a un nodo con tiempo_limite_s arranca la
//    cuenta; `revisarReloj()` dispara `agotarTiempo()` una sola vez si venció.
// 2. La pausa: si el trabajador se quita el visor, el plazo se congela y no se
//    puede actuar hasta reanudar. El tiempo en pausa no cuenta en la duración.
// 3. La hora de cada evento: cada evento del motor sale fechado, que es lo que
//    necesita un statement xAPI (ADR-002). Si el plazo venció mientras nadie
//    revisaba el reloj (el visor se durmió), el evento lleva la hora del
//    vencimiento, no la de la revisión.

import type { Escenario } from '../escenario/tipos.ts';
import { crearMaquina, ErrorMotor } from './maquina.ts';
import type { Estado, Evento, Paso } from './maquina.ts';

export type Reloj = () => number; // milisegundos, monótono

export type EventoFechado = Evento & { en_ms: number };

export type Sesion = {
  iniciar(): Estado;
  estadoActual(): Estado;
  ejecutar(accionId: string): Paso;
  abandonar(): Estado;
  pausar(): void;
  reanudar(): void;
  enPausa(): boolean;
  // Milisegundos que le quedan al nodo actual; null si no tiene límite o si la
  // cuenta ya se cerró (sesión terminada o límite orientativo ya agotado).
  restanteMs(): number | null;
  // El adaptador lo llama en cada cuadro. Devuelve el paso si el plazo venció.
  revisarReloj(): Paso | null;
  eventos(): EventoFechado[];
  // Segundos activos de la sesión, sin contar las pausas.
  duracionS(): number;
};

export function crearSesion(doc: Escenario, reloj: Reloj): Sesion {
  const m = crearMaquina(doc);
  const fechados: EventoFechado[] = [];
  let plazo: number | null = null;      // instante en que vence el nodo actual
  let pausaDesde: number | null = null;
  let pausado = 0;                      // milisegundos acumulados en pausa
  let inicio: number | null = null;
  let fin: number | null = null;

  const vivo = () => m.estadoActual().fase === 'en_curso';

  // Fecha los eventos nuevos del motor y, si alguno es una entrada a nodo,
  // arranca (o quita) el plazo de ese nodo.
  const sincronizar = (estado: Estado, ahora: number) => {
    let entro = false;
    for (const e of estado.eventos.slice(fechados.length)) {
      fechados.push({ ...e, en_ms: ahora });
      if (e.tipo === 'entrada_nodo') entro = true;
    }
    if (estado.fase !== 'en_curso') {
      plazo = null;
      if (fin === null) fin = ahora;
    } else if (entro) {
      const lim = estado.nodo!.tiempo_limite_s;
      plazo = lim === undefined ? null : ahora + lim * 1000;
    }
  };

  const exigirSinPausa = () => {
    if (pausaDesde !== null) throw new ErrorMotor('en_pausa');
  };

  return {
    iniciar() {
      const ahora = reloj();
      const e = m.iniciar();
      inicio = ahora;
      sincronizar(e, ahora);
      return e;
    },

    estadoActual() {
      return m.estadoActual();
    },

    ejecutar(accionId: string) {
      exigirSinPausa();
      const p = m.ejecutar(accionId);
      sincronizar(p.estado, reloj());
      return p;
    },

    abandonar() {
      const ahora = reloj();
      if (pausaDesde !== null) { pausado += ahora - pausaDesde; pausaDesde = null; }
      const e = m.abandonar();
      sincronizar(e, ahora);
      return e;
    },

    pausar() {
      const fase = m.estadoActual().fase;
      if (fase === 'sin_iniciar') throw new ErrorMotor('no_iniciada');
      if (fase !== 'en_curso') throw new ErrorMotor('ya_terminada');
      if (pausaDesde === null) pausaDesde = reloj();
    },

    reanudar() {
      if (pausaDesde === null) return;
      const congelado = reloj() - pausaDesde;
      pausado += congelado;
      if (plazo !== null) plazo += congelado;
      pausaDesde = null;
    },

    enPausa() {
      return pausaDesde !== null;
    },

    restanteMs() {
      if (plazo === null) return null;
      const ahora = pausaDesde ?? reloj();
      return Math.max(0, plazo - ahora);
    },

    revisarReloj() {
      if (plazo === null || pausaDesde !== null || !vivo()) return null;
      if (reloj() < plazo) return null;
      const vencio = plazo;
      plazo = null; // una sola vez por entrada al nodo
      const p = m.agotarTiempo();
      sincronizar(p.estado, vencio);
      return p;
    },

    eventos() {
      return fechados.map((e) => ({ ...e }));
    },

    duracionS() {
      if (inicio === null) return 0;
      // En pausa, el tiempo se mide hasta que empezó la pausa.
      const hasta = fin ?? pausaDesde ?? reloj();
      return Math.round((hasta - inicio - pausado) / 1000);
    },
  };
}
