// Perfil xAPI de Safety VR — canal de evidencia de ADR-002.
//
// Convierte los eventos fechados de la sesión en statements xAPI 1.0.3: los
// hechos que se auditan, se exportan y se entregan a un LMS ajeno (inició,
// respondió en el nodo X, omitió un requisito, se le agotó el tiempo, aprobó o
// reprobó con N, abandonó). La entrada a cada nodo no se emite: el camino ya
// queda en las respuestas, y el registro denso va por el canal binario aparte.
//
// ADR-001, doble ciega de desempeño: el actor se identifica con una cuenta
// (plataforma + id del trabajador), nunca con nombre ni correo.

import type { Escenario, Resultado } from '../escenario/tipos.ts';
import type { EventoFechado } from '../motor/sesion.ts';
import type { GeneradorUuid } from './uuidv7.ts';

export const VERSION_XAPI = '1.0.3';

// Verbos estándar de ADL donde existen; los propios del perfil cuelgan de la
// raíz del perfil, que es configurable (el dominio definitivo está por decidir).
const ADL = 'http://adlnet.gov/expapi/verbs';
export const VERBOS = {
  inicio: { id: `${ADL}/initialized`, display: { 'es-CO': 'inició', en: 'initialized' } },
  respondio: { id: `${ADL}/answered`, display: { 'es-CO': 'respondió', en: 'answered' } },
  aprobo: { id: `${ADL}/passed`, display: { 'es-CO': 'aprobó', en: 'passed' } },
  reprobo: { id: `${ADL}/failed`, display: { 'es-CO': 'reprobó', en: 'failed' } },
  abandono: { id: `${ADL}/terminated`, display: { 'es-CO': 'abandonó', en: 'terminated' } },
} as const;
export const VERBOS_PERFIL = {
  requisito: { ruta: 'verbos/omitio-requisito', display: { 'es-CO': 'omitió un requisito', en: 'skipped a requirement' } },
  tiempo: { ruta: 'verbos/agoto-tiempo', display: { 'es-CO': 'agotó el tiempo', en: 'ran out of time' } },
} as const;

export type Verbo = { id: string; display: Record<string, string> };
export type Actividad = {
  objectType: 'Activity';
  id: string;
  definition?: { type?: string; name?: Record<string, string> };
};
export type Statement = {
  id: string;
  version: string;
  actor: { objectType: 'Agent'; account: { homePage: string; name: string } };
  verb: Verbo;
  object: Actividad;
  result?: {
    success?: boolean;
    completion?: boolean;
    response?: string;
    duration?: string;
    score?: { raw: number; min: number; max: number; scaled: number };
    extensions?: Record<string, unknown>;
  };
  context: {
    registration: string;
    platform: string;
    language: string;
    contextActivities?: { parent?: Actividad[] };
    extensions: Record<string, unknown>;
  };
  timestamp: string;
};

export type ContextoSesion = {
  perfil: string;            // raíz IRI del perfil, p. ej. https://<dominio>/xapi/safetyvr
  plataforma: string;        // homePage de la cuenta del actor
  trabajadorId: string;      // id interno, sin PII
  sesionId: string;          // UUIDv7 que generó el visor: es el registration
  versionSimulador: string;  // la evidencia guarda la versión que la produjo
  dispositivoId: string;
  idioma: string;
  iniciadaEnMs: number;      // hora de pared (Date.now) al iniciar
  duracionS?: number;        // tiempo activo, sin pausas (Sesion.duracionS); si falta, el del reloj
};

// ISO 8601 de una duración en segundos, con hasta dos decimales: PT83.25S.
export function duracionIso(segundos: number): string {
  const s = Math.max(0, Math.round(segundos * 100) / 100);
  return `PT${s}S`;
}

export function crearStatements(doc: Escenario, eventos: EventoFechado[], ctx: ContextoSesion, uuid: GeneradorUuid): Statement[] {
  const perfil = ctx.perfil.replace(/\/+$/, '');
  const escenarioId = `${perfil}/escenarios/${encodeURIComponent(doc.codigo)}/${encodeURIComponent(doc.version)}`;
  const escenario: Actividad = {
    objectType: 'Activity',
    id: escenarioId,
    definition: { type: 'http://adlnet.gov/expapi/activities/simulation', name: { ...doc.titulo } },
  };
  const nodo = (id: string): Actividad => ({
    objectType: 'Activity',
    id: `${escenarioId}/nodos/${encodeURIComponent(id)}`,
    definition: { type: 'http://adlnet.gov/expapi/activities/interaction' },
  });
  const verboPerfil = (v: { ruta: string; display: Record<string, string> }): Verbo => ({ id: `${perfil}/${v.ruta}`, display: { ...v.display } });
  const ext = (k: string) => `${perfil}/extensiones/${k}`;

  const base = eventos.length ? eventos[0]!.en_ms : 0;
  const cuando = (e: EventoFechado) => new Date(ctx.iniciadaEnMs + (e.en_ms - base)).toISOString();
  const resultadoExt = (criterio: string | undefined, resultado: Resultado | undefined) => {
    const x: Record<string, unknown> = {};
    if (criterio !== undefined) x[ext('criterio')] = criterio;
    if (resultado !== undefined) x[ext('resultado')] = resultado;
    return x;
  };

  const salida: Statement[] = [];
  const emitir = (e: EventoFechado, verb: Verbo, object: Actividad, result?: Statement['result']) => {
    const s: Statement = {
      id: uuid(),
      version: VERSION_XAPI,
      actor: { objectType: 'Agent', account: { homePage: ctx.plataforma, name: ctx.trabajadorId } },
      verb: { id: verb.id, display: { ...verb.display } },
      object,
      context: {
        registration: ctx.sesionId,
        platform: 'Safety VR WebXR',
        language: ctx.idioma,
        extensions: {
          [ext('version-simulador')]: ctx.versionSimulador,
          [ext('dispositivo')]: ctx.dispositivoId,
          [ext('evento')]: e.n,
        },
      },
      timestamp: cuando(e),
    };
    if (object.id !== escenarioId) s.context.contextActivities = { parent: [{ objectType: 'Activity', id: escenarioId }] };
    if (result) s.result = result;
    salida.push(s);
  };

  for (const e of eventos) {
    if (e.tipo === 'inicio') emitir(e, VERBOS.inicio, escenario);
    else if (e.tipo === 'accion') {
      emitir(e, VERBOS.respondio, nodo(e.nodo!), {
        response: e.accion!,
        success: e.resultado === 'correcto',
        extensions: resultadoExt(e.criterio, e.resultado),
      });
    } else if (e.tipo === 'requisito_faltante') {
      emitir(e, verboPerfil(VERBOS_PERFIL.requisito), nodo(e.nodo!), {
        success: false,
        extensions: resultadoExt(e.criterio, e.resultado),
      });
    } else if (e.tipo === 'tiempo_agotado') {
      const r: Statement['result'] = { extensions: resultadoExt(e.criterio, e.resultado) };
      if (e.resultado !== undefined) r.success = e.resultado === 'correcto';
      emitir(e, verboPerfil(VERBOS_PERFIL.tiempo), nodo(e.nodo!), r);
    } else if (e.tipo === 'fin' || e.tipo === 'abandono') {
      const segundos = ctx.duracionS ?? (e.en_ms - base) / 1000;
      if (e.tipo === 'abandono') {
        emitir(e, VERBOS.abandono, escenario, { completion: false, success: false, duration: duracionIso(segundos) });
      } else {
        const apto = e.veredicto === 'apto';
        const puntaje = e.puntaje ?? 0;
        emitir(e, apto ? VERBOS.aprobo : VERBOS.reprobo, escenario, {
          completion: true,
          success: apto,
          duration: duracionIso(segundos),
          score: { raw: puntaje, min: 0, max: 100, scaled: puntaje / 100 },
        });
      }
    }
  }
  return salida;
}
