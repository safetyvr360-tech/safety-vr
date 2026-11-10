# Código ejecutable de Safety VR

Node 22. El simulador (motor, visor, telemetría, certificados) no tiene
dependencias; la app web usa Next.js 15 (`npm install` antes de `npm run dev`). Bitácora de sesiones: `docs/05-estado.md` (léala al
empezar, actualícela al terminar).

## Pruebas

```
node --experimental-strip-types --test src/*/*.test.ts
node tools/romper-motor.mjs
node tools/construir-previsualizacion.mjs && node tools/probar-visor.mjs   # necesita Playwright
```

Al 10 de noviembre de 2026: **222/222 en verde, 126 de 126 rupturas detectadas.**
El navegador: 27 de 27 comprobaciones la última vez que corrió; ahora son 29
(dos nuevas de la plataforma), pendientes de correr en GitHub Actions.

## Página comercial (la raíz publicada)

- `src/negocio/precios.ts`, `modelo.ts` — la única fuente de precios (COP y USD) y de las cifras del año 1; las pruebas exigen las del modelo financiero
- `comercial/inversion.html` — la página para inversionistas (`/inversion/`, `/en/investors/`)
- `comercial/plantilla.html` — la página de venta; sus textos son claves `venta.*` de `mensajes/*.json`
- `tools/construir-comercial.mjs` — la arma en `sitio/` (es-CO) y `sitio/en/` (en); una clave que falta revienta el armado
- `comercial/assets/` — el subconjunto del kit de diseño (design-taste-frontend), íconos reales y fotos
- `tools/seo-comercial.mjs` — canónica, hreflang, JSON-LD (servicio, planes, preguntas) y sitemap.xml
- `comercial/sitio.json` — ids de Google Analytics y Search Console (`null`: no se carga nada)
- `comercial/movil.css` — la capa móvil (sin destello al tocar, toque inmediato, hover que no se pega)
- `comercial/comun.css` y `comercial/navegacion.js` — detalles comunes de las dos páginas (botón secundario con borde, menú que marca la sección visible)
- `comercial/videos.json` — el id de YouTube del video del cliente (`null`: el marco queda con su póster y sin botón)
- `src/i18n/comercial.test.ts` — claves en los dos catálogos, sin texto crudo, texto escapado
- La demo jugable quedó en `sitio/demo/`; el avance, en `sitio/avance/`

## App web (Next.js 15, App Router)

```
npm install
npm run dev      # o: npm run build && npm run start
```

- `src/i18n/idiomas.ts` — idioma por ruta (/es-CO, /en), cookie y Accept-Language (puro, probado)
- `src/middleware.ts` — redirige las rutas sin idioma y recuerda la elección
- `src/app/[idioma]/` — inicio, `sistema` (sistema de diseño) y 404 de cada idioma
- `src/app/textos.ts` — textos desde `mensajes/*.json` con la misma `traducir` del simulador
- `src/componentes/` — `sistema.css` (colores y fuentes), `piezas.tsx`, `navegacion.tsx`
- `src/i18n/textos-crudos.test.ts` — falla si un .tsx trae texto visible escrito a mano

## Validador de escenarios (compuertas 1, 2 y 3 — ADR-005)

- `src/escenario/tipos.ts` — el contrato `safetyvr/escenario@1`
- `src/escenario/validador.ts` — las tres compuertas automáticas y la fachada
- `src/escenario/ejemplos/ec-01.ts` — escenario de referencia (espacio confinado)
- `src/escenario/validador.test.ts` — pruebas de ruptura

## Motor (intérprete puro del grafo)

- `src/motor/maquina.ts` — `crearMaquina(doc)` con `iniciar`, `estadoActual`,
  `ejecutar`, `agotarTiempo` y `abandonar`. Sin WebXR, DOM ni reloj: el
  adaptador WebXR se monta encima.
- `src/motor/maquina.test.ts` — pruebas de ruptura
- `src/motor/sesion.ts` — el motor con reloj inyectado: plazo por nodo, pausa
  al quitarse el visor, eventos fechados para xAPI
- `src/motor/presentador.ts` — la vista que dibuja el visor, en es-CO o en,
  con textos de `mensajes/*.json`
- `tools/romper-motor.mjs` — Método de Ruptura automático sobre motor,
  sesión, presentador, visor (partes puras) y catálogos

## Visor 360° (WebGL 2 directo, sin dependencias)

- `src/webxr/matematica.ts` — matrices, proyección y rayos (pura, probada)
- `src/webxr/disposicion.ts` — paneles, impacto del rayo, texto y operaciones
  de dibujo (pura, probada)
- `src/webxr/dibujo.ts` — WebGL: panorama equirrectangular y paneles
- `src/webxr/visor.ts` — `crearVisor({ canvas, doc, catalogos, idioma })`:
  modo pantalla y modo realidad virtual (WebXR immersive-vr)
- `tools/probar-visor.mjs` — recorre EC-01 en Chromium haciendo clic sobre los
  paneles 3D. El modo RV solo se verifica en un visor real.

## Telemetría (ADR-002, canal de evidencia)

- `src/telemetria/uuidv7.ts` — id de sesión generado en el visor
- `src/telemetria/firma.ts` — JSON canónico y firma HMAC-SHA256 (WebCrypto)
- `src/telemetria/xapi.ts` — statements xAPI 1.0.3 desde los eventos de la
  sesión; actor sin datos personales (ADR-001)
- `src/telemetria/cola.ts` — paquete firmado y cola offline idempotente con
  reintentos; almacenamiento y envío inyectados

## Certificados (hash encadenado y verificación pública)

- `src/certificados/codigo.ts` — código `SVR-XXXX-XXXX-XXXX` con dígito de control
- `src/certificados/vigencia.ts` — vigencia en fechas de Colombia: vigente, por vencer, vencido
- `src/certificados/cadena.ts` — emisión desde una sesión apta y verificación de la cadena
- `src/certificados/verificacion.ts` — verificación pública por código, bilingüe, sin puntaje
- `prisma/sql/002_certificado_cadena.sql` + `pruebas/certificado_cadena.sql` —
  **escritos, no ejecutados** (falta PostgreSQL)

## Catálogos de idioma

- `mensajes/es-CO.json`, `mensajes/en.json` — textos de interfaz del simulador
- `src/i18n/catalogo.test.ts` — mismas claves, mismas variables, trato de usted

## Previsualización

```
node tools/construir-previsualizacion.mjs
```

Genera `previsualizacion/index.html` (abrir en el navegador): el visor 360°
real jugando EC-01 y el estado de obra. Se niega a generarla si hay una prueba en
rojo o una ruptura sin detectar.

## Cimientos de base de datos

- `prisma/sql/001_politicas.sql` — esquema, disparador de ruta y políticas RLS
- `prisma/sql/pruebas/aislamiento.sql` — pruebas de intrusión entre organizaciones

PostgreSQL 16 con `ltree`. Las pruebas corren como `app_rol`, que no es
superusuario. **No verificado en esta máquina** (no hay PostgreSQL); estado
reportado: 27 aserciones en verde. Recuerde: migraciones solo con
`node tools/aplicar-migraciones.mjs` cuando exista la app.

## La regla que no se negocia

Tabla nueva ⇒ `@@map` en `snake_case`, `ENABLE` + `FORCE ROW LEVEL SECURITY`,
política explícita, casos positivos **y negativos** en `aislamiento.sql`, y la
prueba de integración en verde.
