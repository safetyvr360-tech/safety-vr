// Compuertas automáticas 1, 2 y 3 del documento de escenario (ADR-005).
// Sin dependencias: corre con `node --experimental-strip-types`.

import type {
  Accion, Compuerta, Criterio, Escenario, Hallazgo, Informe, Nodo, Texto,
} from './tipos.ts';

const CLAVES_OBLIGATORIAS = [
  'esquema', 'codigo', 'version', 'titulo', 'riesgo', 'duracion_estimada_min',
  'intentos_maximos', 'puntaje_aprobacion', 'vigencia_meses', 'normas',
  'entrega', 'idiomas', 'entornos', 'instrumentos', 'inventario', 'nodos',
  'rubrica', 'validacion',
] as const;

const ESQUEMA_SOPORTADO = 'safetyvr/escenario@1';
const CRITICOS_MINIMOS = 2;
const PASOS_MAXIMOS = 200;

function nuevo(compuerta: Compuerta, codigo: string, mensaje: string, ruta: string): Hallazgo {
  return { compuerta, codigo, mensaje, ruta };
}

function duplicados(ids: string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) repetidos.add(id);
    vistos.add(id);
  }
  return [...repetidos];
}

function textoCompleto(t: Texto | undefined, idiomas: string[]): string[] {
  if (!t) return [];
  return idiomas.filter((i) => typeof t[i] !== 'string' || t[i].trim() === '');
}

// ---------------------------------------------------------------- compuerta 1
export function compuertaEsquema(doc: Escenario): Hallazgo[] {
  const h: Hallazgo[] = [];
  const add = (c: string, m: string, r: string) => h.push(nuevo(1, c, m, r));

  for (const clave of CLAVES_OBLIGATORIAS) {
    if ((doc as Record<string, unknown>)[clave] === undefined) {
      add('falta_clave', `Falta la clave obligatoria "${clave}".`, clave);
    }
  }
  if (h.length > 0) return h;

  if (doc.esquema !== ESQUEMA_SOPORTADO) {
    add('esquema_desconocido', `El esquema "${doc.esquema}" no es ${ESQUEMA_SOPORTADO}.`, 'esquema');
  }

  const entornos = new Set(doc.entornos.map((e) => e.id));
  const items = new Set(doc.inventario.map((i) => i.id));
  const criterios = new Set(doc.rubrica.map((c) => c.id));
  const nodos = new Set(doc.nodos.map((n) => n.id));
  const instrumentos = new Map(doc.instrumentos.map((i) => [i.id, new Set(i.canales.map((c) => c.clave))]));

  for (const [nombre, lista] of [
    ['entornos', doc.entornos.map((e) => e.id)],
    ['inventario', doc.inventario.map((i) => i.id)],
    ['rubrica', doc.rubrica.map((c) => c.id)],
    ['nodos', doc.nodos.map((n) => n.id)],
    ['instrumentos', doc.instrumentos.map((i) => i.id)],
  ] as [string, string[]][]) {
    for (const id of duplicados(lista)) {
      add('id_duplicado', `El identificador "${id}" aparece más de una vez.`, nombre);
    }
  }

  const suma = doc.rubrica.reduce((s, c) => s + c.peso, 0);
  if (suma !== 100) {
    add('pesos_no_suman_100', `Los pesos de la rúbrica suman ${suma} y deben sumar 100.`, 'rubrica');
  }

  if (doc.rubrica.filter((c) => c.critico).length < CRITICOS_MINIMOS) {
    add('criticos_insuficientes', `La rúbrica declara menos de ${CRITICOS_MINIMOS} criterios críticos.`, 'rubrica');
  }

  if (doc.validacion.estado !== 'borrador'
    || doc.validacion.validado_por !== null
    || doc.validacion.licencia !== null
    || doc.validacion.norma !== null
    || doc.validacion.fecha !== null) {
    add('validacion_prellenada', 'El bloque validacion debe llegar en borrador y con sus campos en null.', 'validacion');
  }

  // Directiva 4: todo texto que el trabajador o el RISST van a leer existe en
  // cada idioma declarado, no solo la situación y la etiqueta de la acción.
  const revisarTexto = (t: Texto | undefined, ruta: string) => {
    for (const falta of textoCompleto(t, doc.idiomas)) {
      add('idioma_faltante', `El texto no está traducido al idioma "${falta}".`, ruta);
    }
  };
  revisarTexto(doc.titulo, 'titulo');
  for (const e of doc.entornos) revisarTexto(e.titulo, `entornos.${e.id}.titulo`);
  for (const i of doc.instrumentos) revisarTexto(i.etiqueta, `instrumentos.${i.id}.etiqueta`);
  for (const i of doc.inventario) revisarTexto(i.etiqueta, `inventario.${i.id}.etiqueta`);
  for (const c of doc.rubrica) revisarTexto(c.etiqueta, `rubrica.${c.id}.etiqueta`);
  for (const n of doc.nodos) {
    revisarTexto(n.narracion, `nodos.${n.id}.narracion`);
    revisarTexto(n.al_faltar_requisito?.retroalimentacion, `nodos.${n.id}.al_faltar_requisito.retroalimentacion`);
    revisarTexto(n.al_agotar_tiempo?.retroalimentacion, `nodos.${n.id}.al_agotar_tiempo.retroalimentacion`);
    for (const a of n.acciones) revisarTexto(a.retroalimentacion, `nodos.${n.id}.acciones.${a.id}.retroalimentacion`);
  }

  const marcasProducidas = new Set<string>();
  for (const n of doc.nodos) for (const a of n.acciones) for (const m of a.marca ?? []) marcasProducidas.add(m);

  for (const n of doc.nodos) {
    const r = `nodos.${n.id}`;
    if (!entornos.has(n.entorno)) {
      add('entorno_inexistente', `El nodo apunta al entorno "${n.entorno}", que no está declarado.`, `${r}.entorno`);
    }
    for (const falta of textoCompleto(n.situacion, doc.idiomas)) {
      add('idioma_faltante', `La situación no está traducida al idioma "${falta}".`, `${r}.situacion`);
    }
    for (const req of n.requiere ?? []) {
      if (!marcasProducidas.has(req)) {
        add('marca_nunca_producida', `El nodo exige la marca "${req}", que ninguna acción produce.`, `${r}.requiere`);
      }
    }
    if ((n.requiere ?? []).length > 0 && !n.al_faltar_requisito) {
      add('falta_al_faltar_requisito', 'Un nodo con requisitos debe declarar al_faltar_requisito.', r);
    }
    for (const ef of n.al_entrar ?? []) {
      const canales = instrumentos.get(ef.instrumento);
      if (!canales) {
        add('instrumento_inexistente', `Efecto sobre el instrumento "${ef.instrumento}", que no está declarado.`, `${r}.al_entrar`);
      } else if (!canales.has(ef.canal)) {
        add('canal_inexistente', `El instrumento "${ef.instrumento}" no tiene el canal "${ef.canal}".`, `${r}.al_entrar`);
      }
    }
    if (!n.final && n.acciones.length === 0) {
      add('nodo_sin_acciones', 'Un nodo que no es final debe ofrecer al menos una acción.', r);
    }
    for (const a of n.acciones) {
      const ra = `${r}.acciones.${a.id}`;
      if (!criterios.has(a.evalua)) {
        add('criterio_inexistente', `La acción evalúa "${a.evalua}", que no está en la rúbrica.`, `${ra}.evalua`);
      }
      if (a.objeto !== undefined && !items.has(a.objeto)) {
        add('objeto_inexistente', `La acción usa el objeto "${a.objeto}", que no está en el inventario.`, `${ra}.objeto`);
      }
      if (a.siguiente !== null && !nodos.has(a.siguiente)) {
        add('nodo_siguiente_inexistente', `La acción apunta al nodo "${a.siguiente}", que no existe.`, `${ra}.siguiente`);
      }
      if (a.resultado !== 'correcto' && !a.retroalimentacion) {
        add('falta_retroalimentacion', 'Toda acción no correcta debe explicar la consecuencia real del error.', ra);
      }
      for (const falta of textoCompleto(a.etiqueta, doc.idiomas)) {
        add('idioma_faltante', `La etiqueta no está traducida al idioma "${falta}".`, `${ra}.etiqueta`);
      }
    }
    // Los desenlaces (requisito faltante y tiempo agotado) se revisan con las
    // mismas reglas que una acción: criterio real, destino real y explicación.
    for (const [clave, des] of [
      ['al_faltar_requisito', n.al_faltar_requisito],
      ['al_agotar_tiempo', n.al_agotar_tiempo],
    ] as const) {
      if (!des) continue;
      const rd = `${r}.${clave}`;
      if (des.evalua !== undefined && !criterios.has(des.evalua)) {
        add('criterio_inexistente', `${clave} evalúa "${des.evalua}", que no está en la rúbrica.`, `${rd}.evalua`);
      }
      if (des.siguiente !== undefined && des.siguiente !== null && !nodos.has(des.siguiente)) {
        add('nodo_siguiente_inexistente', `${clave} apunta al nodo "${des.siguiente}", que no existe.`, `${rd}.siguiente`);
      }
      if (des.resultado !== 'correcto' && !des.retroalimentacion) {
        add('falta_retroalimentacion', `${clave} no correcto debe explicar la consecuencia real del error.`, rd);
      }
    }
  }
  return h;
}

// ---------------------------------------------------------------- compuerta 2
function salidas(n: Nodo): string[] {
  const d: string[] = [];
  for (const a of n.acciones) if (a.siguiente) d.push(a.siguiente);
  const t = n.al_agotar_tiempo?.siguiente;
  if (t) d.push(t);
  return d;
}

export function compuertaAlcanzabilidad(doc: Escenario): Hallazgo[] {
  const h: Hallazgo[] = [];
  const add = (c: string, m: string, r: string) => h.push(nuevo(2, c, m, r));

  if (doc.nodos.length === 0) {
    add('sin_nodos', 'El escenario no tiene nodos.', 'nodos');
    return h;
  }

  const porId = new Map(doc.nodos.map((n) => [n.id, n]));
  const inicio = doc.nodos[0]!;

  // Todo nodo es alcanzable desde el inicio.
  const alcanzados = new Set<string>([inicio.id]);
  const cola = [inicio.id];
  while (cola.length > 0) {
    const actual = porId.get(cola.shift()!);
    if (!actual) continue;
    for (const d of salidas(actual)) {
      if (!alcanzados.has(d) && porId.has(d)) {
        alcanzados.add(d);
        cola.push(d);
      }
    }
  }
  for (const n of doc.nodos) {
    if (!alcanzados.has(n.id)) {
      add('nodo_inalcanzable', `No existe ninguna ruta desde el nodo inicial hasta "${n.id}".`, `nodos.${n.id}`);
    }
  }

  // Desde todo nodo se alcanza un nodo final.
  const llegaAFinal = new Set<string>();
  for (const n of doc.nodos) if (n.final) llegaAFinal.add(n.id);
  if (llegaAFinal.size === 0) {
    add('sin_nodo_final', 'Ningún nodo está marcado como final: el escenario no termina.', 'nodos');
  }
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const n of doc.nodos) {
      if (llegaAFinal.has(n.id)) continue;
      if (salidas(n).some((d) => llegaAFinal.has(d))) {
        llegaAFinal.add(n.id);
        cambio = true;
      }
    }
  }
  for (const n of doc.nodos) {
    if (!llegaAFinal.has(n.id)) {
      add('final_inalcanzable', `Desde el nodo "${n.id}" no se puede llegar a ningún nodo final: el trabajador queda trabado.`, `nodos.${n.id}`);
    }
  }

  // Todo criterio de la rúbrica es evaluado por alguna acción.
  const evaluados = new Set<string>();
  for (const n of doc.nodos) {
    for (const a of n.acciones) evaluados.add(a.evalua);
    if (n.al_agotar_tiempo?.evalua) evaluados.add(n.al_agotar_tiempo.evalua);
    if (n.al_faltar_requisito?.evalua) evaluados.add(n.al_faltar_requisito.evalua);
  }
  for (const c of doc.rubrica) {
    if (!evaluados.has(c.id)) {
      add('criterio_no_evaluado', `El criterio "${c.id}" no lo evalúa ningún nodo.`, `rubrica.${c.id}`);
    }
  }

  // Existe una ruta en la que todo lo correcto aprueba.
  const satisfechos = new Set<string>();
  const marcas = new Set<string>();
  let actual: Nodo | undefined = inicio;
  let pasos = 0;
  const recorridos = new Set<string>();
  while (actual && pasos < PASOS_MAXIMOS) {
    pasos += 1;
    if (recorridos.has(actual.id)) {
      add('ruta_correcta_en_ciclo', `La ruta correcta vuelve al nodo "${actual.id}": hay un ciclo sin salida.`, `nodos.${actual.id}`);
      break;
    }
    recorridos.add(actual.id);
    for (const req of actual.requiere ?? []) {
      if (!marcas.has(req)) {
        add('ruta_correcta_incumple_requisito', `En la ruta correcta, el nodo "${actual.id}" exige "${req}" y nada lo produjo antes.`, `nodos.${actual.id}.requiere`);
      }
    }
    if (actual.final) break;
    const buena: Accion | undefined = actual.acciones.find((a) => a.resultado === 'correcto');
    if (!buena) {
      add('nodo_sin_accion_correcta', `El nodo "${actual.id}" no ofrece ninguna acción correcta.`, `nodos.${actual.id}`);
      break;
    }
    satisfechos.add(buena.evalua);
    for (const m of buena.marca ?? []) marcas.add(m);
    actual = buena.siguiente ? porId.get(buena.siguiente) : undefined;
  }

  const puntaje = doc.rubrica
    .filter((c: Criterio) => satisfechos.has(c.id))
    .reduce((s, c) => s + c.peso, 0);
  if (puntaje < doc.puntaje_aprobacion) {
    add('ruta_correcta_no_aprueba', `Haciendo todo bien se obtienen ${puntaje} puntos y se exigen ${doc.puntaje_aprobacion}.`, 'rubrica');
  }
  for (const c of doc.rubrica) {
    if (c.critico && !satisfechos.has(c.id)) {
      add('critico_fuera_de_ruta', `El criterio crítico "${c.id}" no se alcanza ni haciendo todo bien.`, `rubrica.${c.id}`);
    }
  }
  return h;
}

// ---------------------------------------------------------------- compuerta 3
export function compuertaCobertura(doc: Escenario, peligrosExigidos: string[]): Hallazgo[] {
  const cubiertos = new Set<string>();
  for (const n of doc.nodos) for (const p of n.peligros ?? []) cubiertos.add(p);
  return peligrosExigidos
    .filter((p) => !cubiertos.has(p))
    .map((p) => nuevo(3, 'peligro_no_cubierto', `Ningún nodo pone en juego el peligro "${p}" de la matriz de riesgos.`, 'nodos'));
}

// ------------------------------------------------------------------ fachada
export function validarEscenario(doc: Escenario, peligrosExigidos: string[] = []): Informe {
  const uno = compuertaEsquema(doc);
  // Sin integridad referencial las compuertas 2 y 3 producen ruido, no hallazgos.
  const resto = uno.length > 0 ? [] : [...compuertaAlcanzabilidad(doc), ...compuertaCobertura(doc, peligrosExigidos)];
  const hallazgos = [...uno, ...resto];
  return { ok: hallazgos.length === 0, hallazgos };
}
