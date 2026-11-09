// Arma previsualizacion/index.html: una sola página con el motor real de
// Safety VR corriendo EC-01 y el estado de obra. Las cifras no se escriben a
// mano: salen de correr las pruebas y el Método de Ruptura al construir.
//
//   node tools/construir-previsualizacion.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (r) => readFileSync(`${raiz}${r}`, 'utf8');

function correrPruebas(archivo) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', archivo], { cwd: raiz, encoding: 'utf8' });
  const n = (k) => Number((r.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [0, 0])[1]);
  return { total: n('tests'), pass: n('pass'), fail: n('fail') };
}

// TypeScript -> JavaScript del navegador, sin compilador: Node quita los tipos
// y aquí se quitan los import/export, porque todo queda en un solo <script>.
// Cada módulo va en su propia función, así sus nombres internos (p. ej. GRADO)
// no chocan con los de otro; solo sale lo que el módulo exporta.
function aNavegador(r) {
  const js = stripTypeScriptTypes(leer(r), { mode: 'strip' });
  const exportados = [...js.matchAll(/^export\s+(?:async\s+function|const|function|class|let)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  const cuerpo = js
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+(?=(async\s+function|const|function|class|let)\b)/gm, '')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
  if (exportados.length === 0) return '';
  return `// ${r}\nconst { ${exportados.join(', ')} } = (() => {\n${cuerpo}\nreturn { ${exportados.join(', ')} };\n})();\n`;
}

const sumar = (...xs) => xs.reduce((a, x) => ({ total: a.total + x.total, pass: a.pass + x.pass, fail: a.fail + x.fail }), { total: 0, pass: 0, fail: 0 });
const validador = correrPruebas('src/escenario/validador.test.ts');
const motor = sumar(
  ...['maquina', 'sesion', 'presentador'].map((n) => correrPruebas(`src/motor/${n}.test.ts`)),
  ...['matematica', 'disposicion'].map((n) => correrPruebas(`src/webxr/${n}.test.ts`)),
  ...['uuidv7', 'firma', 'xapi', 'cola'].map((n) => correrPruebas(`src/telemetria/${n}.test.ts`)),
  ...['codigo', 'vigencia', 'cadena', 'verificacion'].map((n) => correrPruebas(`src/certificados/${n}.test.ts`)),
);
const idiomas = correrPruebas('src/i18n/catalogo.test.ts');
const ruptura = spawnSync(process.execPath, ['tools/romper-motor.mjs', '--json'], { cwd: raiz, encoding: 'utf8' });
const rupturas = JSON.parse(ruptura.stdout);

if (validador.fail + motor.fail + idiomas.fail > 0 || rupturas.some((r) => !r.ok)) {
  console.error('Hay pruebas en rojo o rupturas sin detectar: no se arma la previsualización.');
  process.exit(1);
}

const hoy = new Date();
const DATOS = {
  fecha: {
    'es-CO': hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    en: hoy.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
  },
  pruebas: sumar(validador, motor, idiomas),
  validador,
  motor,
  idiomas,
  catalogos: { 'es-CO': JSON.parse(leer('mensajes/es-CO.json')), en: JSON.parse(leer('mensajes/en.json')) },
  rupturas,
  plan: JSON.parse(leer('previsualizacion/plan.json')),
  hecho: JSON.parse(leer('previsualizacion/hecho.json')),
  risst: JSON.parse(leer('previsualizacion/risst.json')),
};

const codigo = ['src/escenario/validador.ts', 'src/escenario/ejemplos/ec-01.ts', 'src/motor/maquina.ts', 'src/motor/sesion.ts', 'src/motor/presentador.ts', 'src/webxr/matematica.ts', 'src/webxr/disposicion.ts', 'src/webxr/dibujo.ts', 'src/webxr/visor.ts', 'src/telemetria/uuidv7.ts', 'src/telemetria/firma.ts', 'src/telemetria/xapi.ts', 'src/telemetria/cola.ts', 'src/certificados/codigo.ts', 'src/certificados/vigencia.ts', 'src/certificados/cadena.ts', 'src/certificados/verificacion.ts'].map(aNavegador).join('\n');

const html = leer('previsualizacion/plantilla.html')
  .replace('/*__MOTOR__*/', () => codigo)
  .replace('/*__DATOS__*/', () => JSON.stringify(DATOS));

writeFileSync(`${raiz}previsualizacion/index.html`, html);
console.log(`previsualizacion/index.html · ${DATOS.pruebas.pass}/${DATOS.pruebas.total} pruebas · ${rupturas.length} rupturas detectadas`);
