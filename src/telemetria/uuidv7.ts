// UUIDv7 (RFC 9562) — el id de la sesión lo genera el visor, sin red.
//
// 48 bits de milisegundos Unix al frente: los ids se ordenan por fecha, y el
// servidor puede hacer upsert con ellos (la sincronización es idempotente).
// Dentro del mismo milisegundo se usa un contador de 12 bits (método 1 del
// RFC) para que dos ids seguidos nunca salgan desordenados.
//
// El reloj y el azar se inyectan: así se prueba sin depender de la hora real.

export type Azar = (bytes: Uint8Array) => Uint8Array;

export const azarDelSistema: Azar = (b) => globalThis.crypto.getRandomValues(b);

export type GeneradorUuid = () => string;

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export function crearGeneradorUuidv7(reloj: () => number = Date.now, azar: Azar = azarDelSistema): GeneradorUuid {
  let ultimoMs = -1;
  let contador = 0;
  return () => {
    let ms = Math.floor(reloj());
    if (ms < ultimoMs) ms = ultimoMs; // el reloj retrocedió: no romper el orden
    const b = azar(new Uint8Array(16));
    if (ms === ultimoMs) {
      contador += 1;
      if (contador > 0xfff) { ms += 1; contador = 0; } // contador agotado: avanzar un milisegundo
    } else {
      contador = ((b[6]! & 0x0f) << 8 | b[7]!) & 0x7ff; // arranque aleatorio con margen para subir
    }
    ultimoMs = ms;
    for (let i = 5; i >= 0; i -= 1) { b[i] = ms % 256; ms = Math.floor(ms / 256); }
    b[6] = 0x70 | (contador >> 8);      // versión 7
    b[7] = contador & 0xff;
    b[8] = 0x80 | (b[8]! & 0x3f);       // variante RFC
    const h = hex(b);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
}

export const FORMATO_UUIDV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Milisegundos Unix que lleva un UUIDv7.
export function msDeUuidv7(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
