// Código de verificación del certificado: lo que va impreso y en el QR, y lo
// que un tercero teclea en la página pública de verificación.
//
//   SVR-7K3M-9QXP-2HDA
//
// Alfabeto Crockford base32 (sin I, L, O ni U: no se confunden al dictarlo ni
// al leerlo de un papel), 11 caracteres al azar y un dígito de control Luhn
// mod 32: un carácter mal tecleado o dos vecinos intercambiados se detectan
// antes de consultar el servidor.

import type { Azar } from '../telemetria/uuidv7.ts';
import { azarDelSistema } from '../telemetria/uuidv7.ts';

export const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const N = ALFABETO.length; // 32
const PREFIJO = 'SVR';

const valor = (c: string) => ALFABETO.indexOf(c);

// Dígito de control Luhn mod N (el algoritmo de Luhn generalizado).
export function digitoControl(cuerpo: string): string {
  let factor = 2;
  let suma = 0;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    let sumando = factor * valor(cuerpo[i]!);
    factor = factor === 2 ? 1 : 2;
    sumando = Math.floor(sumando / N) + (sumando % N);
    suma += sumando;
  }
  return ALFABETO[(N - (suma % N)) % N]!;
}

function controlValido(conControl: string): boolean {
  let factor = 1;
  let suma = 0;
  for (let i = conControl.length - 1; i >= 0; i -= 1) {
    let sumando = factor * valor(conControl[i]!);
    factor = factor === 2 ? 1 : 2;
    sumando = Math.floor(sumando / N) + (sumando % N);
    suma += sumando;
  }
  return suma % N === 0;
}

const formatear = (doce: string) => `${PREFIJO}-${doce.slice(0, 4)}-${doce.slice(4, 8)}-${doce.slice(8, 12)}`;

export function generarCodigo(azar: Azar = azarDelSistema): string {
  // 32 divide exacto a 256: tomar el byte módulo 32 no sesga ningún carácter.
  const b = azar(new Uint8Array(11));
  const cuerpo = [...b].map((x) => ALFABETO[x % N]).join('');
  return formatear(cuerpo + digitoControl(cuerpo));
}

// Acepta lo que una persona teclea: minúsculas, espacios, guiones, con o sin
// el prefijo, y las confusiones típicas (O por 0, I o L por 1). Devuelve el
// código en su forma única, o null si no es un código válido.
export function normalizarCodigo(texto: string): string | null {
  let s = texto.toUpperCase().replace(/[\s\-_.]/g, '');
  if (s.startsWith(PREFIJO)) s = s.slice(PREFIJO.length);
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== 12 || [...s].some((c) => valor(c) < 0)) return null;
  return controlValido(s) ? formatear(s) : null;
}
