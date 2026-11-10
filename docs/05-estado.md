# SAFETY VR — Bitácora de sesiones

Regla: al iniciar una sesión de trabajo, leer este archivo; al terminar, agregar
la entrada nueva arriba.

---

## 10 de noviembre de 2026 (4) — página de inversión al nivel de la comercial

- Lo corregido en la entrada (3) pasa a dos archivos comunes que cargan las dos
  páginas: `comercial/comun.css` (botón secundario con borde, iniciales legibles,
  raya del menú) y `comercial/navegacion.js` (el menú marca la sección visible).
  La página de inversión los gana: su menú marca Modelo, Suscripciones, Mercado,
  Proyección y Fondos al recorrerla, y «Ver la página comercial» ya no se funde
  con el fondo.
- **Captura del visor EC-01 en la página de inversión**: estaba en un marco 4:3
  que la agrandaba 1,38 veces (FAIL photo-upscale); ahora va en 16:9, su
  proporción (1146 x 624).
- Gate: **PASS** en la página comercial y en la de inversión.

Pruebas: 222/222 en verde, 126 de 126 rupturas detectadas.

---

## 10 de noviembre de 2026 (3) — avisos del gate en la página comercial

De los 34 avisos no bloqueantes del gate se corrigieron los que el visitante nota
(quedan 28; el gate sigue en **PASS**):
- **El menú marca la sección en la que está el lector** (`aria-current="location"`
  con un IntersectionObserver y la misma raya que el enlace activo).
- **Botones secundarios visibles**: «Probar el escenario EC-01» y «Pedir el plan…»
  quedaban a 1,02–1,15:1 del fondo; ahora llevan borde y un tono más marcado.
- **Iniciales legibles** en la maqueta de la matriz (antes 3:1).
- **«Pasos» termina con un enlace** a los planes («Ver los planes y precios» /
  «See plans and pricing»).
- Prueba nueva en `comercial.test.ts` y 4 rupturas nuevas.

Quedan como decisión de diseño: separación desigual entre secciones con fondo,
planes sin imagen, títulos que el verificador no reconoce en español.

Pruebas: 222/222 en verde, 121 de 121 rupturas detectadas.

---

## 10 de noviembre de 2026 (2) — rendimiento de las páginas públicas

**Peso y nitidez de las imágenes** (verificadores perf.mjs, consistency.mjs,
check.mjs y el gate del kit design-taste-frontend):
- perf.mjs pasó de 3 FAIL y 5 WARN a **0 y 0 en las cinco páginas** (comercial
  es-CO y en, inversión es-CO y en, demo). La página comercial en el teléfono
  baja de 1446 KiB a unos 708 KiB transferidos.
- Variantes nuevas de 360 px de las fotos del muro y de 600 px de la captura
  del visor EC-01 (`comercial/assets/img/*-360.jpg`, `ec01-visor-600.jpg`),
  generadas con Chrome sin ventana porque en esta máquina no hay ffmpeg.
- `srcset`/`sizes` correctos en el muro, los pasos, el póster del video
  (500 y 960 px, el constructor solo pone la variante que existe) y las
  imágenes del menú y los íconos con `loading="lazy"`.
- En el teléfono el muro de simuladores es una columna de tres fotos 16:10
  (antes 2 x 2 en 4:5, que agrandaba las fotos 1,8 veces); la cuarta se oculta
  porque los cuatro riesgos siguen en la lista. Así la sección cabe en dos
  pantallas. El video en el teléfono queda cuadrado (antes 4:5).
- Gate de la página comercial: **PASS** (sin FAIL; 34 avisos no bloqueantes).

Pruebas: 221/221 en verde, 117 de 117 rupturas detectadas.
Pendiente del usuario: IDs de YouTube, fotos reales, ID de Google Analytics y
token de Search Console, monto de la semilla, las 2 cuentas pares de Instagram.

---

## 10 de noviembre de 2026 — demo con salida y proyección sin deformar

**Demo jugable (`/demo/`)**, a donde llegan clientes e inversionistas desde
«Probar el escenario EC-01»:
- En el teléfono la barra superior medía 188 px y quedaba fija tapando la
  página (el menú se partía en tres filas). Ahora es una fila de 56 px (logo e
  idioma); los enlaces del menú están en el pie.
- No tenía salida: el logo apuntaba a la misma página y el pie solo al avance y
  al código. Ahora el logo lleva a la página comercial y hay «Planes y precios»
  en el menú y en el pie (`plataforma.nav.planes`).
- Mismas fuentes que el resto del sitio (Reddit Sans y JetBrains Mono en vez de
  Barlow Condensed e IBM Plex). El visor 3D dibuja con las fuentes del sistema:
  no se afecta.
- Prueba nueva y 3 rupturas (salida, planes, barra del teléfono).

**Página de inversión, proyección:** en el teléfono el gráfico SVG se estiraba
sin conservar la proporción y las barras eran bloques deformes. Ahora son
barras HTML como las del uso de fondos (nombre, monto, barra); la tabla con
las notas queda al lado en pantallas grandes y se oculta en el teléfono; el
panel iguala la altura de la tabla; en la tableta las columnas van lado a lado.

**Compuerta en la página de inversión: GATE: PASS**, con una exención nueva:
`sparse` en `#proyeccion`. El momento `line-carries-colour` oculta cada bloque
hasta que su línea pasa y el verificador cuenta solo la tinta visible en ese
instante (46 % una vez, pasa otra); medido en el navegador con todo visible:
75 % a 1440 y 65 % a 820.

221/221, 117 de 117. `check.mjs` limpio salvo ese mismo efecto del momento en
la tableta.

---

## 9 de noviembre de 2026 (12) — revisión a ojo de la página comercial

Capturas sección por sección a 1440 y 390 px. Tres fallas que ningún
verificador marcaba:
- **La ventana de matrices no mostraba los nombres de las áreas** (solo el
  círculo y «Cubierta»): sin barra lateral, la columna principal quedaba en el
  espacio de esa barra y los nombres medían 0 px. La receta del kit solo quita
  esa columna bajo 1024 px; ahora se quita siempre.
- **La nota «Escenario» tapaba el texto del documento**: en el panel ancho va
  fuera de la página, a su derecha; en el teléfono, arriba del documento.
- **El logo de Unity, negro, no se veía sobre el fondo oscuro**: los íconos van
  en `ic-dark`, la clase del kit que invierte los logos de un solo tono.
- La compuerta en la página comercial (nueva vuelta): una falla, la foto del
  visor en preguntas se agrandaba 1,56× en el teléfono (faltaba su `sizes`).
  Corregida: **GATE: PASS**.
- 220/220, 114 de 114; `check.mjs` sin hallazgos en las cuatro páginas.
- Nota: el puerto 4173 lo tomó otra sesión (otro proyecto); la vista previa de
  SAFETY VR pasó al 4180 (`.claude/launch.json`, fuera del repositorio).

---

## 9 de noviembre de 2026 (11) — pulido de detalles (skill emil-design-eng)

Revisión con los criterios de la skill. El kit salió limpio: sin
`transition: all`, sin `ease-in`, sin entradas desde `scale(0)`, botones con
respuesta al presionar (90 ms) y movimiento reducido respetado. Lo corregido
estaba en lo propio:
- Las cifras y su unidad («USD 4.587», «$10,8 M», «32,9 %») se podían partir
  en dos líneas: ahora llevan un espacio que no se parte (U+00A0), puesto por
  los formatos de `src/negocio/precios.ts`. Prueba nueva: ninguna cifra con
  unidad lleva un espacio normal; ruptura que lo devuelve.
- Cifras tabulares en los precios de los planes, los montos del uso de fondos y
  la leyenda de ingresos: los dígitos quedan alineados en columna.
- `text-wrap: pretty` en notas y descripciones que no son `<p>` (el kit solo lo
  pone en párrafos): sin palabras solas al final.
- Se dejó a propósito: las barras de los gráficos no se animan al hacer scroll.
- 220/220, 114 de 114. `check.mjs` y copy-lint sin hallazgos en las cuatro páginas.

---

## 9 de noviembre de 2026 (10) — capa móvil (skill mobile-native)

El usuario pidió seguir mejorando con las skills instaladas que se le
recomendaran: `mobile-native`, luego `emil-design-eng`, luego las de Instagram
para el plan de marketing pendiente. Esta entrada es la primera.

- `comercial/movil.css`, cargado después del kit en las dos páginas (el kit no
  se edita): sin destello gris al tocar (`-webkit-tap-highlight-color`), sin
  la espera de 300 ms (`touch-action: manipulation`), botones y menú no
  seleccionables al mantener el dedo (el texto de contenido sí), y los `:hover`
  del kit, que no estaban detrás de `(hover: hover)`, vuelven al reposo en
  pantallas táctiles: el botón ya no queda oscurecido al volver del correo.
- `<meta name="color-scheme" content="dark">`: la página solo tiene tema oscuro.
- Ya estaban bien: hero en `100svh`, `viewport-fit=cover`, zonas seguras en la
  barra móvil, zoom permitido. No hay formularios (no aplica el zoom de inputs).
  El tirar para recargar se deja: es una página de documento.
- Prueba nueva y 4 rupturas: 219/219, 113 de 113. `check.mjs` sin hallazgos.
- Comprobado en el navegador integrado emulando teléfono (estilos calculados).
  **Falta en un teléfono real:** el hover pegado, el destello y la espera del
  toque no se reproducen en emulación.

---

## 9 de noviembre de 2026 (9) — página de inversión publicada

- Subido `569daed` (antes `ec879a8`). GitHub Actions, run 42726032719: en verde.
- En línea (200, título nuevo): `/`, `/en/`, `/inversion/`, `/en/investors/`,
  `/demo/`, `sitemap.xml`, `credits.html`. La página de inversión publicada
  muestra USD 4.587 de capital semilla, $10,8 M de recurrente meta y USD 310 del
  plan Planta.
- El usuario autorizó publicar con el capital semilla de $20 M, la proyección y
  el EBITDA a la vista.

---

## 9 de noviembre de 2026 (8) — página de inversión y precios en pesos y dólares

El usuario necesita mostrar la web para buscar financiamiento: que se vea como
una startup, con planes en pesos y dólares y una página de entrada que explique
el modelo de negocio y las suscripciones.

**Una sola fuente de cifras** (`src/negocio/`, puro, con pruebas):
- `precios.ts`: los planes (Piloto $450.000, Planta $1.350.000, Corporativo
  $3.600.000 al mes), marca blanca, a medida, la TRM de referencia del modelo
  financiero ($4.360) y el formato por idioma: «$450.000» en español y
  «COP 450,000» en inglés (un «$» solo se leería como dólar). Los dólares se
  calculan, nunca se escriben.
- `modelo.ts`: metas del año 1, capital semilla y su uso, el calendario de
  entrada de clientes, el ingreso recurrente mes a mes, los ingresos por línea,
  el EBITDA y el mercado direccionable. **Las pruebas exigen las cifras del
  documento**: el calendario da los $31,5 M de suscripción directa, $2,25 M de
  recurrente en el mes 7 y $10,8 M en el mes 12, el fijo cubierto en el mes 7,
  $118,9 M de ingresos, 32,9 % de margen, el uso de fondos suma $20 M, y el
  mercado da 700 × $16,2 M = $11.340 M con meta de 0,7 %.
- Una prueba exige que ningún texto del catálogo traiga un precio escrito a
  mano: todos llegan como variables desde esos módulos.

**Página comercial:** cada plan muestra pesos y dólares al mes y al año, y la
TRM de referencia. El menú y el pie enlazan «Inversión».

**Página de inversión** (`comercial/inversion.html` → `sitio/inversion/` y
`sitio/en/investors/`), con el mismo sistema y la marca:
hero centrado con el ingreso recurrente meta del año 1 mes a mes (el fragmento
`stat`, barras calculadas del modelo) · las 3 líneas de ingreso · suscripciones
en COP y USD · mercado de Barranquilla (foto aérea del puerto, Wikimedia) ·
proyección del año 1 en franja clara con su gráfico y el momento
`line-carries-colour` · uso del capital semilla con barras por rubro ·
cronograma por trimestre y lo ya construido · cierre «Pedir el plan de negocio».
Las 700 empresas se presentan como estimación por sustentar con la Cámara de
Comercio, como dice el documento; el margen, con su advertencia (fundadores
fuera de nómina).

**Verificación (corrida aquí).**
- Node: **218/218**. Ruptura: **109 de 109** (nuevas: precios 5, modelo 6,
  armador 3, SEO 2).
- copy-lint: 0 FAIL y 0 WARN en las cuatro páginas.
- `check.mjs` a 1440, 1024, 820, 768 y 390: sin hallazgos en las cuatro.
- Compuerta de la skill en la página de inversión: **GATE: PASS**, con una
  exención: `copy-headings` (el verificador solo reconoce sustantivos de sección
  en inglés).
- Capturas revisadas a ojo: se corrigieron barras invisibles en el hero, dos
  barras negras iguales en el gráfico (el acento de la franja clara es el
  oscuro) y una lista de «ya construido» que salía tachada.

**Por confirmar con el usuario:** el monto del capital semilla ($20 M; el
documento dice que el monto pasó de $12 M a $20 M «en conversación»), y que se
quieran publicar la proyección y el EBITDA.

---

## 9 de noviembre de 2026 (7) — publicado

- Respaldo: `main` en GitHub estaba en `967c36b`. Se subieron 7 commits hasta
  `e8d879b` (herramientas, bugs de la plataforma, app Next.js, página
  comercial, SEO).
- GitHub Actions, run 42707865148: **verificar y publicar en verde**, incluida
  la prueba en navegador real (`probar-visor.mjs`, con las 2 comprobaciones
  nuevas de la plataforma), que aquí no se pudo correr.
- En línea y comprobado (200, título nuevo): `/` (página comercial es-CO),
  `/en/`, `/demo/`, `/avance/`, `sitemap.xml`, `share.jpg`, `favicon.svg`,
  `credits.html`. Sin errores en consola.
- El repositorio sigue público (Pages gratis no publica repositorios privados).

---

## 9 de noviembre de 2026 (6) — SEO de la página comercial (la lista del video)

El usuario pasó la transcripción de un video con lo que le falta a una web para
que Google la encuentre: Analytics, ficha de Google Business Profile, Search
Console, servicio y nombre en los títulos, robots.txt que no bloquee, y que la
web esté publicada de verdad.

**Lo que se revisó en el sitio publicado:** es la versión vieja (título solo
«SAFETY VR», `/en/` en 404), porque los commits no se han subido. No hay
robots.txt en la raíz del dominio (404), así que nada bloquea a los buscadores.
Un robots.txt dentro de `/safety-vr/` no lo leería ningún buscador: va en la
raíz del dominio, y ese es otro repositorio (`safetyvr360-tech.github.io`).

**Lo que se hizo** (`tools/seo-comercial.mjs`, puro):
- Canónica por idioma, `hreflang` es-CO / en / x-default, Open Graph completo
  (url, idioma, imagen absoluta 1200 × 630) y Twitter.
- Datos estructurados JSON-LD: organización, sitio, el servicio con los 3 planes
  en COP y las 5 preguntas frecuentes, en el idioma de la página. Una prueba
  exige que los precios coincidan con los del catálogo.
- `sitio/sitemap.xml` con las dos versiones enlazadas y la demo.
- `comercial/favicon.svg` (la franja de seguridad) y `comercial/share.jpg`
  (captura del hero): antes la página los nombraba y no existían.
- La demo tenía de título solo «SAFETY VR»: ahora título y descripción desde el
  catálogo, canónica e ícono.
- `comercial/sitio.json`: `google_analytics` (G-…) y `search_console` (token).
  En `null` no se carga nada de Google; un id mal formado revienta el armado.

**Pruebas:** 202/202; ruptura 95 de 95 (7 nuevas). copy-lint 0/0.

**Falta, y es del usuario** (cuenta de Google): crear la propiedad de GA4 y
pasar el id G-…; verificar el sitio en Search Console (token de la etiqueta
HTML) y enviar el sitemap; la ficha de Business Profile (pide una dirección o
zona de servicio; los documentos solo dan Barranquilla). Antes de activar
Analytics conviene un aviso de cookies y tratamiento de datos (Ley 1581 de 2012).
Y subir los commits para que Google vea la versión nueva.

---

## 9 de noviembre de 2026 (5) — ajustes de la página comercial y ruptura a prueba de cortes

- El usuario decidió dejar el repositorio **público**: GitHub Pages gratis no
  publica repositorios privados.
- **Bug de herramientas:** una corrida de `romper-motor.mjs` cortada a la
  fuerza dejó aplicada una ruptura en `src/webxr/disposicion.ts` (copia de
  trabajo; el commit estaba limpio). El chequeo previo lo detectó y se negó a
  correr. Ahora el motor anota el archivo y su original en
  `.romper-en-curso.json` antes de romper y, al arrancar, restaura cualquier
  nota que haya quedado. También restaura ante Ctrl+C y cierre. Probado
  matándolo con SIGKILL en plena ruptura: quedó roto `sesion.ts`; la corrida
  siguiente lo restauró y detectó 88 de 88.
- Teléfono: las imágenes de los pasos a 5:4 y la sección con altura mínima de
  dos pantallas (crece con su contenido). El espacio pasos → videos quedó
  corregido y desapareció el choque a 320 px.
- Siguen abiertos: `copy-headings` (el verificador lee en inglés) y el espacio
  hero → plataforma a 390 px (la receta del hero llena el pie de la pantalla).
- 195/195, 88 de 88; `check.mjs` sin hallazgos a 1440, 768 y 390.

---

## 9 de noviembre de 2026 (4) — página comercial de venta, bilingüe

El usuario pidió la página comercial completa de venta del servicio, con
videos de YouTube y las apps, de manera profesional, usando su skill
`design-taste-frontend` (tasteskill 2.5).

**Dónde vive.** Página estática en la raíz que publica GitHub Pages:
`sitio/index.html` (es-CO) y `sitio/en/index.html` (en). La demo jugable pasó a
`sitio/demo/` (sus enlaces al avance, a `../avance/`). No va en la app Next.js:
los scripts del kit (navegación, movimiento, momentos) tocan el DOM y chocarían
con la hidratación de React; Pages, además, es lo que hoy está publicado.

**Cómo se arma.** `comercial/plantilla.html` no tiene texto visible: son claves
`venta.*` de `mensajes/*.json` (174 claves nuevas por idioma). El armador
`tools/construir-comercial.mjs` (llamado desde `construir-previsualizacion.mjs`)
escapa el texto y revienta ante una clave o un dato que falte. Prueba nueva
`src/i18n/comercial.test.ts` (6) y 5 rupturas nuevas.

**Contenido, todo de los documentos del proyecto:** precios del modelo
financiero corregido (Piloto $450.000, Planta $1.350.000, Corporativo
$3.600.000 al mes; marca blanca $1.800.000 + 30 %; a medida USD 5.000 a
15.000); las 10 apps nativas en Unity y Unreal 5 que corren sin conexión (los
temas de la memoria del proyecto: alturas, espacios confinados, izaje, trabajo
en caliente, conducción de camiones, manejo de emociones); la matriz de riesgos
como insumo; la firma del especialista SST; el código de seis dígitos; la doble
ciega (la empresa ve la competencia, no el puntaje). Contacto: el correo del
proyecto, en `mailto:` con asunto por idioma.

**Reparto de la skill:** hero `collage` (el Portal de Empresa con vencimientos y
una ficha de certificado emitido, fragmentos `window` y `checklist` del kit
reescritos), `nav-cards` (suscripción, a medida, marca blanca), cierre
`close-word`, pie `footer-columns` (repartido otra vez: `footer-statement` en
página oscura pinta la acción principal con otro color), ritmo `surface-pairs`,
botones `tonal`, fuente Reddit Sans + JetBrains Mono, colores propios de la
marca (`start.mjs brand`: fondo #0d1217, amarillo de seguridad #f2bb1d).
Momento: `pinned-chapters` (implementación en 3 pasos). `liquid-type` se quitó:
su sección de una sola frase quedaba vacía en tableta y teléfono.

**Secciones:** hero · plataforma (matriz de riesgos → escenarios, `app-frame`
con `window` + `doc`) · simuladores (filas + muro de 4 fotos, íconos reales de
Unity y Unreal) · pasos (fotografía, captura real del visor EC-01 y del
certificado, sacadas de la demo con Chrome sin ventana) · videos (marco de
YouTube) · planes · preguntas (con la foto del Meta Quest 3 y los íconos de Meta
y Chrome) · cierre y pie.

**Videos de YouTube: falta el material del cliente.** No hay ningún video en los
documentos. El marco está listo: `comercial/videos.json`, campo `youtube`, con
el id del video; con él aparece el botón que abre el video en YouTube. Sin él
el marco muestra su póster y ningún botón muerto.

**Fotos: todas provisionales** (Wikimedia Commons, licencias libres, créditos en
`credits.html` y la línea del pie): arnés y cerchas (NIOSH), tapa de espacio
confinado, izaje con grúa, soldadura de tubería, camión minero y el Meta Quest 3.
Ninguna es del cliente; hay que reemplazarlas por fotos propias.

**Verificación (corrida aquí).**
- Node: **195/195**. Ruptura: **88 de 88**.
- copy-lint: 0 FAIL y 0 WARN en las dos versiones.
- `check.mjs` (diseño) a 1440, 1024, 820, 768 y 390: sin hallazgos.
- Compuerta de la skill: **GATE: OPEN 3** (vueltas agotadas; 36 → 9 → 3).
  Quedan: `copy-headings` (el verificador solo reconoce sustantivos de sección
  en inglés: «Preguntas sobre SAFETY VR» no le cuenta) y dos `section-gaps` a
  390 px (hero → plataforma 117 px; pasos → videos 592 px).
- Navegador integrado: es-CO y en, cambio de idioma, demo y créditos en 200,
  ninguna imagen rota, sin errores en consola.
- **No verificado:** `probar-visor.mjs` (sin Playwright aquí; ahora lee la demo
  en `sitio/demo/`) y el resultado en GitHub Actions (nada se ha subido).

**Siguiente.** Los enlaces de YouTube y las fotos reales del cliente; corregir
los dos espacios del teléfono; después, autenticación y puerta del visor.

---

## 9 de noviembre de 2026 (3) — herramientas fiables, dos bugs de la plataforma y la app Next.js

**Contexto.** Sesión nueva en otra máquina (Windows, Node 26). El repositorio
se clonó en `F:\ULTRAMEDIA COMPANY - PROYECTOS\02-SAFETY-VR\safety-vr`.
La instalación de paquetes ya funciona, así que se arrancó la app.

**Bug grave en las herramientas (no en el producto).** En esta máquina la
ruptura daba **0 de 70 detectadas** y se colgaba. Tres causas:
1. Desde Node 23, `node --test` ya no usa el reportero TAP cuando la salida no
   es una terminal. Sin `not ok`, toda ruptura parecía «en verde». Ahora se pasa
   `--test-reporter=tap` (ruptura y previsualización). Además la ruptura
   comprueba primero que cada suite intacta pasa y se lee; si no, sale con
   código 2 y no rompe nada. Esta comprobación también se rompió a propósito.
2. Git en Windows convertía los saltos de línea a CRLF y las rupturas de varias
   líneas no encontraban su fragmento. Nuevo `.gitattributes` con `eol=lf`.
3. Una ruptura de la cola («quitar el candado de sincronización») dejaba la
   suite colgada para siempre. Ahora hay un límite por prueba (20 s) y por
   proceso (120 s); un cuelgue cuenta como ruptura detectada.
En GitHub Actions (Linux, Node 22) las cifras anteriores eran ciertas.

**Bugs de la plataforma publicada** (`plataforma/plantilla.html`):
1. Si emitir el certificado fallaba (por ejemplo, sin WebCrypto), el error se
   tragaba y el trabajador que aprobó no veía ni su resultado. Ahora lo ve, con
   el aviso bilingüe `plataforma.certificado.error`.
2. Con dos pestañas abiertas, la segunda pisaba la cadena de certificados de la
   primera. Ahora se relee el almacenamiento antes de emitir y de verificar.
Las dos se verificaron en el navegador integrado y se rompieron a propósito
(reaparecieron: 1 certificado en vez de 2; «No se emite certificado» al
aprobar). Se agregaron dos comprobaciones a `probar-visor.mjs`. **No se corrió
aquí** porque no hay Playwright: lo corre GitHub Actions.

**App Next.js 15.5 + sistema de diseño bilingüe** (paso 2 del plan de obra):
- Next 15.5.29, React 19.1, TypeScript 5.9, versiones exactas. PostCSS forzada
  a 8.5.32 con `overrides` (la que trae Next 15 tiene avisos de seguridad):
  `npm audit` sin vulnerabilidades. Next 16 no, porque el contrato fija el 15.
- La plantilla estática pasó de `app/` a `plataforma/`: Next toma `app/` de la
  raíz como su carpeta de rutas.
- `src/i18n/idiomas.ts` (puro): rutas `/es-CO/…` y `/en/…`; en la raíz manda la
  cookie, después `Accept-Language` con sus pesos q, después es-CO. Cualquier
  español va a es-CO y cualquier inglés a en. Cambiar de idioma conserva la
  página, la consulta y el fragmento.
- `src/middleware.ts`: redirige las rutas sin idioma y recuerda la elección.
- `src/app/[idioma]/`: inicio (cuatro portales y acceso a la demo), `sistema`
  (colores, tipografía, botones, campo del código de seis dígitos, estados,
  tarjetas) y 404 propia de cada idioma.
- `src/componentes/`: `sistema.css` (los mismos colores y fuentes de la
  plataforma publicada; fuentes servidas por `next/font`), `piezas.tsx` y
  `navegacion.tsx` (enlace activo y selector de idioma).
- Textos: 64 claves `web.*` en los dos catálogos. Nueva prueba
  `src/i18n/textos-crudos.test.ts`: lee el árbol sintáctico de TypeScript y
  falla si un `.tsx` trae texto visible escrito a mano.
- Tipos: el chequeo de Next encontró un error de tipos real en
  `validador.ts` (Node nunca revisa tipos al quitarlos). Corregido; `tsc` sin errores.
- Bug encontrado al verificar: `dynamicParams = false` en el layout bloqueaba la
  404 propia (`NoFallbackError`). Quitado: el middleware ya garantiza el idioma.
- GitHub Actions ahora instala paquetes (`npm ci`) y compila la app (`npm run
  build`). Pages sigue publicando solo la plataforma estática: la app necesita
  un servidor (middleware), que todavía no existe.
- `construir-previsualizacion.mjs` cuenta solas todas las suites de
  `src/i18n/`; antes la lista estaba escrita a mano y dejaba fuera las nuevas.

**Verificación (corrida aquí, Node 26).**
- Node: **189/189** (antes 178; nuevas: idiomas 8, textos crudos 3).
- Ruptura: **83 de 83** (antes 70; nuevas: idiomas 9, detector 2, componentes 2).
- `tsc --noEmit`: 0 errores. `next build`: compila y genera 7 páginas.
- Navegador integrado: `/` → `/es-CO`; cambio a inglés en `/es-CO/sistema` →
  `/en/sistema` con la cookie guardada; `/` con la cookie → `/en`;
  `/sistema?x=1` → `/es-CO/sistema?x=1`; `/fr/x` → 404; 404 en inglés y en
  español con su botón de vuelta; en un teléfono (375 px) no hay desborde lateral.
- **No verificado:** `probar-visor.mjs` (sin Playwright aquí) y el resultado en
  GitHub Actions (no se ha subido nada).

**Siguiente.** Autenticación y puerta del visor con código de seis dígitos
(paso 3 del plan): lógica pura del emparejamiento primero (código, vigencia,
intentos, token de dispositivo), con sus pruebas y rupturas. Para la capa de
datos falta PostgreSQL en esta máquina (migraciones 001 y 002 sin ejecutar).

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
