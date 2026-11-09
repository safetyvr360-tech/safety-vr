// JSON canónico y firma HMAC-SHA256 del paquete de sesión.
//
// "Guarda la sesión firmada en disco" (arquitectura, §4b): el visor firma el
// paquete con la clave de su token de dispositivo; el servidor recalcula la
// firma y rechaza el paquete si alguien tocó un solo carácter (un puntaje, un
// veredicto). Para que visor y servidor firmen exactamente los mismos bytes, el
// JSON se escribe en forma canónica: claves ordenadas, sin espacios.
//
// Usa WebCrypto (crypto.subtle), que existe igual en Node 22 y en el navegador
// del visor. Sin dependencias.

export function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') {
    if (typeof valor === 'number' && !Number.isFinite(valor)) throw new Error('numero_no_finito');
    if (valor === undefined) throw new Error('valor_indefinido');
    return JSON.stringify(valor);
  }
  if (Array.isArray(valor)) return `[${valor.map((v) => (v === undefined ? 'null' : canonico(v))).join(',')}]`;
  const o = valor as Record<string, unknown>;
  const claves = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
}

const base64url = (b: ArrayBuffer) => {
  let s = '';
  for (const x of new Uint8Array(b)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function clave(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function firmar(contenido: unknown, secreto: string): Promise<string> {
  if (!secreto) throw new Error('secreto_vacio');
  const sig = await crypto.subtle.sign('HMAC', await clave(secreto), new TextEncoder().encode(canonico(contenido)));
  return base64url(sig);
}

// Comparación en tiempo constante: no revelar por el tiempo de respuesta
// cuántos caracteres de la firma acertó un atacante.
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Nunca lanza por un paquete mal formado: lo que no se puede verificar es
// sencillamente inválido. El servidor responde "rechazado", no se cae.
export async function verificar(contenido: unknown, firma: unknown, secreto: string): Promise<boolean> {
  if (typeof firma !== 'string' || firma === '') return false;
  try {
    return iguales(await firmar(contenido, secreto), firma);
  } catch {
    return false;
  }
}

// Huella pública SHA-256 (hex) del JSON canónico. A diferencia de la firma, no
// usa secreto: cualquier tercero puede recalcularla. Es la base del hash
// encadenado de los certificados.
export async function huella(contenido: unknown): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonico(contenido)));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
