---
name: romper
description: Aplica el Método de Ruptura de SAFETY VR (directiva 3) al código nuevo o corregido. Úsela antes de dar por terminada cualquier tarea de código.
---

# Método de Ruptura

Una tarea no está terminada porque `npm test` pase. Hay que demostrar que las
pruebas detectan el daño.

## Cómo

1. Por cada regla importante del código nuevo, piense en una ruptura: un
   cambio pequeño que la viola (quitar una validación, invertir una condición,
   cambiar un límite, filtrar un dato que no debe salir).
2. Agréguela a `tools/romper-motor.mjs`, en el grupo del archivo
   correspondiente (o cree el grupo con su `archivo` y su `prueba`):

   ```js
   ['nombre en español', 'name in English', 'texto exacto que existe', 'texto que lo reemplaza'],
   ```

   El texto a buscar debe aparecer **una sola vez** en el archivo; si se repite,
   amplíelo con el contexto vecino (si no, la ruptura pega en otro lugar).
3. Corra `npm run romper`. Cada línea debe salir `ok` con la prueba que falló.
   - `XX ... la suite siguió en verde`: falta una prueba. Escríbala y repita.
   - `?? ... el fragmento ya no existe`: el código cambió; actualice la ruptura.
4. Confirme que los archivos quedaron intactos (`git diff` vacío en `src/`):
   el script restaura siempre, pero verifíquelo.
5. Para un bug corregido sin ruptura en el script: vuelva temporalmente a la
   versión anterior del archivo (`git stash` o `git show HEAD:archivo`), corra
   la prueba nueva, compruebe que falla y restaure.

Informe el resultado con cifras reales: «N de N rupturas detectadas».
