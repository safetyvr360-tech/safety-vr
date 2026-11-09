// Motor de Safety VR — intérprete puro del grafo safetyvr/escenario@1 (ADR-005).
// Sin WebXR, sin DOM, sin reloj y sin dependencias: corre con
// `node --experimental-strip-types`. El adaptador WebXR se monta encima y solo
// dibuja lo que este motor le dice; nunca decide nada por su cuenta.
//
// Reglas de interpretación (las mismas que asume el validador):
// - El nodo inicial es el primero de `nodos`.
// - `requiere` se revisa al ENTRAR al nodo. Si falta una marca se aplica
//   `al_faltar_requisito` una sola vez: se califica su criterio, se entrega su
//   retroalimentación y, si declara `siguiente`, se salta allá; si no, el
//   trabajador sigue en el mismo nodo con sus acciones. Nadie queda trabado.
// - `al_entrar` fija lecturas de instrumentos al entrar al nodo.
// - Entrar a un nodo `final` termina la sesión. Una acción con
//   `siguiente: null` también la termina.
// - Un criterio se califica con el PEOR resultado que haya recibido: un error
//   no se borra acertando después. correcto = peso completo, parcial = mitad,
//   incorrecto = cero.
// - Veredicto apto = terminó, puntaje >= puntaje_aprobacion y ningún criterio
//   crítico quedó sin calificar como correcto. Un crítico fallado es no apto
//   cualquiera sea el puntaje.
// - `abandonar()` lleva cualquier estado vivo a un estado final (directiva 6):
//   la sesión queda `incompleta`.

import type {
  Accion, Desenlace, Escenario, Nodo, Resultado, Texto,
} from '../escenario/tipos.ts';
import { validarEscenario } from '../escenario/validador.ts';

export type Fase = 'sin_iniciar' | 'en_curso' | 'terminada' | 'abandonada';

export type Veredicto = 'apto' | 'no_apto' | 'incompleta';

export type CodigoError =
  | 'escenario_invalido'
  | 'ya_iniciada'
  | 'no_iniciada'
  | 'ya_terminada'
  | 'accion_inexistente'
  | 'sin_limite_de_tiempo'
  | 'en_pausa';

// Error con código estable. El texto visible lo pone el catálogo de idioma del
// adaptador a partir del código, nunca este mensaje.
export class ErrorMotor extends Error {
  codigo: CodigoError;
  constructor(codigo: CodigoError, detalle = '') {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.name = 'ErrorMotor';
    this.codigo = codigo;
  }
}

export type Lectura = {
  clave: string;
  unidad: string;
  valor: number;
  seguro: [number, number];
  alarma: boolean;
  fuera_de_rango: boolean;
};

// Lo que el adaptador puede mostrar de una acción. Sin `resultado`, sin
// `evalua` y sin `siguiente`: mostrar eso sería soplarle la respuesta.
export type AccionVisible = { id: string; etiqueta: Texto; objeto?: string };

export type NodoVisible = {
  id: string;
  entorno: string;
  situacion: Texto;
  narracion?: Texto;
  tiempo_limite_s?: number;
  final: boolean;
  acciones: AccionVisible[];
};

export type TipoEvento =
  | 'inicio' | 'entrada_nodo' | 'requisito_faltante' | 'accion'
  | 'tiempo_agotado' | 'fin' | 'abandono';

// Cada evento es la materia prima de un statement xAPI (ADR-002).
export type Evento = {
  n: number;
  tipo: TipoEvento;
  nodo: string | null;
  accion?: string;
  criterio?: string;
  resultado?: Resultado;
  veredicto?: Veredicto;
  puntaje?: number; // en los eventos de cierre: el puntaje con que se cerró
};

export type Desempeno = {
  puntaje: number;
  criterios: Record<string, Resultado>;
  criticos_fallidos: string[];
  veredicto: Veredicto | null;
};

export type Estado = Desempeno & {
  fase: Fase;
  nodo: NodoVisible | null;
  marcas: string[];
  instrumentos: Record<string, Lectura[]>;
  retroalimentacion: Texto | null;
  // El resultado al que corresponde la retroalimentación que se muestra. No
  // siempre es el de la última acción: un acierto que entra a un nodo con un
  // requisito faltante muestra el error del requisito.
  retroalimentacion_resultado: Resultado | null;
  eventos: Evento[];
};

type Mensaje = { texto: Texto; resultado: Resultado };

export type Paso = {
  resultado: Resultado | null;
  retroalimentacion: Texto | null;
  estado: Estado;
};

export type Maquina = {
  iniciar(): Estado;
  estadoActual(): Estado;
  ejecutar(accionId: string): Paso;
  agotarTiempo(): Paso;
  abandonar(): Estado;
};

const GRAVEDAD: Record<Resultado, number> = { correcto: 0, parcial: 1, incorrecto: 2 };
const FRACCION: Record<Resultado, number> = { correcto: 1, parcial: 0.5, incorrecto: 0 };

// El peor de dos resultados. Un error no se borra acertando después.
export function combinar(previo: Resultado | undefined, nuevo: Resultado): Resultado {
  if (previo === undefined) return nuevo;
  return GRAVEDAD[nuevo] > GRAVEDAD[previo] ? nuevo : previo;
}

export function crearMaquina(documento: Escenario): Maquina {
  const informe = validarEscenario(documento);
  if (!informe.ok) {
    throw new ErrorMotor('escenario_invalido', informe.hallazgos.map((h) => h.codigo).join(', '));
  }
  // Copia propia: si alguien muta el documento después, la sesión no cambia.
  const doc: Escenario = structuredClone(documento);
  const porId = new Map(doc.nodos.map((n) => [n.id, n]));

  let fase: Fase = 'sin_iniciar';
  let actual: Nodo | null = null;
  let retro: Mensaje | null = null;
  const marcas = new Set<string>();
  const criterios = new Map<string, Resultado>();
  const eventos: Evento[] = [];
  const lecturas = new Map<string, Map<string, Lectura>>();

  for (const ins of doc.instrumentos) {
    const canales = new Map<string, Lectura>();
    for (const c of ins.canales) {
      canales.set(c.clave, {
        clave: c.clave,
        unidad: c.unidad,
        valor: c.inicial,
        seguro: [c.seguro[0], c.seguro[1]],
        alarma: false,
        fuera_de_rango: c.inicial < c.seguro[0] || c.inicial > c.seguro[1],
      });
    }
    lecturas.set(ins.id, canales);
  }

  const registrar = (e: Omit<Evento, 'n'>) => { eventos.push({ n: eventos.length + 1, ...e }); };

  const calificar = (criterio: string | undefined, resultado: Resultado) => {
    if (criterio === undefined) return;
    criterios.set(criterio, combinar(criterios.get(criterio), resultado));
  };

  const desempeno = (): Desempeno => {
    let suma = 0;
    const fallidos: string[] = [];
    // Mientras la sesión sigue viva, un crítico sin evaluar todavía no está
    // fallado. Al cerrar, un crítico que nunca se calificó sí cuenta como falla.
    const cerrada = fase === 'terminada' || fase === 'abandonada';
    for (const c of doc.rubrica) {
      const r = criterios.get(c.id);
      if (r !== undefined) suma += c.peso * FRACCION[r];
      if (c.critico && (r === undefined ? cerrada : r !== 'correcto')) fallidos.push(c.id);
    }
    const puntaje = Math.round(suma);
    let veredicto: Veredicto | null = null;
    if (fase === 'abandonada') veredicto = 'incompleta';
    if (fase === 'terminada') {
      veredicto = puntaje >= doc.puntaje_aprobacion && fallidos.length === 0 ? 'apto' : 'no_apto';
    }
    return { puntaje, criterios: Object.fromEntries(criterios), criticos_fallidos: fallidos, veredicto };
  };

  const visible = (n: Nodo): NodoVisible => {
    const v: NodoVisible = {
      id: n.id,
      entorno: n.entorno,
      situacion: { ...n.situacion },
      final: n.final === true,
      acciones: n.acciones.map((a) => {
        const av: AccionVisible = { id: a.id, etiqueta: { ...a.etiqueta } };
        if (a.objeto !== undefined) av.objeto = a.objeto;
        return av;
      }),
    };
    if (n.narracion) v.narracion = { ...n.narracion };
    if (n.tiempo_limite_s !== undefined) v.tiempo_limite_s = n.tiempo_limite_s;
    return v;
  };

  // Siempre devuelve copias: el adaptador no puede tocar el estado interno.
  const estado = (): Estado => {
    const instrumentos: Record<string, Lectura[]> = {};
    for (const [id, canales] of lecturas) {
      instrumentos[id] = [...canales.values()].map((l) => ({ ...l, seguro: [l.seguro[0], l.seguro[1]] }));
    }
    return {
      fase,
      nodo: actual ? visible(actual) : null,
      marcas: [...marcas].sort(),
      instrumentos,
      retroalimentacion: retro ? { ...retro.texto } : null,
      retroalimentacion_resultado: retro ? retro.resultado : null,
      eventos: eventos.map((e) => ({ ...e })),
      ...desempeno(),
    };
  };

  const terminar = () => {
    fase = 'terminada';
    const d = desempeno();
    registrar({ tipo: 'fin', nodo: actual ? actual.id : null, veredicto: d.veredicto!, puntaje: d.puntaje });
  };

  // Entrar a un nodo. Devuelve la retroalimentación del requisito faltante, si
  // la hubo. Un salto por al_faltar_requisito.siguiente vuelve a entrar, con un
  // tope para que un documento mal armado no cuelgue el visor.
  const entrar = (id: string, saltos = 0): Mensaje | null => {
    const n = porId.get(id)!;
    actual = n;
    registrar({ tipo: 'entrada_nodo', nodo: n.id });
    for (const ef of n.al_entrar ?? []) {
      const l = lecturas.get(ef.instrumento)!.get(ef.canal)!;
      l.valor = ef.valor;
      l.alarma = ef.alarma === true;
      l.fuera_de_rango = ef.valor < l.seguro[0] || ef.valor > l.seguro[1];
    }
    if (n.final) {
      terminar();
      return null;
    }
    const faltan = (n.requiere ?? []).filter((m) => !marcas.has(m));
    if (faltan.length > 0 && n.al_faltar_requisito) {
      const des: Desenlace = n.al_faltar_requisito;
      calificar(des.evalua, des.resultado);
      const ev: Omit<Evento, 'n'> = { tipo: 'requisito_faltante', nodo: n.id, resultado: des.resultado };
      if (des.evalua !== undefined) ev.criterio = des.evalua;
      registrar(ev);
      const msj: Mensaje | null = des.retroalimentacion ? { texto: des.retroalimentacion, resultado: des.resultado } : null;
      if (typeof des.siguiente === 'string' && saltos < doc.nodos.length) {
        return entrar(des.siguiente, saltos + 1) ?? msj;
      }
      return msj;
    }
    return null;
  };

  // Aplica un desenlace (acción o tiempo agotado) y mueve al siguiente nodo.
  const avanzar = (resultado: Resultado, texto: Texto | null, siguiente: string | null | undefined): Paso => {
    retro = texto ? { texto, resultado } : null;
    if (siguiente === null) {
      terminar();
    } else if (siguiente !== undefined) {
      const delRequisito = entrar(siguiente);
      if (delRequisito) retro = delRequisito;
    }
    return { resultado, retroalimentacion: retro ? { ...retro.texto } : null, estado: estado() };
  };

  const exigirEnCurso = () => {
    if (fase === 'sin_iniciar') throw new ErrorMotor('no_iniciada');
    if (fase !== 'en_curso') throw new ErrorMotor('ya_terminada');
  };

  return {
    iniciar() {
      if (fase !== 'sin_iniciar') throw new ErrorMotor('ya_iniciada');
      fase = 'en_curso';
      registrar({ tipo: 'inicio', nodo: null });
      retro = entrar(doc.nodos[0]!.id);
      return estado();
    },

    estadoActual() {
      return estado();
    },

    ejecutar(accionId: string) {
      exigirEnCurso();
      const a: Accion | undefined = actual!.acciones.find((x) => x.id === accionId);
      if (!a) throw new ErrorMotor('accion_inexistente', `${accionId} en ${actual!.id}`);
      calificar(a.evalua, a.resultado);
      for (const m of a.marca ?? []) marcas.add(m);
      registrar({ tipo: 'accion', nodo: actual!.id, accion: a.id, criterio: a.evalua, resultado: a.resultado });
      return avanzar(a.resultado, a.retroalimentacion ?? null, a.siguiente);
    },

    agotarTiempo() {
      exigirEnCurso();
      const n = actual!;
      if (n.tiempo_limite_s === undefined) throw new ErrorMotor('sin_limite_de_tiempo', n.id);
      const des = n.al_agotar_tiempo;
      if (!des) {
        // El límite es orientativo en este nodo: se registra y se sigue.
        registrar({ tipo: 'tiempo_agotado', nodo: n.id });
        return { resultado: null, retroalimentacion: null, estado: estado() };
      }
      calificar(des.evalua, des.resultado);
      const ev: Omit<Evento, 'n'> = { tipo: 'tiempo_agotado', nodo: n.id, resultado: des.resultado };
      if (des.evalua !== undefined) ev.criterio = des.evalua;
      registrar(ev);
      return avanzar(des.resultado, des.retroalimentacion ?? null, des.siguiente);
    },

    abandonar() {
      if (fase === 'terminada' || fase === 'abandonada') throw new ErrorMotor('ya_terminada');
      fase = 'abandonada';
      registrar({ tipo: 'abandono', nodo: actual ? actual.id : null, veredicto: 'incompleta', puntaje: desempeno().puntaje });
      return estado();
    },
  };
}
