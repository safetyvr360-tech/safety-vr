# SAFETY VR

Capacitación en seguridad industrial con realidad virtual, de **ULTRAMEDIA COMPANY**.
El trabajador practica una tarea de alto riesgo en una escena 360°, toma
decisiones, recibe la consecuencia real de cada error y, si aprueba, obtiene un
certificado verificable por cualquiera.

> *English summary below.*

## Qué hay en este MVP

| Pieza | Qué hace |
| --- | --- |
| Motor de escenarios | Interpreta el escenario como un grafo de decisiones con rúbrica, criterios críticos, requisitos y tiempo límite. |
| Validador | Tres compuertas automáticas antes de publicar un escenario (estructura, ruta correcta, idiomas). |
| Visor 360° | WebGL 2 sin dependencias. Modo pantalla (PC y teléfono) y modo realidad virtual (WebXR, p. ej. Meta Quest). Quitarse el visor pausa. |
| Telemetría | Registros xAPI 1.0.3, paquete de sesión firmado y cola que funciona sin conexión. Sin datos personales del trabajador. |
| Certificados | Hash encadenado, código `SVR-XXXX-XXXX-XXXX` con dígito de control, vigencia y verificación pública. |
| Base de datos | Esquema PostgreSQL con aislamiento por organización (RLS). |
| Idiomas | Español de Colombia e inglés en toda la interfaz. |

Escenario de referencia: **EC-01, ingreso a espacio confinado** (permiso,
medición de gases, vigía, arnés y reacción ante alarma de H2S).

## Probarlo

Requiere Node 22.6 o superior. No hay dependencias que instalar.

```bash
npm test                 # todas las pruebas
npm run romper           # Método de Ruptura: daña el código a propósito y exige que falle la prueba correcta
npm run previsualizacion # genera previsualizacion/index.html: ábralo en el navegador
```

La prueba del visor en navegador real (`npm run probar-visor`) necesita
Playwright: `npm install --no-save playwright && npx playwright install chromium`.

Cada push corre todo esto en GitHub Actions. En la rama `main`, si todo pasa, el
sitio se publica en GitHub Pages:

- **Plataforma:** https://safetyvr360-tech.github.io/safety-vr/ — la capacitación
  EC-01 en pantalla o en realidad virtual (ábrala en el navegador del Meta Quest),
  el resultado, el certificado y su verificación pública.
- **Estado del proyecto:** https://safetyvr360-tech.github.io/safety-vr/avance/ —
  pruebas, rupturas, plan de obra y la demo técnica.

`npm run previsualizacion` arma las dos páginas en `sitio/` (`plataforma/plantilla.html`
es la plataforma; `previsualizacion/plantilla.html`, el avance).

## Estado

Ver [`LEEME.md`](LEEME.md) (mapa del código) y
[`docs/05-estado.md`](docs/05-estado.md) (bitácora de cada sesión de trabajo).

Pendiente: probar en un visor real, fotos 360° de los entornos, autenticación y
puerta del visor, portal de empresa, servidor de sincronización (LRS) y ejecutar las migraciones
en PostgreSQL.

---

## English summary

**SAFETY VR** is VR-based industrial safety training by ULTRAMEDIA COMPANY.
This MVP contains the scenario engine and validator, a dependency-free WebGL 2
360° viewer with screen and WebXR modes, offline-first xAPI telemetry with
signed session packages, hash-chained certificates with public verification,
and a PostgreSQL schema with per-organization row-level security. The UI is
fully bilingual (es-CO / en).

Run `npm test` (Node 22.6+, no dependencies). On every push, GitHub Actions
runs the tests, the breakage method and a real-browser test, and deploys the
platform to https://safetyvr360-tech.github.io/safety-vr/ (project status at
`/avance/`).

© ULTRAMEDIA COMPANY. Todos los derechos reservados. All rights reserved.
