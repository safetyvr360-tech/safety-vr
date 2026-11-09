// Matemática 3D mínima para el visor de Safety VR, sin dependencias.
// Matrices 4×4 en orden de columnas (el que esperan WebGL y WebXR).
// Unidades: metros y radianes. Ejes de WebXR: +X derecha, +Y arriba, −Z al frente.

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];
export type Rayo = { origen: Vec3; direccion: Vec3 };

export function identidad(): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

export function multiplicar(a: Mat4, b: Mat4): Mat4 {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let f = 0; f < 4; f += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + f]! * b[c * 4 + k]!;
      r[c * 4 + f] = s;
    }
  }
  return r;
}

export function perspectiva(fovY: number, aspecto: number, cerca: number, lejos: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspecto;
  m[5] = f;
  m[10] = (lejos + cerca) / (cerca - lejos);
  m[11] = -1;
  m[14] = (2 * lejos * cerca) / (cerca - lejos);
  return m;
}

export function traslacion(x: number, y: number, z: number): Mat4 {
  const m = identidad();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

export function rotacionY(a: number): Mat4 {
  const m = identidad();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
}

export function rotacionX(a: number): Mat4 {
  const m = identidad();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}

export function invertir(m: Mat4): Mat4 {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m as unknown as number[];
  const b00 = a00! * a11! - a01! * a10!;
  const b01 = a00! * a12! - a02! * a10!;
  const b02 = a00! * a13! - a03! * a10!;
  const b03 = a01! * a12! - a02! * a11!;
  const b04 = a01! * a13! - a03! * a11!;
  const b05 = a02! * a13! - a03! * a12!;
  const b06 = a20! * a31! - a21! * a30!;
  const b07 = a20! * a32! - a22! * a30!;
  const b08 = a20! * a33! - a23! * a30!;
  const b09 = a21! * a32! - a22! * a31!;
  const b10 = a21! * a33! - a23! * a31!;
  const b11 = a22! * a33! - a23! * a32!;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-12) throw new Error('matriz_singular');
  const d = 1 / det;
  return new Float32Array([
    (a11! * b11 - a12! * b10 + a13! * b09) * d,
    (a02! * b10 - a01! * b11 - a03! * b09) * d,
    (a31! * b05 - a32! * b04 + a33! * b03) * d,
    (a22! * b04 - a21! * b05 - a23! * b03) * d,
    (a12! * b08 - a10! * b11 - a13! * b07) * d,
    (a00! * b11 - a02! * b08 + a03! * b07) * d,
    (a32! * b02 - a30! * b05 - a33! * b01) * d,
    (a20! * b05 - a22! * b02 + a23! * b01) * d,
    (a10! * b10 - a11! * b08 + a13! * b06) * d,
    (a01! * b08 - a00! * b10 - a03! * b06) * d,
    (a30! * b04 - a31! * b02 + a33! * b00) * d,
    (a21! * b02 - a20! * b04 - a23! * b00) * d,
    (a11! * b07 - a10! * b09 - a12! * b06) * d,
    (a00! * b09 - a01! * b07 + a02! * b06) * d,
    (a31! * b01 - a30! * b03 - a32! * b00) * d,
    (a20! * b03 - a21! * b01 + a22! * b00) * d,
  ]);
}

export function transformarPunto(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
  return [
    (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w,
    (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w,
    (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!) / w,
  ];
}

export function transformarDireccion(m: Mat4, d: Vec3): Vec3 {
  const [x, y, z] = d;
  return [
    m[0]! * x + m[4]! * y + m[8]! * z,
    m[1]! * x + m[5]! * y + m[9]! * z,
    m[2]! * x + m[6]! * y + m[10]! * z,
  ];
}

export function normalizar(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l === 0 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

// Vista de la cámara en modo pantalla: mirar con giro horizontal (yaw) y
// vertical (pitch), sin desplazarse. Devuelve la matriz de vista (mundo → ojo).
export function vistaDesdeAngulos(yaw: number, pitch: number): Mat4 {
  return invertir(multiplicar(rotacionY(yaw), rotacionX(pitch)));
}

// Rayo que sale del ojo por un punto de la pantalla, en coordenadas de
// dispositivo normalizadas (−1 a 1, Y hacia arriba).
export function rayoDesdePantalla(proyeccion: Mat4, vista: Mat4, ndcX: number, ndcY: number): Rayo {
  const inv = invertir(multiplicar(proyeccion, vista));
  const cerca = transformarPunto(inv, [ndcX, ndcY, -1]);
  const lejos = transformarPunto(inv, [ndcX, ndcY, 1]);
  return { origen: cerca, direccion: normalizar([lejos[0] - cerca[0], lejos[1] - cerca[1], lejos[2] - cerca[2]]) };
}

// Rayo de un control o de la mirada a partir de su matriz de pose de WebXR:
// sale del origen de la pose y apunta hacia su −Z.
export function rayoDesdePose(pose: ArrayLike<number>): Rayo {
  return {
    origen: [pose[12]!, pose[13]!, pose[14]!],
    direccion: normalizar([-pose[8]!, -pose[9]!, -pose[10]!]),
  };
}
