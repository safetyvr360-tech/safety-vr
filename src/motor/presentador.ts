// Presentador de Safety VR — segunda capa del adaptador WebXR.
//
// Convierte el estado del motor en una VISTA: exactamente lo que el visor tiene
// que dibujar, ya resuelto en un idioma, con los números formateados y los
// textos de interfaz sacados del catálogo (mensajes/es-CO.json, mensajes/en.json).
// El dibujo WebXR solo pinta la vista; no decide, no traduce, no calcula.
//
// Directiva 4: ningún texto de interfaz vive en el código. Una clave que no está
// en el catálogo es un error, no un texto vacío.

import type { Escenario, Resultado, Texto } from '../escenario/tipos.ts';
import type { Estado, Paso, Veredicto } from './maquina.ts';

export type Idioma = 'es-CO' | 'en';
export const IDIOMAS: Idioma[] = ['es-CO', 'en'];

export type Catalogo = Record<string, string>;
export type Catalogos = Record<Idioma, Catalogo>;

export type Tono = Resultado | 'neutro';

export type Vista = {
  fase: Estado['fase'];
  idioma: Idioma;            // el idioma de la interfaz que pidió el trabajador
  idioma_contenido: string;  // el idioma en que efectivamente se muestra el escenario
  aviso_idioma: string | null;
  encabezado: { codigo: string; version: string; titulo: string };
  entorno: { id: string; tipo: string; fuente: string; titulo: string } | null;
  situacion: string | null;
  narracion: string | null;
  retroalimentacion: { texto: string; tono: Tono } | null;
  acciones: { id: string; texto: string; objeto: string | null }[];
  reloj: { segundos: number; fraccion: number; urgente: boolean; texto: string } | null;
  pausa: string | null;
  instrumentos: {
    id: string;
    etiqueta: string;
    canales: { clave: string; valor: string; unidad: string; rango: string; alarma: boolean; fuera_de_rango: boolean }[];
  }[];
  alarmas: string[];
  rubrica: { id: string; etiqueta: string; peso: number; critico: boolean; resultado: Resultado | null; estado: string }[];
  puntaje: string;
  cierre: { veredicto: Veredicto; titulo: string; detalle: string } | null;
};

export type Entrada = {
  doc: Escenario;
  estado: Estado;
  catalogos: Catalogos;
  idioma: Idioma;
  ultimoPaso?: Paso | null;
  restanteMs?: number | null;
  enPausa?: boolean;
};

const UMBRAL_URGENTE_S = 10;

export function traducir(catalogo: Catalogo, clave: string, vars: Record<string, string | number> = {}): string {
  const plantilla = catalogo[clave];
  if (plantilla === undefined) throw new Error(`clave_de_catalogo_inexistente: ${clave}`);
  return plantilla.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`variable_faltante: ${k} en ${clave}`);
    return String(vars[k]);
  });
}

// El escenario se muestra en el idioma pedido si lo declara; si no, en el
// primero que declare, y se avisa. Nunca se mezclan idiomas en una vista.
export function idiomaDeContenido(doc: Escenario, pedido: Idioma): string {
  return doc.idiomas.includes(pedido) ? pedido : doc.idiomas[0]!;
}

export function presentar(e: Entrada): Vista {
  const { doc, estado, catalogos, idioma } = e;
  const cat = catalogos[idioma];
  const t = (clave: string, vars?: Record<string, string | number>) => traducir(cat, clave, vars);
  const contenido = idiomaDeContenido(doc, idioma);
  const tx = (texto: Texto | undefined): string => (texto ? texto[contenido] ?? '' : '');
  const numero = new Intl.NumberFormat(idioma, { maximumFractionDigits: 2 });

  const items = new Map(doc.inventario.map((i) => [i.id, i]));
  const nodoDoc = estado.nodo ? doc.nodos.find((n) => n.id === estado.nodo!.id) : undefined;
  const ent = estado.nodo ? doc.entornos.find((x) => x.id === estado.nodo!.entorno) : undefined;
  const vivo = estado.fase === 'en_curso';

  const aviso = contenido === idioma
    ? null
    : t('motor.idioma.sustituido', { idioma: t(`motor.idioma.nombre.${contenido}`) });

  let retro: Vista['retroalimentacion'] = null;
  if (estado.retroalimentacion) {
    const tono: Tono = estado.retroalimentacion_resultado ?? 'neutro';
    retro = { texto: tx(estado.retroalimentacion), tono };
  }

  let reloj: Vista['reloj'] = null;
  const lim = estado.nodo?.tiempo_limite_s;
  if (vivo && lim !== undefined && e.restanteMs !== undefined && e.restanteMs !== null) {
    const segundos = Math.ceil(e.restanteMs / 1000);
    reloj = {
      segundos,
      fraccion: Math.min(1, Math.max(0, e.restanteMs / (lim * 1000))),
      urgente: segundos <= Math.min(UMBRAL_URGENTE_S, lim / 3),
      texto: t('motor.reloj.restante', { segundos: numero.format(segundos) }),
    };
  }

  const instrumentos: Vista['instrumentos'] = [];
  const alarmas: string[] = [];
  for (const ins of doc.instrumentos) {
    const lecturas = estado.instrumentos[ins.id] ?? [];
    const etiqueta = tx(ins.etiqueta);
    instrumentos.push({
      id: ins.id,
      etiqueta,
      canales: lecturas.map((l) => ({
        clave: l.clave,
        valor: numero.format(l.valor),
        unidad: l.unidad,
        rango: `${numero.format(l.seguro[0])}–${numero.format(l.seguro[1])}`,
        alarma: l.alarma,
        fuera_de_rango: l.fuera_de_rango,
      })),
    });
    for (const l of lecturas) {
      if (l.alarma) alarmas.push(t('motor.alarma', { instrumento: etiqueta, canal: l.clave }));
    }
  }

  const rubrica: Vista['rubrica'] = doc.rubrica.map((c) => {
    const r = estado.criterios[c.id] ?? null;
    return {
      id: c.id,
      etiqueta: tx(c.etiqueta),
      peso: c.peso,
      critico: c.critico,
      resultado: r,
      estado: r ? t(`motor.resultado.${r}`) : t('motor.rubrica.sin_evaluar'),
    };
  });

  let cierre: Vista['cierre'] = null;
  if (estado.veredicto) {
    const v = estado.veredicto;
    let detalle: string;
    if (v === 'apto') detalle = t('motor.cierre.apto');
    else if (v === 'incompleta') detalle = t('motor.cierre.incompleta');
    else if (estado.criticos_fallidos.length > 0) {
      const nombres = estado.criticos_fallidos.map((id) => tx(doc.rubrica.find((c) => c.id === id)!.etiqueta));
      detalle = t('motor.cierre.no_apto_criticos', { criterios: nombres.join('; ') });
    } else detalle = t('motor.cierre.no_apto_puntaje');
    cierre = { veredicto: v, titulo: t(`motor.veredicto.${v}`), detalle };
  }

  return {
    fase: estado.fase,
    idioma,
    idioma_contenido: contenido,
    aviso_idioma: aviso,
    encabezado: { codigo: doc.codigo, version: doc.version, titulo: tx(doc.titulo) },
    entorno: ent ? { id: ent.id, tipo: ent.tipo, fuente: ent.fuente, titulo: tx(ent.titulo) } : null,
    situacion: estado.nodo ? tx(nodoDoc!.situacion) : null,
    narracion: nodoDoc?.narracion ? tx(nodoDoc.narracion) : null,
    retroalimentacion: retro,
    acciones: vivo && !e.enPausa
      ? estado.nodo!.acciones.map((a) => {
        const it = a.objeto ? items.get(a.objeto) : undefined;
        return { id: a.id, texto: tx(a.etiqueta), objeto: it ? t('motor.objeto', { objeto: tx(it.etiqueta) }) : null };
      })
      : [],
    reloj,
    pausa: vivo && e.enPausa ? t('motor.reloj.en_pausa') : null,
    instrumentos,
    alarmas,
    rubrica,
    puntaje: t('motor.puntaje', { puntaje: numero.format(estado.puntaje), minimo: numero.format(doc.puntaje_aprobacion) }),
    cierre,
  };
}
