// Arma las páginas web de Safety VR con el motor real:
// - previsualizacion/index.html — el estado de obra (pruebas, plan, demo técnica).
// - sitio/index.html            — la PLATAFORMA: lo que ve un trabajador.
// - sitio/avance/index.html     — el estado de obra, publicado aparte.
// Las cifras no se escriben a mano: salen de correr las pruebas y el Método
// de Ruptura al construir. sitio/ es lo que GitHub Pages publica.
//
//   node tools/construir-previsualizacion.mjs

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (r) => readFileSync(`${raiz}${r}`, 'utf8');

function correrPruebas(archivo) {
  // TAP explícito: desde Node 23 el reportero por omisión no es TAP y los
  // conteos `# tests N` desaparecerían (la página diría 0 pruebas).
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=tap', '--test-timeout=20000', archivo], { cwd: raiz, encoding: 'utf8', timeout: 120_000 });
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
// Todas las suites de idioma (catálogos, negociación, textos crudos), sin lista a mano.
const idiomas = sumar(...readdirSync(`${raiz}src/i18n`).filter((n) => n.endsWith('.test.ts')).map((n) => correrPruebas(`src/i18n/${n}`)));
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

const armar = (plantilla) => leer(plantilla)
  .replace('/*__MOTOR__*/', () => codigo)
  .replace('/*__DATOS__*/', () => JSON.stringify(DATOS));

// Documento HTML completo para servir fuera de la vista previa de Claude
// (GitHub Pages): doctype, codificación y ajuste para teléfono.
const documento = (cuerpo, lang) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${cuerpo}
</body>
</html>
`;

const avance = armar('previsualizacion/plantilla.html');
writeFileSync(`${raiz}previsualizacion/index.html`, avance);
mkdirSync(`${raiz}sitio/avance`, { recursive: true });
writeFileSync(`${raiz}sitio/index.html`, documento(armar('plataforma/plantilla.html'), 'es-CO'));
writeFileSync(`${raiz}sitio/avance/index.html`, documento(avance, 'es-CO'));
writeFileSync(`${raiz}sitio/.nojekyll`, '');
console.log(`sitio/ (plataforma + avance) · ${DATOS.pruebas.pass}/${DATOS.pruebas.total} pruebas · ${rupturas.length} rupturas detectadas`);
