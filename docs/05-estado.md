# SAFETY VR — Bitácora de sesiones

Regla: al iniciar una sesión de trabajo, leer este archivo; al terminar, agregar
la entrada nueva arriba.

---

## 9 de noviembre de 2026 (2) — la demo en vivo muestra la plataforma

El usuario vio que la demo publicada mostraba el reporte de avance y no la
plataforma. Corrección:
- `app/plantilla.html`: la página del producto, bilingüe (claves
  `plataforma.*` en los catálogos): portada, ficha del escenario, botones para
  empezar en pantalla o en realidad virtual, visor 360°, resultado con los
  criterios, certificado (de demostración, guardado en el navegador) y
  verificación pública por código.
- El sitio se arma en `sitio/`: la plataforma en la raíz y el avance en
  `/avance/`. Las páginas ahora salen como documento HTML completo (doctype,
  codificación y ajuste para teléfono); antes dependían del envoltorio de la
  vista previa de Claude.
- Bug evitado antes de publicar: cambiar de idioma con el resultado en pantalla
  volvía a emitir el certificado. Emitir y mostrar quedaron separados, con
  comprobación en navegador.
- `probar-visor.mjs` recorre también la plataforma como un trabajador.
- Respaldo previo: commit `0c03518` en GitHub y
  `respaldos/repo-safety-vr-2026-11-09_1328.zip` (el disco F rechazó la
  escritura en ese momento; el .zip se entregó por el chat).

---

## 9 de noviembre de 2026 — MVP publicado en GitHub

- Repositorio público: https://github.com/safetyvr360-tech/safety-vr (cuenta
  safetyvr360-tech; el usuario inició sesión y autorizó la aplicación de Claude
  en GitHub).
- Primer commit `653867a` en `main`: 52 archivos (la previsualización generada
  no se versiona; GitHub Actions la construye).
- GitHub Pages configurado con origen «GitHub Actions». Demo:
  https://safetyvr360-tech.github.io/safety-vr/
- Respaldo previo: `respaldos/codigo-2026-11-09_0031.zip`.
- La copia de trabajo del repositorio es la fuente de verdad desde ahora; la
  carpeta `codigo/` del disco F se mantiene sincronizada con ella.

---

## 8 de noviembre de 2026 (4) — MVP listo para GitHub

El usuario pidió subir un MVP a GitHub. Desde la sesión de Claude no hay cuenta
de GitHub conectada, así que se dejó la carpeta `codigo/` lista para publicar:
- `README.md` (bilingüe) con qué hay, cómo probarlo y el estado.
- `package.json` sin dependencias: `npm test`, `npm run romper`,
  `npm run previsualizacion`, `npm run probar-visor`, `npm run verificar`.
- `.gitignore`.
- `.github/workflows/verificar-y-publicar.yml`: en cada push corre pruebas,
  ruptura, previsualización y la prueba del visor en Chromium; en `main`, si
  todo pasa, publica la demo en GitHub Pages (https: sirve para abrir el visor
  en un Meta Quest).

Verificado: YAML válido; un clon limpio desde git pasa las 178 pruebas y arma
la previsualización (53 archivos). Solo se sube `codigo/`: los documentos de
negocio (modelo financiero, contrato) quedan fuera del repositorio.

Nota: GitHub Pages en un repositorio **privado** requiere un plan pago de
GitHub; con el plan gratuito, Pages solo funciona en repositorios públicos.

---

## 8 de noviembre de 2026 (3) — certificados con hash encadenado y verificación pública

**Contexto.** La instalación de paquetes sigue bloqueada (registro npm sin
acceso). Se avanzó con la siguiente pieza pura del plan.

**Búsqueda de bugs.** `verificar()` lanzaba una excepción con un paquete sin
firma o con firma que no es texto; en el servidor habría tumbado la petición.
Ahora devuelve `false` (paquete rechazado). Prueba y ruptura.
Nueva en `firma.ts`: `huella()`, SHA-256 público del JSON canónico.

**`src/certificados/`** (puro):
- `codigo.ts` — `SVR-XXXX-XXXX-XXXX`, Crockford base32 (sin I, L, O, U) y
  dígito de control Luhn mod 32. Detecta todo error de un carácter y casi todo
  intercambio de vecinos antes de consultar el servidor. Acepta lo que teclea
  una persona (minúsculas, espacios, O por 0, I/L por 1).
- `vigencia.ts` — fechas civiles de Colombia (UTC−5), suma de meses con fin de
  mes y bisiestos; `vigente` / `por_vencer` (30 días, configurable) / `vencido`;
  el último día todavía es vigente.
- `cadena.ts` — `emitirCertificado`: solo sesiones aptas, del mismo escenario y
  versión; guarda `sesion_huella` (SHA-256 del paquete firmado) y
  `hash_anterior`; vence según `vigencia_meses` del escenario. Sin puntaje ni
  respuestas (ADR-001). `verificarCadena` detecta huella alterada, eslabón roto
  (también si recalculan la huella del alterado), certificado borrado del medio,
  inicio inválido y mezcla de organizaciones. `respaldoIntacto` comprueba la
  sesión contra su huella.
- `verificacion.ts` — verificación pública por código: `codigo_invalido` (sin
  ir a la base), `no_encontrado`, `alterado` (propia huella o eslabón
  siguiente), `vigente`, `por_vencer`, `vencido`; y la vista bilingüe con fechas
  según el idioma. Claves `cert.*` en los catálogos.

**SQL — escrito, NO ejecutado (no hay PostgreSQL aquí):**
`prisma/sql/002_certificado_cadena.sql` agrega `sesion_huella`, `competencia`,
`version_simulador` (todo lo que entra en la huella tiene que estar en la tabla
para que un auditor la recalcule), quita el default de `emitido_el`, valida
formatos, impide bifurcar la cadena (índice único por organización y
`hash_anterior`) y prohíbe editar un certificado emitido. Pruebas en
`prisma/sql/pruebas/certificado_cadena.sql`.

**Verificación.**
- Node: 178/178 (certificados: código 7, vigencia 6, cadena 10, verificación 7;
  firma 8).
- Ruptura: 70 de 70.
- Navegador: 27 de 27 — ahora también: dos aprobaciones emiten dos certificados
  encadenados, el código se verifica vigente, la vista pública no muestra el
  puntaje, a 13 meses aparece vencido, alterar el primero rompe el eslabón 2 y
  la verificación lo denuncia.

**Siguiente.** Con paquetes: app Next.js, LRS y punto de sincronización, y
correr las migraciones 001 y 002 con sus pruebas en PostgreSQL. Sin paquetes:
bitácora atómica de la máquina de estados de la ruta formativa (§3.6), en
lógica pura.

---

## 8 de noviembre de 2026 (2) — SDK de telemetría: xAPI, paquete firmado y cola offline

**Por qué esto y no la app Next.js.** La app necesita instalar paquetes (Next,
React, Prisma) y en esta sesión la instalación está bloqueada. Se avanzó con la
pieza del plan que no depende de paquetes y se prueba entera: el SDK de
telemetría de ADR-002.

**Búsqueda de bugs.** Dos, con su corrección:
1. Previsualización: la barra de botones se reconstruía cada segundo y un clic
   lento se perdía. Ahora solo se reconstruye si cambia su estado. Comprobación
   nueva en `probar-visor.mjs` (presionar, esperar 1,3 s, soltar).
2. `visor.destruir()`: al cerrar la sesión de RV, el evento `end` reencendía el
   bucle de pantalla sobre un visor destruido. Ahora no.

**Motor.** Los eventos de cierre (`fin`, `abandono`) llevan el `puntaje`: el
statement de aprobó/reprobó lo necesita.

**`src/telemetria/`** (puro, sin dependencias, WebCrypto para la firma):
- `uuidv7.ts` — id de sesión generado en el visor (RFC 9562), ordenado por
  fecha, con contador dentro del mismo milisegundo y a prueba de reloj que
  retrocede.
- `firma.ts` — JSON canónico (claves ordenadas) y HMAC-SHA256 en base64url;
  verificación en tiempo constante. Vector contra el RFC 4231.
- `xapi.ts` — statements xAPI 1.0.3: `initialized`, `answered` (nodo, acción,
  criterio, acierto), `omitio-requisito`, `agoto-tiempo`, `passed`/`failed` con
  puntaje y duración activa, `terminated`. `registration` = id de la sesión;
  extensiones con versión del simulador y dispositivo. ADR-001: el actor es una
  cuenta (plataforma + id del trabajador), nunca nombre ni correo. La entrada a
  cada nodo no se emite: el registro denso va por el canal binario aparte.
- `cola.ts` — paquete `safetyvr/sesion@1` (resumen para la tabla `sesion` +
  statements + firma) y cola offline: no duplica, envía en orden de fecha,
  sin red no pierde nada y reintenta con espera 2 s → 15 min, un error del
  servidor no frena a los demás, un rechazado se aparta sin reintentar, dos
  sincronizaciones a la vez no envían dos veces, `forzar` para cuando vuelve la
  red, sobrevive a un reinicio y a un almacén dañado.

**Verificación.**
- Node: 146/146 (validador 32, máquina 28, sesión 15, presentador 13,
  matemática 7, disposición 15, UUIDv7 5, firma 6, xAPI 8, cola 12, catálogos 5).
- Ruptura: 55 de 55. Destapó un hueco real: ninguna prueba exigía que un acierto
  se reportara como acierto en xAPI (solo se probaba un error). Cubierto.
- Navegador: 20 de 20, ahora con la telemetría (aprobar registra `passed` con
  100; dos sesiones llegan con firma verificada; sin red la sesión queda en
  cola; al volver la red se sincroniza). La prueba sirve la página desde
  `http://localhost` porque WebCrypto solo existe en sitios seguros.
- Herramienta de previsualización: ahora reconoce `export async function`.

**Por decidir.** Dominio del perfil xAPI (hoy configurable, «por definir»).

**Siguiente.** Habilitar la instalación de paquetes para arrancar la app
Next.js; con ella, el LRS propio y el punto de sincronización (upsert por id).
Sin paquetes se puede seguir con: certificados con hash encadenado (puro).

---

## 8 de noviembre de 2026 — adaptador: visor WebGL (modo pantalla y modo RV)

**Decisión técnica.** El usuario pidió continuar sin elegir entre three.js y
WebGL directo. Se recomendó three.js, pero desde este entorno no hay red para
descargarlo y no se habría podido probar. Se escribió con **WebGL 2 directo,
sin dependencias**, que sí se prueba en un navegador real aquí y cumple el
contrato al pie de la letra. Si más adelante se prefiere three.js, solo se
reemplaza `src/webxr/dibujo.ts`: las capas de abajo no cambian.

**Búsqueda de bugs.**
1. Tono de la retroalimentación equivocado: un acierto que entra a un nodo
   con requisito faltante mostraba el error del requisito pintado como
   «correcto». Ahora el estado trae `retroalimentacion_resultado` y el
   presentador usa ese tono. Pruebas en `maquina.test.ts` y
   `presentador.test.ts`.
2. `sesion.pausar()` antes de iniciar devuelve `no_iniciada`; prueba agregada.

Nota: un intento anterior de esta sesión, interrumpido, había dejado en la
carpeta de trabajo un primer borrador del visor (`src/visor/`) y seis claves de
catálogo que solo usaba ese borrador. Duplicaba `src/webxr/` y nunca llegó al
disco F; se retiró.

**El visor, en cuatro piezas:**
- `src/webxr/matematica.ts` (pura) — matrices 4×4 en orden de columnas,
  proyección, rayo desde la pantalla y desde la pose de un control de WebXR.
- `src/webxr/disposicion.ts` (pura) — los tres paneles (principal al frente a
  1,6 m; instrumentos 50° a la izquierda; rúbrica 50° a la derecha), el impacto
  del rayo en cada panel, el texto partido en líneas y la lista de operaciones
  de dibujo de cada panel. Si el contenido no cabe, reduce la letra hasta el
  60 % y no más.
- `src/webxr/dibujo.ts` — WebGL 2: panorama equirrectangular con un triángulo
  de pantalla completa (el fondo queda "en el infinito"), paneles como texturas
  de canvas, cursor sobre el panel. Panorama provisional mientras no existan
  las fotos 360° reales.
- `src/webxr/visor.ts` — une todo. Modo pantalla: arrastrar para mirar, tocar
  para elegir; ocultar la pestaña pausa. Modo RV (immersive-vr, espacio
  'local'): cabeza, control, mano o mirada; `select` elige; cuando el visor
  deja de estar visible, la sesión se pausa. `botonesEnPantalla()` sirve para
  pruebas y accesibilidad.

**Verificación.**
- Node: 115/115 (validador 32, máquina 28, sesión 15, presentador 13,
  matemática 7, disposición 15, catálogos 5).
- Ruptura: 37 de 37. La primera corrida destapó un hueco real: ninguna prueba
  revisaba la proporción de pantalla en la proyección. Se agregó.
- Navegador real: `tools/probar-visor.mjs` (Chromium + Playwright) recorre
  EC-01 haciendo clic sobre los paneles 3D: 15 de 15 comprobaciones (WebGL
  pinta, clic elige, arrastrar no elige, pausa congela, tiempo agotado cierra,
  Repetir reinicia, ruta correcta = apto 100, inglés, teléfono vertical).
- Corregido en la herramienta de previsualización: los módulos chocaban por
  nombres internos (`GRADO`); ahora cada uno va en su propio ámbito.

**No verificado.** El modo RV en un visor real: hay que abrir la página en un
Meta Quest. No se puede desde la vista previa de Claude (el marco no permite
WebXR).

**Siguiente.** Probar en un Quest y conseguir las fotos 360° de los tres
entornos de EC-01. Después, según el plan: app Next.js y sistema de diseño
bilingüe.

---

## 7 de noviembre de 2026 (2) — adaptador: sesión, presentador y catálogos

**Búsqueda de bugs.** Dos hallazgos, cada uno con prueba y ruptura (con el
código anterior fallan exactamente las pruebas nuevas):
1. `maquina.ts`: `criticos_fallidos` listaba los críticos todavía sin evaluar
   desde el primer nodo. Ahora un crítico sin evaluar solo cuenta como fallado
   al cerrar la sesión.
2. `validador.ts`: `idioma_faltante` solo revisaba la situación y la etiqueta
   de la acción. Ahora revisa también título, entornos, instrumentos,
   inventario, rúbrica, narración y toda retroalimentación (directiva 4).

**El adaptador WebXR, en tres capas.** Las dos primeras son puras y probadas;
la tercera solo dibuja.
- `src/motor/sesion.ts` — el motor con reloj inyectado: plazo por nodo que
  vence una sola vez, pausa al quitarse el visor (congela el plazo, bloquea
  acciones, no cuenta en la duración) y cada evento fechado. Un tiempo agotado
  revisado tarde se fecha en el vencimiento, no en la revisión.
- `src/motor/presentador.ts` — la vista que dibuja el visor, resuelta en un
  idioma: textos de interfaz desde `mensajes/*.json`, números con
  `Intl.NumberFormat` (20,9 en es-CO; 20.9 en en), aviso cuando el escenario no
  existe en el idioma pedido y nunca mezcla de idiomas. No expone respuestas.
- Dibujo WebXR — pendiente.

**Catálogos.** `mensajes/es-CO.json` y `mensajes/en.json`, con
`src/i18n/catalogo.test.ts`: mismas claves, sin textos vacíos, mismas variables
en ambos idiomas, español sin tuteo ni voseo, inglés sin español pegado.

**Verificación.** 89/89 en verde (validador 32, motor 27, sesión 13,
presentador 12, catálogos 5). `tools/romper-motor.mjs`
ahora cubre motor, sesión, presentador y catálogos: 28 de 28 rupturas
detectadas, archivos restaurados con el mismo hash.

**Previsualización.** El simulador de la página corre ahora sobre
`crearSesion` + `presentar`, con un bucle de cuadros como el del visor.

**Decisión pendiente para el dibujo WebXR.** three.js (librería de 3D estándar)
o WebGL a mano sin dependencias. Se pregunta al usuario antes de escribirlo.

---

## 7 de noviembre de 2026 — motor: intérprete puro del grafo

**Punto de partida.** Backup del 3/11/2026. Validador 25/25 en verde, verificado
de nuevo al iniciar con Node 22.23.

**Búsqueda de bugs en el validador.** Cuatro hallazgos, cada uno con su prueba y
su ruptura (se revirtió el validador al original y fallaron exactamente las
cuatro pruebas nuevas):
1. `validacion_prellenada` no revisaba `norma`.
2. El `evalua` de `al_faltar_requisito` y `al_agotar_tiempo` no se comprobaba
   contra la rúbrica.
3. `al_faltar_requisito.siguiente` no se comprobaba contra los nodos.
4. Un desenlace no correcto sin `retroalimentacion` pasaba la compuerta 1.
Validador: 29/29.

**Motor `src/motor/maquina.ts`.** Intérprete puro, sin WebXR, DOM, reloj ni
dependencias. `crearMaquina(doc)` valida el documento con `validarEscenario` y lo
rechaza si no pasa; expone `iniciar`, `estadoActual`, `ejecutar`, `agotarTiempo`
y `abandonar`. Motor: 25/25.

Reglas de interpretación decididas (confirmar las marcadas con *):
- `requiere` se revisa al entrar al nodo; si falta una marca se aplica
  `al_faltar_requisito` una vez y el trabajador sigue en el nodo, salvo que el
  desenlace declare `siguiente`. (Confirmado por el usuario el 7/11.)
- Entrar a un nodo `final` termina; `siguiente: null` también termina.
- * Cada criterio queda con su peor resultado; `parcial` vale la mitad del peso.
- * Un límite de tiempo sin `al_agotar_tiempo` es orientativo: se registra y no
  penaliza.
- Apto = terminó, puntaje ≥ `puntaje_aprobacion` y todo crítico correcto.
- `abandonar()` lleva cualquier estado vivo a `abandonada` / `incompleta`
  (directiva 6).
- El estado visible nunca expone `resultado`, `evalua` ni `siguiente`.
- Cada decisión deja un evento numerado (nodo, acción, criterio, resultado):
  materia prima de los statements xAPI de ADR-002.

**Método de Ruptura.** `node tools/romper-motor.mjs` aplica 12 rupturas sobre
copias del motor; las 12 hicieron fallar la prueba correcta y el archivo quedó
restaurado (mismo hash). La primera corrida destapó una ruptura mal apuntada
(«el tiempo agotado no califica» pegaba en el requisito faltante); se separó en
dos.

**Hallazgos de contenido en EC-01, para el RISST (no se tocó el escenario):**
- n03: un solo `al_faltar_requisito` cubre dos requisitos. Si falta solo el
  permiso, la retroalimentación habla de la atmósfera y se penaliza
  `c_medicion`: saltarse el permiso cuesta dos críticos (55 puntos).
- n02: `a_medir` usa el objeto `permiso`; debería ser el detector.
- n01 y n02: 90 s de límite sin `al_agotar_tiempo`.

**Previsualización.** `node tools/construir-previsualizacion.mjs` genera
`previsualizacion/index.html`: corre las pruebas y las rupturas, y si todo está en
verde arma una página con el motor real jugando EC-01 y el estado de obra.

**Siguiente.** Adaptador WebXR sobre `maquina.ts` (ADR-005, punto 3).
