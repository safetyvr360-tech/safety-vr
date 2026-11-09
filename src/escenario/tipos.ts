// Contrato del documento de escenario — safetyvr/escenario@1 (ADR-005).

export type Texto = Record<string, string>;

export type Entorno = {
  id: string;
  tipo: 'panorama360' | 'modelo3d';
  fuente: string;
  titulo?: Texto;
};

export type Canal = {
  clave: string;
  unidad: string;
  inicial: number;
  seguro: [number, number];
};

export type Instrumento = {
  id: string;
  tipo: string;
  etiqueta: Texto;
  canales: Canal[];
};

export type Item = { id: string; tipo: string; etiqueta: Texto };

export type Resultado = 'correcto' | 'parcial' | 'incorrecto';

export type Accion = {
  id: string;
  etiqueta: Texto;
  objeto?: string;
  resultado: Resultado;
  evalua: string;
  marca?: string[];
  retroalimentacion?: Texto;
  siguiente: string | null;
};

export type Desenlace = {
  resultado: Resultado;
  evalua?: string;
  retroalimentacion?: Texto;
  siguiente?: string | null;
};

export type Efecto = {
  instrumento: string;
  canal: string;
  valor: number;
  alarma?: boolean;
};

export type Nodo = {
  id: string;
  entorno: string;
  situacion: Texto;
  narracion?: Texto;
  peligros?: string[];
  requiere?: string[];
  al_faltar_requisito?: Desenlace;
  al_entrar?: Efecto[];
  tiempo_limite_s?: number;
  al_agotar_tiempo?: Desenlace;
  final?: boolean;
  acciones: Accion[];
};

export type Criterio = {
  id: string;
  etiqueta: Texto;
  peso: number;
  critico: boolean;
};

export type Validacion = {
  estado: 'borrador' | 'validado' | 'rechazado';
  validado_por: string | null;
  licencia: string | null;
  norma: string | null;
  fecha: string | null;
};

export type Escenario = {
  esquema: string;
  codigo: string;
  version: string;
  titulo: Texto;
  riesgo: string;
  sector?: string[];
  duracion_estimada_min: number;
  intentos_maximos: number;
  puntaje_aprobacion: number;
  vigencia_meses: number;
  normas: string[];
  entrega: string[];
  idiomas: string[];
  entornos: Entorno[];
  instrumentos: Instrumento[];
  inventario: Item[];
  nodos: Nodo[];
  rubrica: Criterio[];
  validacion: Validacion;
  consultas_al_validador?: string[];
};

export type Compuerta = 1 | 2 | 3;

export type Hallazgo = {
  compuerta: Compuerta;
  codigo: string;
  mensaje: string;
  ruta: string;
};

export type Informe = { ok: boolean; hallazgos: Hallazgo[] };
