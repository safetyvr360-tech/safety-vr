// El estudio de viabilidad financiera de Ultramedia360 (formato SENA GFPI-F-144,
// ficha 2902032), la unidad productiva de la que SAFETY VR es la línea de
// simuladores. La página de inversión lo muestra como respaldo, separado del
// modelo propio de SAFETY VR (modelo.ts): estas cifras son de las cuatro líneas
// juntas, a cinco años. Solo cifras agregadas; ningún dato personal del estudio.

// Inversión inicial y de dónde sale (hoja «Estudio Viabilidad Financiera», 5.6).
export const INVERSION_INICIAL = 137_738_333;
export const FINANCIACION = { aporte_equipos: 0.61, fondo_emprender: 0.39 } as const;
export const fondoEmprender = () => INVERSION_INICIAL * FINANCIACION.fondo_emprender;

// Ingresos por línea, años 1 a 5 (5.5), en COP.
export const INGRESOS = {
  fotografia: [4_999_981, 5_417_980, 5_887_989, 6_404_955, 6_980_760],
  drones: [102_999_980, 111_610_779, 121_293_014, 131_942_540, 143_804_175],
  tours: [28_499_995, 30_882_594, 33_561_659, 36_508_373, 39_790_476],
  simuladores: [90_000_000, 97_524_000, 105_984_207, 115_289_620, 125_654_157],
} as const;
export const ingresosAnio = (anio: number) => Object.values(INGRESOS).reduce((s, l) => s + l[anio - 1]!, 0);

// La línea de simuladores (SAFETY VR): proyectos por año, a todo costo y precio.
export const SIMULADORES = { proyectos_anio: 3, costo: 20_000_000, precio: 30_000_000 } as const;

// Indicadores de viabilidad (5.8), con costo de capital del 12 % E.A.
export const COSTO_CAPITAL = 0.12;
export const VALOR_ACTUAL = 252_820_594;
export const VPN = 115_082_261;
export const TIR = 0.348;
export const BENEFICIO_COSTO = 1.19;
export const ANIO_RECUPERACION = 3;
export const UTILIDAD_NETA = { anio1: 27_319_967, anio5: 140_135_951 } as const;
