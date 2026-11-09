---
name: continuar
description: Retoma el desarrollo de SAFETY VR con el método del proyecto (bitácora, respaldo, búsqueda de bugs, siguiente tarea, ruptura, vista previa). Úsela cuando el usuario diga "continúa", "sigue" o pida avanzar el proyecto.
---

# Continuar SAFETY VR

Siga estos pasos en orden. Responda siempre en español, de «usted».

1. **Leer el estado.** Lea `docs/05-estado.md` (la entrada de arriba es la más
   reciente) y su sección «Siguiente». Si el usuario nombró otra tarea, esa manda.
2. **Respaldo.** Confirme que el árbol de trabajo está limpio (`git status`).
   Si hay cambios sin guardar, haga primero un commit de respaldo o un .zip en
   `respaldos/`, y dígale al usuario dónde quedó.
3. **Buscar bugs en lo último que se hizo** antes de avanzar. Cada bug
   encontrado: prueba que lo reproduce → corrección → ruptura (vuelva a la
   versión anterior y compruebe que la prueba nueva falla) → restaurar.
4. **Avanzar la siguiente tarea** respetando las 6 directivas de `CLAUDE.md`.
   Lógica pura en `src/`, con su `*.test.ts` al lado. Textos visibles solo en
   `mensajes/*.json`.
5. **Verificar:**
   - `npm test` en verde.
   - Agregue las rupturas del código nuevo en `tools/romper-motor.mjs` y corra
     `npm run romper` (skill `/romper`). Si una ruptura deja la suite en verde,
     el hallazgo es la prueba: complétela.
   - `npm run previsualizacion` y, si hay Playwright, `npm run probar-visor`.
6. **Bitácora.** Agregue arriba en `docs/05-estado.md` una entrada con fecha:
   qué se hizo, bugs encontrados, cifras reales de pruebas y rupturas (corridas,
   no estimadas), lo que no se pudo verificar y el siguiente paso. Actualice
   las cifras de `LEEME.md`.
7. **Vista previa.** Muestre cómo va todo: la plataforma en `sitio/index.html`
   y el avance en `sitio/avance/index.html` (o la demo publicada si ya subió).
8. **Cierre.** Resumen corto para el usuario: qué cambió, qué verificó, qué no
   pudo verificar y cuál es el siguiente paso. Pregunte antes de publicar si el
   usuario no lo pidió (skill `/publicar`).
