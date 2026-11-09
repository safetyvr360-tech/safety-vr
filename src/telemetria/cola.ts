// Paquete de sesión y cola offline — "offline primero" (arquitectura, §4b).
//
// En planta no hay wifi. Al cerrar una sesión el visor arma un PAQUETE (resumen
// para la tabla `sesion` + statements xAPI), lo firma y lo guarda en la cola.
// Cuando hay red, `sincronizar()` lo envía. La sincronización es idempotente:
// el id del paquete es el UUIDv7 de la sesión y el servidor hace upsert, así
// que reenviar tras un corte nunca duplica una sesión.
//
// El almacenamiento (IndexedDB o localStorage en el visor, un archivo en Unity
// o Unreal), el envío y el reloj se inyectan.

import type { Statement } from './xapi.ts';
import { firmar } from './firma.ts';

export type ResumenSesion = {
  id: string;                 // UUIDv7 de la sesión
  trabajador_id: string;
  version_simulador: string;
  dispositivo_id: string;
  escenario: string;          // código del escenario, p. ej. EC-01
  iniciada_en: string;        // ISO 8601
  duracion_s: number;
  puntaje: number;
  veredicto: 'apto' | 'no_apto' | 'incompleta';
};

export type Paquete = {
  formato: 'safetyvr/sesion@1';
  sesion: ResumenSesion;
  statements: Statement[];
  firma: string;              // HMAC-SHA256 del resto del paquete en JSON canónico
};

export async function armarPaquete(sesion: ResumenSesion, statements: Statement[], secretoDispositivo: string): Promise<Paquete> {
  const contenido = { formato: 'safetyvr/sesion@1' as const, sesion, statements };
  return { ...contenido, firma: await firmar(contenido, secretoDispositivo) };
}

export function contenidoFirmado(p: Paquete): Omit<Paquete, 'firma'> {
  const { firma: _f, ...resto } = p;
  return resto;
}

// ---------------------------------------------------------------- cola

export type Entrada = {
  paquete: Paquete;
  intentos: number;
  proximo_intento_ms: number;
  ultimo_error: string | null;
};

export type EstadoCola = { pendientes: Entrada[]; rechazados: Entrada[] };

export type Almacen = {
  leer(): EstadoCola | null;
  escribir(e: EstadoCola): void;
};

// Lo que responde el servidor:
// - 'aceptado': guardado (o ya estaba: upsert). Sale de la cola.
// - 'rechazado': el servidor dice que el paquete es inválido (firma, formato).
//   No se reintenta: se aparta para revisión, sin perderlo.
// - 'sin_red' / 'error_servidor': se reintenta más tarde con espera creciente.
export type Respuesta = 'aceptado' | 'rechazado' | 'sin_red' | 'error_servidor';
export type Enviar = (p: Paquete) => Promise<Respuesta>;

export type InformeSincronizacion = { enviados: number; rechazados: number; pendientes: number; omitida?: 'en_curso' };

const BASE_ESPERA_MS = 2_000;
const TOPE_ESPERA_MS = 15 * 60_000;

// Espera antes del intento n+1: 2 s, 4 s, 8 s… hasta 15 minutos.
export function espera(intentos: number): number {
  return Math.min(TOPE_ESPERA_MS, BASE_ESPERA_MS * 2 ** Math.max(0, intentos - 1));
}

export type Cola = {
  encolar(p: Paquete): boolean;   // false si ese id ya estaba
  // forzar: ignora la espera de reintento. Para cuando la red acaba de volver
  // (evento 'online'): no tiene sentido esperar el resto del intervalo.
  sincronizar(enviar: Enviar, opciones?: { forzar?: boolean }): Promise<InformeSincronizacion>;
  estado(): EstadoCola;
};

export function crearCola(almacen: Almacen, reloj: () => number = Date.now): Cola {
  const cargar = (): EstadoCola => {
    let e: EstadoCola | null = null;
    try { e = almacen.leer(); } catch { e = null; }
    return e && Array.isArray(e.pendientes) && Array.isArray(e.rechazados) ? e : { pendientes: [], rechazados: [] };
  };
  let sincronizando = false;

  return {
    encolar(p) {
      const e = cargar();
      const id = p.sesion.id;
      if (e.pendientes.some((x) => x.paquete.sesion.id === id) || e.rechazados.some((x) => x.paquete.sesion.id === id)) return false;
      e.pendientes.push({ paquete: p, intentos: 0, proximo_intento_ms: reloj(), ultimo_error: null });
      almacen.escribir(e);
      return true;
    },

    async sincronizar(enviar, opciones = {}) {
      if (sincronizando) {
        const e = cargar();
        return { enviados: 0, rechazados: 0, pendientes: e.pendientes.length, omitida: 'en_curso' };
      }
      sincronizando = true;
      let enviados = 0;
      let rechazados = 0;
      try {
        // En orden: el más antiguo primero (los UUIDv7 se ordenan por fecha).
        const listos = cargar().pendientes
          .filter((x) => opciones.forzar === true || x.proximo_intento_ms <= reloj())
          .sort((a, b) => (a.paquete.sesion.id < b.paquete.sesion.id ? -1 : 1));
        for (const entrada of listos) {
          let r: Respuesta;
          try { r = await enviar(entrada.paquete); } catch { r = 'sin_red'; }
          // Se relee y se escribe después de cada envío: si el visor se apaga a
          // mitad de camino, la cola queda consistente.
          const e = cargar();
          const i = e.pendientes.findIndex((x) => x.paquete.sesion.id === entrada.paquete.sesion.id);
          if (i < 0) continue;
          const actual = e.pendientes[i]!;
          if (r === 'aceptado') {
            e.pendientes.splice(i, 1);
            enviados += 1;
          } else if (r === 'rechazado') {
            e.pendientes.splice(i, 1);
            e.rechazados.push({ ...actual, intentos: actual.intentos + 1, ultimo_error: r });
            rechazados += 1;
          } else {
            actual.intentos += 1;
            actual.ultimo_error = r;
            actual.proximo_intento_ms = reloj() + espera(actual.intentos);
            almacen.escribir(e);
            if (r === 'sin_red') break; // sin red, no tiene sentido intentar los demás ahora
            continue;
          }
          almacen.escribir(e);
        }
      } finally {
        sincronizando = false;
      }
      return { enviados, rechazados, pendientes: cargar().pendientes.length };
    },

    estado() {
      return cargar();
    },
  };
}

// Almacén en memoria, para pruebas y para la previsualización.
export function almacenEnMemoria(inicial: EstadoCola | null = null): Almacen & { crudo(): string | null } {
  let dato: string | null = inicial ? JSON.stringify(inicial) : null;
  return {
    leer: () => (dato ? JSON.parse(dato) as EstadoCola : null),
    escribir: (e) => { dato = JSON.stringify(e); },
    crudo: () => dato,
  };
}
