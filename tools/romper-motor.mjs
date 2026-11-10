// Método de Ruptura (directiva 3) sobre src/motor/ y los catálogos de idioma.
// Aplica cada ruptura sobre el archivo, corre la suite que lo defiende, exige
// que falle al menos una prueba y restaura. Si una ruptura deja la suite en
// verde, el hallazgo es la prueba y este script sale con código 1.
//
//   node tools/romper-motor.mjs          informe legible
//   node tools/romper-motor.mjs --json   informe para la previsualización

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

const GRUPOS = [
  {
    archivo: 'src/motor/maquina.ts',
    prueba: 'src/motor/maquina.test.ts',
    rupturas: [
      ['un error se borra acertando después', 'an error is erased by a later correct answer', 'return GRAVEDAD[nuevo] > GRAVEDAD[previo] ? nuevo : previo;', 'return nuevo;'],
      ['el crítico fallado deja de bloquear el apto', 'a failed critical criterion no longer blocks a pass', '&& fallidos.length === 0 ?', '?'],
      ['un crítico sin evaluar figura fallado durante la sesión', 'an unassessed critical criterion shows as failed mid-session', '(r === undefined ? cerrada : r !== \'correcto\')', "r !== 'correcto'"],
      ['requiere deja de revisarse', 'requirements stop being checked', 'filter((m) => !marcas.has(m))', 'filter(() => false)'],
      ['al_entrar no mueve el instrumento', 'al_entrar no longer moves the instrument', 'l.valor = ef.valor;', ''],
      ['el estado visible sopla el resultado', 'the visible state gives away the answer', 'const av: AccionVisible = { id: a.id, etiqueta: { ...a.etiqueta } };', 'const av = { id: a.id, etiqueta: { ...a.etiqueta }, resultado: a.resultado } as AccionVisible;'],
      ['entrar a un nodo final no termina', 'entering a final node does not finish', 'if (n.final) {\n      terminar();', 'if (false) {\n      terminar();'],
      ['abandonar no lleva a estado final', 'abandoning does not reach a final state', "fase = 'abandonada';", ''],
      ['el requisito faltante no califica', 'a missing requirement is not scored', 'n.al_faltar_requisito;\n      calificar(des.evalua, des.resultado);', 'n.al_faltar_requisito;'],
      ['el tiempo agotado no califica', 'running out of time is not scored', '      }\n      calificar(des.evalua, des.resultado);', '      }'],
      ['el motor acepta escenarios inválidos', 'the engine accepts invalid scenarios', 'if (!informe.ok) {', 'if (false) {'],
      ['parcial vale lo mismo que correcto', 'partial is worth as much as correct', 'parcial: 0.5', 'parcial: 1'],
      ['el estado devuelto comparte memoria', 'the returned state shares memory', 'marcas: [...marcas].sort(),', 'marcas: marcas as unknown as string[],'],
    ],
  },
  {
    archivo: 'src/motor/sesion.ts',
    prueba: 'src/motor/sesion.test.ts',
    rupturas: [
      ['el plazo vence en cada cuadro', 'the deadline fires on every frame', 'plazo = null; // una sola vez por entrada al nodo', ''],
      ['la pausa no congela el plazo', 'pausing does not freeze the deadline', 'if (plazo !== null) plazo += congelado;', ''],
      ['se puede actuar en pausa', 'actions are allowed while paused', "if (pausaDesde !== null) throw new ErrorMotor('en_pausa');", ''],
      ['el tiempo agotado se fecha al revisar', 'a timeout is stamped when checked', 'sincronizar(p.estado, vencio);', 'sincronizar(p.estado, reloj());'],
      ['la duración cuenta la pausa', 'duration counts paused time', 'return Math.round((hasta - inicio - pausado) / 1000);', 'return Math.round((hasta - inicio) / 1000);'],
      ['cambiar de nodo no reinicia el plazo', 'changing node does not restart the deadline', '} else if (entro) {', '} else if (false) {'],
    ],
  },
  {
    archivo: 'src/motor/presentador.ts',
    prueba: 'src/motor/presentador.test.ts',
    rupturas: [
      ['mezcla idiomas cuando falta la traducción', 'mixes languages when a translation is missing', 'return doc.idiomas.includes(pedido) ? pedido : doc.idiomas[0]!;', 'return pedido;'],
      ['una clave inexistente sale como texto vacío', 'a missing key renders as empty text', "if (plantilla === undefined) throw new Error(`clave_de_catalogo_inexistente: ${clave}`);", "if (plantilla === undefined) return '';"],
      ['los números ignoran el idioma', 'numbers ignore the language', "new Intl.NumberFormat(idioma, { maximumFractionDigits: 2 })", "new Intl.NumberFormat('en', { maximumFractionDigits: 2 })"],
      ['el reloj redondea hacia abajo', 'the clock rounds down', 'Math.ceil(e.restanteMs / 1000)', 'Math.floor(e.restanteMs / 1000)'],
      ['ofrece acciones en pausa', 'offers actions while paused', 'acciones: vivo && !e.enPausa', 'acciones: vivo'],
      ['la retroalimentación pierde el tono', 'feedback loses its tone', "estado.retroalimentacion_resultado ?? 'neutro'", "'neutro'"],
    ],
  },
  {
    archivo: 'src/webxr/matematica.ts',
    prueba: 'src/webxr/matematica.test.ts',
    rupturas: [
      ['la rotación gira al revés', 'rotation turns the wrong way', 'm[0] = c; m[2] = -s; m[8] = s; m[10] = c;', 'm[0] = c; m[2] = s; m[8] = -s; m[10] = c;'],
      ['el rayo del control apunta hacia atrás', 'the controller ray points backwards', 'direccion: normalizar([-pose[8]!, -pose[9]!, -pose[10]!]),', 'direccion: normalizar([pose[8]!, pose[9]!, pose[10]!]),'],
      ['la proyección ignora el aspecto', 'projection ignores aspect ratio', 'm[0] = f / aspecto;', 'm[0] = f;'],
    ],
  },
  {
    archivo: 'src/webxr/disposicion.ts',
    prueba: 'src/webxr/disposicion.test.ts',
    rupturas: [
      ['el rayo toca paneles que están detrás', 'the ray hits panels behind the viewer', 'if (t <= 0) return null;', ''],
      ['el eje vertical del panel queda invertido', 'the panel vertical axis is flipped', 'const v = 0.5 - y / p.alto_m;', 'const v = 0.5 + y / p.alto_m;'],
      ['el texto se sale del ancho', 'text overflows the width', 'if (actual && medir(prueba, tam, peso) > ancho) {', 'if (false) {'],
      ['el fondo cuenta como contenido', 'the background counts as content', 'd.ops.slice(1).map(', 'd.ops.map('],
      ['los paneles laterales cambian de lado', 'side panels swap sides', "{ id: 'instrumentos', yaw: 50 * GRADO,", "{ id: 'instrumentos', yaw: -50 * GRADO,"],
      ['el resaltado no se ve', 'the highlight is invisible', "color: activo ? 'boton_activo' : 'boton', radio: 16, borde: activo ? 'acento' : 'linea'", "color: 'boton', radio: 16, borde: 'linea'"],
    ],
  },
  {
    archivo: 'src/telemetria/uuidv7.ts',
    prueba: 'src/telemetria/uuidv7.test.ts',
    rupturas: [
      ['el UUID pierde la versión 7', 'the UUID loses version 7', 'b[6] = 0x70 | (contador >> 8);', 'b[6] = 0x40 | (contador >> 8);'],
      ['el contador no sube en el mismo milisegundo', 'the counter does not increase within a millisecond', '      contador += 1;\n', ''],
      ['el reloj hacia atrás desordena los ids', 'a clock going back reorders ids', 'if (ms < ultimoMs) ms = ultimoMs;', ''],
    ],
  },
  {
    archivo: 'src/telemetria/firma.ts',
    prueba: 'src/telemetria/firma.test.ts',
    rupturas: [
      ['el JSON canónico no ordena las claves', 'canonical JSON does not sort keys', '.filter((k) => o[k] !== undefined).sort();', '.filter((k) => o[k] !== undefined);'],
      ['verificar acepta cualquier firma', 'verify accepts any signature', 'return d === 0;', 'return true;'],
      ['se firma con secreto vacío', 'signing with an empty secret', "if (!secreto) throw new Error('secreto_vacio');", ''],
    ],
  },
  {
    archivo: 'src/telemetria/xapi.ts',
    prueba: 'src/telemetria/xapi.test.ts',
    rupturas: [
      ['el actor lleva el correo (rompe ADR-001)', 'the actor carries an email (breaks ADR-001)', "actor: { objectType: 'Agent', account: { homePage: ctx.plataforma, name: ctx.trabajadorId } },", "actor: { objectType: 'Agent', mbox: `mailto:${ctx.trabajadorId}@x.co`, account: { homePage: ctx.plataforma, name: ctx.trabajadorId } } as never,"],
      ['un acierto se reporta como error', 'a correct answer is reported as wrong', "success: e.resultado === 'correcto',\n        extensions", "success: false,\n        extensions"],
      ['la duración cuenta las pausas', 'duration counts pauses', 'const segundos = ctx.duracionS ?? (e.en_ms - base) / 1000;', 'const segundos = (e.en_ms - base) / 1000;'],
      ['el puntaje no viaja en el cierre', 'the score is missing at the end', 'const puntaje = e.puntaje ?? 0;', 'const puntaje = 0;'],
      ['falta el registration de la sesión', 'the session registration is missing', 'registration: ctx.sesionId,', "registration: '',"],
    ],
  },
  {
    archivo: 'src/telemetria/cola.ts',
    prueba: 'src/telemetria/cola.test.ts',
    rupturas: [
      ['encolar duplica la sesión', 'enqueue duplicates the session', 'if (e.pendientes.some((x) => x.paquete.sesion.id === id) || e.rechazados.some((x) => x.paquete.sesion.id === id)) return false;', ''],
      ['sin red se pierde el paquete', 'without network the package is lost', "            actual.intentos += 1;\n            actual.ultimo_error = r;", "            e.pendientes.splice(i, 1);\n            actual.ultimo_error = r;"],
      ['se reintenta sin esperar', 'retries without waiting', '.filter((x) => opciones.forzar === true || x.proximo_intento_ms <= reloj())', '.filter(() => true)'],
      ['forzar no fuerza al volver la red', 'forcing does not force when the network returns', 'opciones.forzar === true || x.proximo_intento_ms', 'x.proximo_intento_ms'],
      ['dos sincronizaciones a la vez', 'two syncs at once', 'if (sincronizando) {', 'if (false) {'],
      ['un rechazado se reintenta para siempre', 'a rejected package retries forever', "} else if (r === 'rechazado') {", "} else if (false) {"],
      ['se envía en desorden', 'sent out of order', '.sort((a, b) => (a.paquete.sesion.id < b.paquete.sesion.id ? -1 : 1));', ';'],
    ],
  },
  {
    archivo: 'src/certificados/codigo.ts',
    prueba: 'src/certificados/codigo.test.ts',
    rupturas: [
      ['el código acepta letras confundibles', 'the code accepts confusable letters', "export const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';", "export const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUV';"],
      ['el dígito de control no se revisa', 'the check digit is not verified', 'return controlValido(s) ? formatear(s) : null;', 'return formatear(s);'],
      ['la O tecleada no se lee como cero', 'a typed O is not read as zero', ".replace(/O/g, '0')", ''],
    ],
  },
  {
    archivo: 'src/certificados/vigencia.ts',
    prueba: 'src/certificados/vigencia.test.ts',
    rupturas: [
      ['la fecha es la de UTC, no la de Colombia', 'the date is UTC, not Colombia', 'return new Date(ms + desfaseMin * 60_000).toISOString().slice(0, 10);', 'return new Date(ms).toISOString().slice(0, 10);'],
      ['el 31 de enero + 1 mes salta a marzo', 'January 31 + 1 month jumps to March', 'Math.min(d, ultimo)', 'd'],
      ['el último día ya cuenta como vencido', 'the last day already counts as expired', 'if (quedan < 0) return \'vencido\';', 'if (quedan <= 0) return \'vencido\';'],
      ['no avisa antes del vencimiento', 'no warning before expiry', "if (quedan <= diasAviso) return 'por_vencer';", ''],
    ],
  },
  {
    archivo: 'src/certificados/cadena.ts',
    prueba: 'src/certificados/cadena.test.ts',
    rupturas: [
      ['se certifica una sesión no apta', 'a failed session gets certified', "if (s.veredicto !== 'apto') throw new ErrorCertificado('sesion_no_apta');", ''],
      ['la huella ignora la vigencia', 'the hash ignores the validity date', '    vigente_hasta: c.vigente_hasta,\n    hash_anterior', '    hash_anterior'],
      ['la cadena no revisa el eslabón', 'the chain does not check the link', "if (i > 0 && c.hash_anterior !== certs[i - 1]!.hash) return { ok: false, indice: i, motivo: 'eslabon_roto' };", ''],
      ['el certificado no apunta al anterior', 'the certificate does not point to the previous one', 'hash_anterior: e.anterior ? e.anterior.hash : null,', 'hash_anterior: null,'],
      ['se acepta otra versión del simulador', 'another simulator version is accepted', "if (s.version_simulador !== `${e.doc.codigo}@${e.doc.version}`) throw new ErrorCertificado('version_distinta');", ''],
    ],
  },
  {
    archivo: 'src/certificados/verificacion.ts',
    prueba: 'src/certificados/verificacion.test.ts',
    rupturas: [
      ['la verificación no mira el eslabón siguiente', 'verification ignores the next link', 'const enlace = r.siguiente === null || r.siguiente.hash_anterior === r.cert.hash;', 'const enlace = true;'],
      ['un código mal escrito llega a la base', 'a mistyped code reaches the database', "if (!codigo) return { veredicto: 'codigo_invalido', codigo: null, cert: null };", "if (!codigo) return { veredicto: 'no_encontrado', codigo: null, cert: (await buscar(texto)) as never };"],
      ['un vencido se muestra como confiable', 'an expired one is shown as trustworthy', "const confiable = v.veredicto === 'vigente' || v.veredicto === 'por_vencer';", "const confiable = v.veredicto !== 'alterado';"],
    ],
  },
  {
    archivo: 'mensajes/en.json',
    prueba: 'src/i18n/catalogo.test.ts',
    rupturas: [
      ['falta una clave en inglés', 'a key is missing in English', '  "motor.objeto": "Uses: {objeto}",\n', ''],
      ['el inglés pierde una variable', 'English drops a variable', '"{segundos} s left"', '"seconds left"'],
    ],
  },
  {
    archivo: 'mensajes/es-CO.json',
    prueba: 'src/i18n/catalogo.test.ts',
    rupturas: [
      ['el español tutea', 'Spanish uses tú instead of usted', 'Póngase el visor para continuar.', 'Ponte el visor para continuar.'],
    ],
  },
  {
    archivo: 'src/i18n/idiomas.ts',
    prueba: 'src/i18n/idiomas.test.ts',
    rupturas: [
      ['el peso q no cuenta', 'the q weight is ignored', '.sort((a, b) => b.peso - a.peso || a.orden - b.orden)', '.sort((a, b) => a.orden - b.orden)'],
      ['q=0 cuenta como aceptado', 'q=0 counts as accepted', 'o.idioma !== null && o.peso > 0', 'o.idioma !== null'],
      ['la preferencia guardada se ignora', 'the saved preference is ignored', '  if (esIdioma(preferido)) return preferido;\n', ''],
      ['se acepta una preferencia inválida', 'an invalid preference is accepted', 'if (esIdioma(preferido)) return preferido;', 'if (preferido) return preferido;'],
      ['un español regional no va a es-CO', 'a regional Spanish does not map to es-CO', "if (base === 'es') return 'es-CO';", "if (etiqueta.trim() === 'es-CO') return 'es-CO';"],
      ['sin pistas abre en inglés', 'with no hints it opens in English', "IDIOMA_POR_OMISION: Idioma = 'es-CO'", "IDIOMA_POR_OMISION: Idioma = 'en'"],
      ['el idioma se busca en cualquier segmento', 'the language is looked up in any segment', "const primero = ruta.split('/')[1] ?? '';", "const primero = ruta.split('/').find(esIdioma) ?? '';"],
      ['cambiar de idioma apila segmentos', 'switching language stacks segments', 'if (idiomaDeRuta(camino) !== null) partes[1] = idioma;\n  else partes.splice(1, 0, idioma);', 'partes.splice(1, 0, idioma);'],
      ['cambiar de idioma pierde la consulta', 'switching language drops the query', 'return nuevo + resto;', 'return nuevo;'],
    ],
  },
  {
    archivo: 'src/i18n/textos-crudos.test.ts',
    prueba: 'src/i18n/textos-crudos.test.ts',
    rupturas: [
      ['el detector no ve texto entre etiquetas', 'the detector misses text between tags', 'if (ts.isJsxText(n) && tieneLetras(n.text))', 'if (false)'],
      ['el detector no ve atributos visibles', 'the detector misses visible attributes', 'ATRIBUTOS_VISIBLES.has(n.name.getText(sf))', 'false'],
    ],
  },
  {
    archivo: 'tools/construir-comercial.mjs',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['la página comercial no escapa el texto', 'the sales page does not escape text', 'return escapar(t(nombre, vars));', 'return t(nombre, vars);'],
      ['un dato inexistente sale vacío', 'a missing value renders empty', "if (!(k in datos)) throw new Error(`dato_inexistente: ${k}`);\n      return datos[k];", "return datos[k] ?? '';"],
      ['las variables del armador no llegan', 'values from the builder are dropped', 'vars[k] = datos[v.slice(1)];', "vars[k] = '';"],
    ],
  },
  {
    archivo: 'tools/seo-comercial.mjs',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['Google ve los planes en otra moneda', 'Google sees the plans in another currency', "price: String(precio), priceCurrency: 'COP',\n", "price: String(precio), priceCurrency: 'USD',\n"],
      ['el JSON-LD puede cerrar su etiqueta', 'the JSON-LD can close its tag', ".replace(/</g, '\\\\u003c')", ''],
      ['el sitemap pierde la versión por omisión', 'the sitemap drops the default version', "    .concat(`    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"${urls['es-CO']}\"/>`)\n", ''],
      ['el sitemap olvida la página de inversión', 'the sitemap forgets the investor page', '...[URLS, URLS_INVERSION].flatMap', '...[URLS].flatMap'],
      ['Analytics carga sin id', 'Analytics loads with no id', '  if (c.google_analytics) {', '  if (true) {'],
      ['se acepta un id de Analytics inválido', 'an invalid Analytics id is accepted', "if (c.google_analytics !== null && !/^G-[A-Z0-9]{6,12}$/.test(c.google_analytics))", 'if (false)'],
      ['las preguntas no llegan a Google', 'the questions do not reach Google', 'const PREGUNTAS = [1, 2, 3, 4, 6];', 'const PREGUNTAS = [];'],
    ],
  },
  {
    archivo: 'tools/construir-comercial.mjs',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['la versión en inglés se declara canónica la española', 'the English page claims the Spanish one as canonical', '    canonica: `${PUBLICA}${ruta}`,', "    canonica: `${PUBLICA}${rutas['es-CO']}`,"],
      ['las páginas internas pierden la raíz de los recursos', 'inner pages lose the path to the assets', "const profundidad = (ruta) => '../'.repeat(ruta.split('/').filter(Boolean).length);", "const profundidad = () => '';"],
      ['el precio «desde» no es el del plan Piloto', 'the «from» price is not the Pilot plan', '  d.piloto_desde = d.piloto_mes_cop;', '  d.piloto_desde = d.planta_mes_cop;'],
    ],
  },
  {
    archivo: 'comercial/movil.css',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['vuelve el destello al tocar', 'the tap flash comes back', 'html { -webkit-tap-highlight-color: transparent; }', ''],
      ['vuelve la espera del doble toque', 'the double-tap delay comes back', 'a, button, [role="button"] { touch-action: manipulation; }', ''],
      ['el hover queda pegado en el teléfono', 'hover sticks on the phone', '  .btn--primary:hover { background: var(--action); }\n', ''],
    ],
  },
  {
    archivo: 'plataforma/plantilla.html',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['el logo de la demo no sale de la demo', 'the demo logo stays on the demo', '<a class="marca" href="../"', '<a class="marca" href="#inicio"'],
      ['la demo pierde el enlace a los planes', 'the demo loses its link to the plans', '      <a href="../#planes" data-t="plataforma.nav.planes"></a>\n', ''],
      ['la barra de la demo vuelve a partirse en el teléfono', 'the demo bar wraps again on the phone', '@media (max-width: 640px) { .barra .nav { display: none; }', '@media (max-width: 1px) { .barra .nav { display: none; }'],
    ],
  },
  {
    archivo: 'comercial/inversion.html',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['la página de inversión no carga la capa móvil', 'the investor page skips the mobile layer', '<link rel="stylesheet" href="{{@raiz}}movil.css">\n', ''],
    ],
  },
  {
    archivo: 'src/negocio/precios.ts',
    prueba: 'src/negocio/precios.test.ts',
    rupturas: [
      ['cambia el precio de un plan', 'a plan price changes', 'planta: 1_350_000', 'planta: 1_300_000'],
      ['otra TRM de referencia', 'another reference exchange rate', 'export const TRM_REFERENCIA = 4360;', 'export const TRM_REFERENCIA = 4000;'],
      ['los dólares se truncan en vez de redondear', 'dollars are truncated instead of rounded', 'Math.round(cop / TRM_REFERENCIA)', 'Math.floor(cop / TRM_REFERENCIA)'],
      ['en inglés los pesos llevan «$»', 'in English pesos carry a «$»', "idioma === 'en' ? `COP${NB}${miles(cop, idioma)}` : `$${miles(cop, idioma)}`", '`$${miles(cop, idioma)}`'],
      ['la cifra se puede partir de su unidad', 'the figure can break from its unit', 'const NB = String.fromCharCode(160);', "const NB = ' ';"],
      ['el año no son doce meses', 'a year is not twelve months', 'anio = mes * 12;', 'anio = mes * 10;'],
    ],
  },
  {
    archivo: 'src/negocio/modelo.ts',
    prueba: 'src/negocio/modelo.test.ts',
    rupturas: [
      ['un cliente entra un mes antes', 'a client starts a month early', "{ mes: 6, tipo: 'piloto' }", "{ mes: 5, tipo: 'piloto' }"],
      ['el mes de entrada no se cobra', 'the starting month is not billed', 'ENTRADAS.filter((e) => e.mes <= i + 1).reduce', 'ENTRADAS.filter((e) => e.mes < i + 1).reduce'],
      ['el uso de fondos no suma el capital', 'the use of funds does not add up', "['hardware', 4_700_000]", "['hardware', 4_500_000]"],
      ['otra cifra de ingresos por marca blanca', 'another white-label revenue figure', 'marca_blanca: 17_400_000', 'marca_blanca: 17_000_000'],
      ['otro tamaño de mercado', 'another market size', 'EMPRESAS_OBJETIVO_ESTIMADAS = 700;', 'EMPRESAS_OBJETIVO_ESTIMADAS = 800;'],
      ['el mes que cubre el fijo se cuenta desde cero', 'the break-even month is counted from zero', 'findIndex((m) => m > COSTO_FIJO_MES) + 1;', 'findIndex((m) => m > COSTO_FIJO_MES);'],
    ],
  },
  {
    archivo: 'comercial/plantilla.html',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['la página comercial trae texto escrito a mano', 'the sales page has hand-written text', '<h2 id="planes-h">{{venta.planes.titulo}}</h2>', '<h2 id="planes-h">Planes y precios</h2>'],
      ['la página comercial usa una clave que no existe', 'the sales page uses a key that does not exist', '{{venta.planes.titulo}}', '{{venta.planes.titulos}}'],
      ['«Pasos» pierde su enlace a los planes', 'Steps loses its link to the plans', '<a class="link" href="#planes">{{venta.pasos.cta}}</a>', '<span>{{venta.pasos.cta}}</span>'],
      ['la página comercial deja de cargar el menú que marca la sección', 'the sales page stops loading the section-marking menu', '<script src="{{@raiz}}navegacion.js" defer></script>', ''],
    ],
  },
  {
    archivo: 'comercial/navegacion.js',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['el menú no escucha el desplazamiento', 'the menu does not listen to scrolling', "addEventListener('scroll', pedir, { passive: true });", "addEventListener('scrollend', pedir, { passive: true });"],
      ['el menú marca la sección antes de que llegue a la mitad', 'the menu marks the section before it reaches the middle', 'if (r.top <= mitad && r.bottom > mitad) nuevo = a;', 'if (r.top <= innerHeight && r.bottom > mitad) nuevo = a;'],
      ['el menú deja marcada la sección anterior', 'the menu leaves the previous section marked', "    if (actual) actual.removeAttribute('aria-current');\n", ''],
      ['el menú marca otra cosa que la sección', 'the menu marks something other than the section', "nuevo.setAttribute('aria-current', 'location')", "nuevo.setAttribute('aria-current', 'page')"],
    ],
  },
  {
    archivo: 'comercial/comun.css',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['el menú marca la sección sin que se vea', 'the menu marks the section invisibly', '.nav__link[aria-current="location"]::after { content: ""', '.nav__link[aria-current="lugar"]::after { content: ""'],
      ['el botón secundario vuelve a fundirse con el fondo', 'the secondary button blends into the ground again', '.btn--secondary:hover { border-color: var(--line-strong); }', '.btn--secondary:hover { border-color: transparent; }'],
      ['el certificado vuelve a tachar sus pasos', 'the certificate strikes its steps again', '.ui-checks .ui-check.is-done .ui-check__label::after { transform: scaleX(0); }', '.ui-check.is-done .ui-check__label::after { transform: scaleX(0); }'],
      ['los días de vencimiento vuelven a partirse', 'the expiry days wrap again', '.ui-win__age { white-space: nowrap; }', '.ui-win__age { white-space: normal; }'],
      ['en el teléfono la raya vuelve al pie de la caja táctil', 'on the phone the line drops to the foot of the tap box', '{ background-position: 0 calc(100% - 10px), 0 calc(100% - 10px); }', '{ background-position: 0 100%, 0 100%; }'],
    ],
  },
  {
    archivo: 'tools/construir-comercial.mjs',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['el armado no copia los detalles comunes', 'the build does not copy the shared details', "'movil.css', 'comun.css', 'navegacion.js']", "'movil.css']"],
      ['«año 1» vuelve a partirse en los títulos', '"año 1" breaks across lines in headings again', ".replace(/\\baño (\\d)/g, 'año&nbsp;$1')", ''],
      ['la sección de video se publica con el póster de stock', 'the video section ships with the stock poster', '  if (videos.youtube) return plantilla;', '  return plantilla;'],
      ['la marca vuelve a partirse en los títulos', 'the brand breaks across lines in headings again', 'return { html: marcaSinCorte(html), usadas: [...usadas] };', 'return { html, usadas: [...usadas] };'],
      ['la marca sin corte se aplica también fuera de los títulos', 'the unbreakable brand also applies outside headings', '/(<h[1-3][^>]*>)([\\s\\S]*?)(<\\/h[1-3]>)/g', '/(<[a-z][1-3]?[^>]*>)([\\s\\S]*?)(<\\/[a-z][1-3]?>)/g'],
    ],
  },
  {
    archivo: 'comercial/inversion.html',
    prueba: 'src/i18n/comercial.test.ts',
    rupturas: [
      ['en el teléfono la nota de la fila vuelve a una columna angosta', 'on the phone the row note goes back to a narrow column', '    .rows > li > p { grid-column: 1 / -1; }', '    .rows > li > p { grid-column: 1; }'],
      ['el gráfico de fondos vuelve a partir los nombres en tres líneas', 'the funds chart splits the names into three lines again', '    .grafico--fondos .rubro { grid-template-columns: minmax(0, 1fr); gap: var(--s-1); }', '    .grafico--fondos .rubro { gap: var(--s-1); }'],
      ['el degradado del héroe vuelve a tapar el eje del gráfico', 'the hero fade covers the chart axis again', '@media (min-width: 640px) { .hero--centred .hero__window { -webkit-mask-image', '@media (min-width: 6400px) { .hero--centred .hero__window { -webkit-mask-image'],
      ['la página de inversión deja de cargar los detalles comunes', 'the investor page stops loading the shared details', '<link rel="stylesheet" href="{{@raiz}}comun.css">', ''],
      ['la captura del visor vuelve al marco 4:3', 'the viewer capture goes back to the 4:3 frame', 'style="--ratio: 56.25%">\n          <img class="frame__img" src="{{@raiz}}assets/img/ec01-visor.jpg"', 'style="--ratio: 75%">\n          <img class="frame__img" src="{{@raiz}}assets/img/ec01-visor.jpg"'],
    ],
  },
  {
    archivo: 'src/componentes/piezas.tsx',
    prueba: 'src/i18n/textos-crudos.test.ts',
    rupturas: [
      ['un componente trae texto escrito a mano', 'a component has hand-written text', '<label htmlFor={props.id}>{props.etiqueta}</label>', '<label htmlFor={props.id}>Código</label>'],
    ],
  },
  {
    archivo: 'src/componentes/navegacion.tsx',
    prueba: 'src/i18n/textos-crudos.test.ts',
    rupturas: [
      ['una etiqueta accesible escrita a mano', 'a hand-written accessible label', 'aria-label={props.etiqueta}', 'aria-label="Idioma"'],
    ],
  },
];

const json = process.argv.includes('--json');
const informe = [];
let huecos = 0;

// Si el proceso muere en medio de una ruptura (Ctrl+C, un límite de tiempo, un
// cierre forzado que en Windows no deja correr ningún manejador), el archivo
// quedaría roto en la copia de trabajo: pasó una vez con disposicion.ts. Antes
// de romper se anota el original en .romper-en-curso.json; al terminar el grupo
// se borra la nota, y al arrancar se restaura cualquier nota que haya quedado.
const NOTA = `${raiz}.romper-en-curso.json`;
if (existsSync(NOTA)) {
  const { archivo, original } = JSON.parse(readFileSync(NOTA, 'utf8'));
  writeFileSync(`${raiz}${archivo}`, original);
  rmSync(NOTA);
  console.error(`Una corrida anterior quedó interrumpida: ${archivo} restaurado a su original.`);
}
let enCurso = null;
for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(senal, () => {
    if (enCurso) { writeFileSync(enCurso.ruta, enCurso.original); rmSync(NOTA, { force: true }); }
    process.exit(130);
  });
}

// Reportero TAP explícito: desde Node 23 el reportero por omisión es «spec»
// aunque la salida no sea una terminal, y sin `not ok` toda ruptura parecería
// en verde. El límite por prueba convierte un cuelgue en un fallo con nombre;
// el del proceso es la última red.
const ARGS_PRUEBA = ['--experimental-strip-types', '--test', '--test-reporter=tap', '--test-timeout=20000'];
const correr = (prueba) => spawnSync(process.execPath, [...ARGS_PRUEBA, prueba], { cwd: raiz, encoding: 'utf8', timeout: 120_000 });

// Antes de romper: cada suite intacta pasa y su salida se entiende. Si no, el
// informe de ruptura no valdría nada (una suite que no se lee «nunca falla»).
for (const prueba of new Set(GRUPOS.map((g) => g.prueba))) {
  const r = correr(prueba);
  const pasan = Number((r.stdout.match(/^# pass (\d+)/m) ?? [0, 0])[1]);
  if (r.status !== 0 || pasan === 0) {
    console.error(`La suite ${prueba} no pasa intacta o su salida no se pudo leer (código ${r.status}, ${pasan} en verde). No se rompe nada.`);
    process.exit(2);
  }
}

for (const g of GRUPOS) {
  const ruta = `${raiz}${g.archivo}`;
  const original = readFileSync(ruta, 'utf8');
  enCurso = { ruta, original };
  writeFileSync(NOTA, JSON.stringify({ archivo: g.archivo, original }));
  try {
    for (const [nombre, nombreEn, buscar, poner] of g.rupturas) {
      const entrada = { archivo: g.archivo, nombre: { 'es-CO': nombre, en: nombreEn }, ok: false, fallidas: [] };
      informe.push(entrada);
      if (!original.includes(buscar)) {
        huecos += 1;
        if (!json) console.log(`?? ${g.archivo} · ${nombre}: el fragmento ya no existe, actualice la ruptura`);
        continue;
      }
      writeFileSync(ruta, original.replace(buscar, poner));
      const r = correr(g.prueba);
      entrada.fallidas = [...(r.stdout ?? '').matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
      // La suite que no termina o se cae también delata la ruptura.
      if (entrada.fallidas.length === 0 && r.status !== 0) entrada.fallidas = [r.error ? 'ETIMEDOUT' : `exit ${r.status}`];
      entrada.ok = entrada.fallidas.length > 0;
      if (!entrada.ok) huecos += 1;
      if (!json) {
        console.log(entrada.ok
          ? `ok ${g.archivo} · ${nombre}\n     -> ${entrada.fallidas.join('\n     -> ')}`
          : `XX ${g.archivo} · ${nombre}: la suite siguió en verde`);
      }
    }
  } finally {
    writeFileSync(ruta, original);
    rmSync(NOTA, { force: true });
    enCurso = null;
  }
}

if (json) process.stdout.write(JSON.stringify(informe));
else console.log(huecos === 0 ? `\nLas ${informe.length} rupturas fueron detectadas. Archivos restaurados.` : `\n${huecos} ruptura(s) sin detectar. Archivos restaurados.`);
process.exit(huecos === 0 ? 0 : 1);
