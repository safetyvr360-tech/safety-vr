import type { Escenario } from '../tipos.ts';

// EC-01 — escenario de referencia. Devuelve una copia nueva en cada llamada
// para que las pruebas de ruptura puedan mutarla sin contaminarse entre sí.
export function ec01(): Escenario {
  return structuredClone(BASE) as Escenario;
}

export const PELIGROS_EC01 = ['P-EC-01', 'P-EC-02', 'P-EC-03', 'P-EC-04'];

const BASE: Escenario = {
  esquema: 'safetyvr/escenario@1',
  codigo: 'EC-01',
  version: '3.2.0',
  titulo: { 'es-CO': 'Ingreso a espacio confinado: permiso y medición' },
  riesgo: 'espacios_confinados',
  sector: ['quimico', 'metalurgico', 'portuario'],
  duracion_estimada_min: 12,
  intentos_maximos: 3,
  puntaje_aprobacion: 80,
  vigencia_meses: 12,
  normas: ['Resolución 0312 de 2019', 'Resolución 0491 de 2020'],
  entrega: ['webxr'],
  idiomas: ['es-CO'],

  entornos: [
    { id: 'e01_exterior', tipo: 'panorama360', fuente: 'blob/pan-tanque-exterior-4k', titulo: { 'es-CO': 'Plataforma exterior del tanque TK-204' } },
    { id: 'e02_boca', tipo: 'panorama360', fuente: 'blob/pan-boca-tanque-4k', titulo: { 'es-CO': 'Boca de inspección, nivel +3,2 m' } },
    { id: 'e03_interior', tipo: 'panorama360', fuente: 'blob/pan-tanque-interior-4k', titulo: { 'es-CO': 'Interior del tanque TK-204' } },
  ],

  instrumentos: [
    {
      id: 'detector4',
      tipo: 'lectura_multiple',
      etiqueta: { 'es-CO': 'Detector de cuatro gases' },
      canales: [
        { clave: 'O2', unidad: '%', inicial: 20.9, seguro: [19.5, 23.5] },
        { clave: 'H2S', unidad: 'ppm', inicial: 0, seguro: [0, 10] },
        { clave: 'LEL', unidad: '%', inicial: 0, seguro: [0, 10] },
        { clave: 'CO', unidad: 'ppm', inicial: 2, seguro: [0, 25] },
      ],
    },
  ],

  inventario: [
    { id: 'permiso', tipo: 'documento', etiqueta: { 'es-CO': 'Permiso de trabajo en espacio confinado' } },
    { id: 'arnes', tipo: 'epp', etiqueta: { 'es-CO': 'Arnés de cuerpo entero con línea de vida' } },
    { id: 'tripode', tipo: 'equipo', etiqueta: { 'es-CO': 'Trípode de rescate con winche' } },
    { id: 'companero', tipo: 'persona', etiqueta: { 'es-CO': 'Compañero de cuadrilla' } },
    { id: 'boca_tanque', tipo: 'control', etiqueta: { 'es-CO': 'Boca de inspección' } },
  ],

  nodos: [
    {
      id: 'n01_permiso',
      entorno: 'e01_exterior',
      peligros: ['P-EC-01'],
      situacion: { 'es-CO': 'Lo asignaron a inspeccionar el interior del tanque TK-204. El supervisor acaba de irse. Sobre la mesa hay un permiso de trabajo.' },
      tiempo_limite_s: 90,
      acciones: [
        {
          id: 'a_revisar_permiso',
          etiqueta: { 'es-CO': 'Revisar el permiso antes de hacer nada' },
          objeto: 'permiso',
          resultado: 'correcto',
          evalua: 'c_permiso',
          marca: ['permiso_verificado'],
          retroalimentacion: { 'es-CO': 'Correcto. El permiso estaba vencido desde ayer: lo detectó a tiempo.' },
          siguiente: 'n02_atmosfera',
        },
        {
          id: 'a_subir_directo',
          etiqueta: { 'es-CO': 'Subir a la plataforma y empezar' },
          resultado: 'incorrecto',
          evalua: 'c_permiso',
          retroalimentacion: { 'es-CO': 'Entró sin verificar el permiso, y este estaba vencido. Ningún ingreso a espacio confinado empieza sin permiso vigente.' },
          siguiente: 'n02_atmosfera',
        },
      ],
    },
    {
      id: 'n02_atmosfera',
      entorno: 'e01_exterior',
      peligros: ['P-EC-02'],
      situacion: { 'es-CO': 'Tiene el detector de cuatro gases colgado al cinturón y la boca del tanque cerrada frente a usted.' },
      tiempo_limite_s: 90,
      acciones: [
        {
          id: 'a_medir',
          etiqueta: { 'es-CO': 'Medir la atmósfera por la toma de muestreo antes de abrir' },
          objeto: 'permiso',
          resultado: 'correcto',
          evalua: 'c_medicion',
          marca: ['atmosfera_medida'],
          retroalimentacion: { 'es-CO': 'Correcto. La medición se hace desde afuera, por la toma, antes de romper el confinamiento.' },
          siguiente: 'n03_apertura',
        },
        {
          id: 'a_medir_despues',
          etiqueta: { 'es-CO': 'Abrir primero para poder medir adentro' },
          objeto: 'boca_tanque',
          resultado: 'incorrecto',
          evalua: 'c_medicion',
          retroalimentacion: { 'es-CO': 'Midió después de abrir. Lo que estaba acumulado adentro ya salió, y usted ya estaba expuesto cuando el detector marcó.' },
          siguiente: 'n03_apertura',
        },
      ],
    },
    {
      id: 'n03_apertura',
      entorno: 'e02_boca',
      peligros: ['P-EC-03'],
      situacion: { 'es-CO': 'Está frente a la boca de inspección. Su compañero espera instrucciones.' },
      requiere: ['permiso_verificado', 'atmosfera_medida'],
      al_faltar_requisito: {
        resultado: 'incorrecto',
        evalua: 'c_medicion',
        retroalimentacion: { 'es-CO': 'Intentó abrir sin haber medido la atmósfera. Lo que sale de un tanque cerrado puede desplazarlo en segundos.' },
      },
      acciones: [
        {
          id: 'a_designar_vigia',
          etiqueta: { 'es-CO': 'Designar al compañero como vigía y ubicarlo en la boca' },
          objeto: 'companero',
          resultado: 'correcto',
          evalua: 'c_vigia',
          marca: ['vigia_designado'],
          retroalimentacion: { 'es-CO': 'Correcto. El vigía queda en posición antes de que la boca se abra.' },
          siguiente: 'n04_ingreso',
        },
        {
          id: 'a_abrir_primero',
          etiqueta: { 'es-CO': 'Abrir la boca y después organizar al compañero' },
          objeto: 'boca_tanque',
          resultado: 'incorrecto',
          evalua: 'c_vigia',
          retroalimentacion: { 'es-CO': 'Abrió sin vigía en posición. Si algo pasa en los primeros segundos, no hay nadie afuera que pueda sacarlo.' },
          siguiente: 'n04_ingreso',
        },
      ],
    },
    {
      id: 'n04_ingreso',
      entorno: 'e02_boca',
      situacion: { 'es-CO': 'La boca está abierta. El trípode de rescate está armado sobre ella.' },
      requiere: ['vigia_designado'],
      al_faltar_requisito: {
        resultado: 'incorrecto',
        evalua: 'c_vigia',
        retroalimentacion: { 'es-CO': 'Va a entrar sin vigía. Nadie afuera sabe que usted está adentro.' },
      },
      tiempo_limite_s: 60,
      acciones: [
        {
          id: 'a_arnes',
          etiqueta: { 'es-CO': 'Ponerse el arnés y conectar la línea de vida al trípode' },
          objeto: 'arnes',
          resultado: 'correcto',
          evalua: 'c_epp',
          marca: ['epp_puesto'],
          retroalimentacion: { 'es-CO': 'Correcto. La línea de vida conectada es lo que permite un rescate sin que entre nadie más.' },
          siguiente: 'n05_alarma',
        },
        {
          id: 'a_bajar_sin_arnes',
          etiqueta: { 'es-CO': 'Bajar sin arnés, es una revisión corta' },
          resultado: 'incorrecto',
          evalua: 'c_epp',
          retroalimentacion: { 'es-CO': 'Bajó sin línea de vida. Para sacarlo habría que mandar a otra persona adentro, y así es como un accidente se vuelve dos.' },
          siguiente: 'n05_alarma',
        },
      ],
    },
    {
      id: 'n05_alarma',
      entorno: 'e03_interior',
      peligros: ['P-EC-04'],
      situacion: { 'es-CO': 'Lleva cuatro minutos adentro. El detector empieza a sonar.' },
      al_entrar: [{ instrumento: 'detector4', canal: 'H2S', valor: 18, alarma: true }],
      tiempo_limite_s: 25,
      al_agotar_tiempo: {
        resultado: 'incorrecto',
        evalua: 'c_alarma',
        retroalimentacion: { 'es-CO': 'No reaccionó. A 18 ppm de sulfuro de hidrógeno la decisión se toma en segundos, no en medio minuto.' },
        siguiente: 'n06_cierre',
      },
      acciones: [
        {
          id: 'a_evacuar',
          etiqueta: { 'es-CO': 'Salir de inmediato y avisar al vigía' },
          resultado: 'correcto',
          evalua: 'c_alarma',
          retroalimentacion: { 'es-CO': 'Correcto. La alarma no se discute: se sale, se ventila y se vuelve a medir.' },
          siguiente: 'n06_cierre',
        },
        {
          id: 'a_verificar_lectura',
          etiqueta: { 'es-CO': 'Revisar si el detector está fallando' },
          resultado: 'incorrecto',
          evalua: 'c_alarma',
          retroalimentacion: { 'es-CO': 'Se quedó adentro para dudar del equipo. El detector se verifica afuera, nunca dentro del espacio confinado.' },
          siguiente: 'n06_cierre',
        },
      ],
    },
    {
      id: 'n06_cierre',
      entorno: 'e01_exterior',
      situacion: { 'es-CO': 'Está de nuevo en la plataforma exterior. La sesión terminó.' },
      final: true,
      acciones: [],
    },
  ],

  rubrica: [
    { id: 'c_permiso', etiqueta: { 'es-CO': 'Verificación del permiso de ingreso' }, peso: 20, critico: true },
    { id: 'c_medicion', etiqueta: { 'es-CO': 'Medición de atmósfera antes de entrar' }, peso: 25, critico: true },
    { id: 'c_vigia', etiqueta: { 'es-CO': 'Designación de vigía en posición' }, peso: 20, critico: true },
    { id: 'c_epp', etiqueta: { 'es-CO': 'Uso de arnés y línea de vida' }, peso: 15, critico: false },
    { id: 'c_alarma', etiqueta: { 'es-CO': 'Reacción ante alarma de gas' }, peso: 20, critico: true },
  ],

  validacion: { estado: 'borrador', validado_por: null, licencia: null, norma: null, fecha: null },
};
