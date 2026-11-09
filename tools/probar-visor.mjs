// Prueba del visor en un navegador real (Chromium con Playwright): carga la
// previsualización, recorre EC-01 haciendo clic sobre los paneles 3D como lo
// haría una persona, gira la vista hacia los paneles laterales, pausa, agota
// el tiempo y revisa que el lienzo WebGL de verdad pinte algo.
//
// Necesita Playwright instalado (npm i -D playwright; npx playwright install chromium).
//   node tools/construir-previsualizacion.mjs && node tools/probar-visor.mjs [carpeta-de-capturas]

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const capturas = process.argv[2] ?? null;
if (capturas) mkdirSync(capturas, { recursive: true });

const fallos = [];
const comprobar = (cond, msg) => { console.log(`${cond ? 'ok' : 'XX'} ${msg}`); if (!cond) fallos.push(msg); };

const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
const errores = [];
pagina.on('pageerror', (e) => errores.push(e.message));
pagina.on('console', (m) => { if (m.type() === 'error' && !/ERR_|fonts\.g/.test(m.text())) errores.push(m.text()); });
const html = readFileSync(`${raiz}previsualizacion/index.html`, 'utf8');
// Se sirve desde http://localhost, que el navegador trata como sitio seguro:
// WebCrypto (la firma del paquete) solo existe en sitios seguros.
await pagina.route('http://localhost/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>${html}</body></html>` }));
await pagina.goto('http://localhost/');
await pagina.waitForTimeout(800);

const canvas = pagina.locator('#visor3d');
const caja = await canvas.boundingBox();
const estado = () => pagina.evaluate(() => { const e = visor.sesion().estadoActual(); return { fase: e.fase, nodo: e.nodo && e.nodo.id, puntaje: e.puntaje, veredicto: e.veredicto, criterios: e.criterios }; });
// Se lee dentro de un cuadro de animación, justo después de que el visor
// dibuja: fuera de él el navegador ya borró el búfer.
const pixelesPintados = () => pagina.evaluate(() => new Promise((listo) => requestAnimationFrame(() => {
  const c = document.getElementById('visor3d');
  const gl = c.getContext('webgl2');
  const px = new Uint8Array(4 * 16);
  let distintos = 0;
  for (let i = 0; i < 16; i += 1) {
    gl.readPixels(Math.floor(c.width * ((i % 4) + 0.5) / 4), Math.floor(c.height * (Math.floor(i / 4) + 0.5) / 4), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px.subarray(i * 4, i * 4 + 4));
  }
  for (let i = 0; i < 16; i += 1) if (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2] > 30) distintos += 1;
  listo(distintos);
})));
async function clicEnBoton(id) {
  const bs = await pagina.evaluate(() => visor.botonesEnPantalla());
  const b = bs.find((x) => x.id === id);
  if (!b) throw new Error(`el botón ${id} no está en pantalla: ${bs.map((x) => x.id)}`);
  // La página pudo desplazarse: se trae el lienzo a la vista y se mide de nuevo.
  await canvas.scrollIntoViewIfNeeded();
  const c = await canvas.boundingBox();
  await pagina.mouse.click(c.x + b.x, c.y + b.y);
  await pagina.waitForTimeout(120);
}
async function captura(nombre) { if (capturas) await canvas.screenshot({ path: `${capturas}/${nombre}.png` }); }

comprobar(errores.length === 0, `sin errores al cargar ${errores.join(' | ')}`);
comprobar((await estado()).nodo === 'n01_permiso', 'arranca en n01_permiso');
await pagina.waitForTimeout(300);
comprobar(await pixelesPintados() >= 12, 'el lienzo WebGL pinta panorama y paneles');
await captura('1-inicio');

await clicEnBoton('a_revisar_permiso');
comprobar((await estado()).nodo === 'n02_atmosfera', 'clic sobre el panel 3D ejecuta la acción');
await clicEnBoton('a_medir');
await clicEnBoton('a_designar_vigia');
await clicEnBoton('a_arnes');
comprobar((await estado()).nodo === 'n05_alarma', 'cuatro decisiones correctas llevan a la alarma');
await pagina.waitForTimeout(300);
await captura('2-alarma');

// Arrastrar para mirar a la izquierda: aparece el panel de instrumentos.
await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
await pagina.mouse.down();
await pagina.mouse.move(caja.x + caja.width / 2 + 360, caja.y + caja.height / 2, { steps: 12 });
await pagina.mouse.up();
await pagina.waitForTimeout(250);
comprobar((await estado()).nodo === 'n05_alarma', 'arrastrar no elige ninguna opción');
comprobar((await pagina.evaluate(() => visor.botonesEnPantalla().length)) < 3, 'al girar, los botones del frente salen de la vista');
await captura('3-instrumentos');
await pagina.evaluate(() => visor.mirar(0, 0));

// Un clic lento (presionar, esperar más de un segundo, soltar) no se pierde
// aunque la columna lateral se refresque mientras tanto.
const bPausa = await pagina.locator('#controles >> text=Quitarse el visor').boundingBox();
await pagina.mouse.move(bPausa.x + bPausa.width / 2, bPausa.y + bPausa.height / 2);
await pagina.mouse.down();
await pagina.waitForTimeout(1300);
await pagina.mouse.up();
await pagina.waitForTimeout(100);
comprobar(await pagina.evaluate(() => visor.sesion().enPausa()), 'un clic lento sobre «Quitarse el visor» sí pausa');
const antes =await pagina.evaluate(() => visor.sesion().restanteMs());
await pagina.waitForTimeout(1200);
const despues = await pagina.evaluate(() => visor.sesion().restanteMs());
comprobar(antes === despues, `en pausa el reloj no corre (${antes} = ${despues})`);
comprobar((await pagina.evaluate(() => visor.botonesEnPantalla().length)) === 0, 'en pausa no hay opciones para elegir');
await captura('4-pausa');
await pagina.click('#controles >> text=Ponerse el visor');
await pagina.click('#controles >> text=Agotar el tiempo ahora');
await pagina.waitForTimeout(250);
const fin = await estado();
comprobar(fin.fase === 'terminada' && fin.veredicto === 'no_apto', 'agotar el tiempo en la alarma termina no apto');
await captura('5-cierre');

await clicEnBoton('__repetir__');
comprobar((await estado()).nodo === 'n01_permiso', 'el botón Repetir del panel reinicia el escenario');
for (const a of ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar']) await clicEnBoton(a);
const apto = await estado();
comprobar(apto.veredicto === 'apto' && apto.puntaje === 100, 'la ruta correcta completa con clics termina apto con 100');

// Telemetría: al cerrar, statements xAPI + paquete firmado + cola.
await pagina.waitForTimeout(400);
const json = await pagina.textContent('#json');
comprobar(json.includes('adlnet.gov/expapi/verbs/passed') && json.includes('"raw": 100'), 'al aprobar se registra «passed» con puntaje 100');
comprobar(/2 sesión\(es\) recibidas/.test(await pagina.textContent('#colainfo')), 'las dos sesiones cerradas llegaron al servidor con la firma verificada');
await pagina.click('text=Cortar la red');
await pagina.click('#controles .btn.primario');
await pagina.click('#controles >> text=Abandonar sesión');
await pagina.waitForTimeout(400);
comprobar((await pagina.locator('#colalista li').count()) === 1 && /incompleta/.test(await pagina.textContent('#colalista')), 'sin red, la sesión abandonada queda en la cola');
await pagina.click('text=Volver a conectar');
await pagina.waitForTimeout(500);
comprobar(/3 sesión\(es\) recibidas/.test(await pagina.textContent('#colainfo')), 'al volver la red, la cola se sincroniza sola');
await clicEnBoton('__repetir__');
for (const a of ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar']) await clicEnBoton(a);

// Certificados: cada aprobación emite uno, encadenado al anterior.
await pagina.waitForTimeout(500);
comprobar((await pagina.locator('#cadena li').count()) === 2, 'dos aprobaciones emitieron dos certificados');
comprobar(/Cadena íntegra: 2/.test(await pagina.textContent('#cadenaestado')), 'la cadena de la organización está íntegra');
await pagina.click('#verif-btn');
await pagina.waitForTimeout(200);
comprobar(/Certificado vigente/.test(await pagina.textContent('#verif-res')), 'el código recién emitido se verifica como vigente');
comprobar(!/puntaje|score/i.test(await pagina.textContent('#verif-res')), 'la verificación pública no muestra el puntaje');
await pagina.selectOption('#verif-fecha', 'mas13');
await pagina.waitForTimeout(200);
comprobar(/Certificado vencido/.test(await pagina.textContent('#verif-res')), 'dentro de 13 meses aparece vencido');
await pagina.selectOption('#verif-fecha', 'hoy');
await pagina.click('text=Alterar un certificado (prueba)');
await pagina.waitForTimeout(300);
comprobar(/Cadena rota en el eslabón 2/.test(await pagina.textContent('#cadenaestado')), 'alterar el primero y recalcular su huella rompe el eslabón siguiente');
await pagina.locator('#cadena li button').first().click();
await pagina.waitForTimeout(200);
comprobar(/Registro alterado/.test(await pagina.textContent('#verif-res')), 'la verificación pública denuncia el certificado alterado');
await pagina.click('text=Restaurar');
await canvas.scrollIntoViewIfNeeded();

await pagina.click('#en');
await pagina.waitForTimeout(250);
comprobar(await pagina.evaluate(() => visor.vista().cierre.titulo) === 'Pass', 'cambiar a inglés cambia el panel 3D');
await captura('6-ingles');

await pagina.setViewportSize({ width: 390, height: 844 });
await pagina.click('#controles .btn.primario');
await pagina.waitForTimeout(300);
const enTelefono = await pagina.evaluate(() => visor.botonesEnPantalla().map((b) => b.id));
comprobar(enTelefono.length === 2, `en un teléfono vertical los dos botones siguen a la vista (${enTelefono})`);
if (capturas) await canvas.screenshot({ path: `${capturas}/7-telefono.png` });

comprobar(errores.length === 0, `sin errores durante el recorrido ${errores.join(' | ')}`);

// ---------------------------------------------------------------- plataforma
// La página que publica GitHub Pages (sitio/index.html), usada como la usaría
// un trabajador: empezar, decidir sobre los paneles 3D, ver el resultado,
// recibir el certificado y verificarlo.
const p2 = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
const errores2 = [];
p2.on('pageerror', (e) => errores2.push(e.message));
p2.on('console', (m) => { if (m.type() === 'error' && !/ERR_|fonts\.g/.test(m.text())) errores2.push(m.text()); });
const sitio = readFileSync(`${raiz}sitio/index.html`, 'utf8');
await p2.route('http://localhost/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: sitio }));
await p2.goto('http://localhost/');
await p2.waitForTimeout(500);
comprobar(await p2.evaluate(() => document.compatMode) === 'CSS1Compat', 'la plataforma se sirve como documento HTML completo (sin modo de compatibilidad)');
comprobar(/Capacitación en seguridad industrial/.test(await p2.textContent('h1')), 'la portada es la de la plataforma, no la del avance');
comprobar(!(await p2.isVisible('text=Pruebas en verde')), 'la portada no muestra cifras de desarrollo');
await p2.click('#b-empezar');
await p2.waitForTimeout(400);
const lienzo = p2.locator('#visor');
async function elegir(id) {
  const bs = await p2.evaluate(() => visor.botonesEnPantalla());
  const b = bs.find((x) => x.id === id);
  if (!b) throw new Error(`plataforma: el botón ${id} no está en pantalla`);
  await lienzo.scrollIntoViewIfNeeded();
  const c = await lienzo.boundingBox();
  await p2.mouse.click(c.x + b.x, c.y + b.y);
  await p2.waitForTimeout(120);
}
for (const a of ['a_revisar_permiso', 'a_medir', 'a_designar_vigia', 'a_arnes', 'a_evacuar']) await elegir(a);
await p2.waitForTimeout(500);
comprobar(await p2.isVisible('#resultado') && /APTO/.test(await p2.textContent('#r-resumen')), 'al terminar la plataforma muestra el resultado');
const codigo = (await p2.textContent('#r-certificado .codigo') || '').trim();
comprobar(/^SVR-/.test(codigo), `al aprobar recibe un certificado (${codigo})`);
await p2.click('#i-en');
await p2.waitForTimeout(300);
comprobar(/PASS/.test(await p2.textContent('#r-resumen')) && await p2.evaluate(() => certs.length) === 1, 'cambiar a inglés traduce el resultado sin emitir otro certificado');
await p2.click('#i-es');
await p2.click('text=Verificar este certificado');
await p2.waitForTimeout(300);
comprobar(/Certificado vigente/.test(await p2.textContent('#v-respuesta')), 'el certificado recién emitido se verifica como vigente');
await p2.setViewportSize({ width: 390, height: 844 });
await p2.waitForTimeout(200);
comprobar(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'en un teléfono la página no se desborda hacia los lados');
comprobar(errores2.length === 0, `la plataforma no tiene errores ${errores2.join(' | ')}`);
if (capturas) {
  await p2.setViewportSize({ width: 1280, height: 900 });
  await p2.evaluate(() => window.scrollTo(0, 0));
  await p2.screenshot({ path: `${capturas}/8-plataforma.png` });
}
await navegador.close();
console.log(fallos.length === 0 ? '\nVisor verificado en navegador.' : `\n${fallos.length} comprobación(es) fallaron.`);
process.exit(fallos.length === 0 ? 0 : 1);
