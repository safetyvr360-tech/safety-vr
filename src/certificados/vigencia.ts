// Vigencia del certificado: la competencia vence y hay que recertificar
// (arquitectura §3.6: certificada → por_vencer → vencida → recertificación).
//
// Las fechas de vigencia son fechas civiles de Colombia (UTC−5, sin horario de
// verano), en texto 'AAAA-MM-DD': un certificado emitido a las 9 p. m. del 31
// de enero en Bogotá es del 31 de enero, aunque en UTC ya sea 1 de febrero.

export type EstadoVigencia = 'vigente' | 'por_vencer' | 'vencido';

export const DESFASE_COLOMBIA_MIN = -300;
export const DIAS_AVISO = 30;

export function fechaCivil(ms: number, desfaseMin = DESFASE_COLOMBIA_MIN): string {
  return new Date(ms + desfaseMin * 60_000).toISOString().slice(0, 10);
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function partes(fecha: string): [number, number, number] {
  const m = FECHA.exec(fecha);
  if (!m) throw new Error(`fecha_invalida: ${fecha}`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const comprobacion = new Date(Date.UTC(a, mes - 1, d));
  if (comprobacion.getUTCMonth() !== mes - 1 || comprobacion.getUTCDate() !== d) throw new Error(`fecha_invalida: ${fecha}`);
  return [a, mes, d];
}

// Suma meses de calendario. Si el día no existe en el mes de llegada, queda en
// el último día de ese mes: 31 de enero + 1 mes = 28 (o 29) de febrero.
export function sumarMeses(fecha: string, meses: number): string {
  if (!Number.isInteger(meses) || meses < 0) throw new Error('meses_invalidos');
  const [a, m, d] = partes(fecha);
  const total = (m - 1) + meses;
  const anio = a + Math.floor(total / 12);
  const mes = total % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

// Vigente hasta ese día inclusive.
export function estadoVigencia(vigenteHasta: string, hoy: string, diasAviso = DIAS_AVISO): EstadoVigencia {
  const quedan = diasEntre(hoy, vigenteHasta);
  if (quedan < 0) return 'vencido';
  if (quedan <= diasAviso) return 'por_vencer';
  return 'vigente';
}
