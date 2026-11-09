---
name: publicar
description: Sube los cambios de SAFETY VR a GitHub y verifica que GitHub Actions pase y que la plataforma publicada se vea bien. Úsela cuando el usuario pida subir, publicar o actualizar la demo.
disable-model-invocation: true
---

# Publicar SAFETY VR

1. **Antes de subir:** `npm test`, `npm run romper` y
   `npm run previsualizacion` en verde. Nunca se sube con algo en rojo.
2. **Respaldo:** el estado actual de `main` en GitHub ya es el respaldo; anote
   su commit (`git log -1 --oneline origin/main`) en la bitácora.
3. **Commit** con un mensaje en español que diga qué cambia para el usuario,
   en `main`, y `git push origin main`.
4. **GitHub Actions:** espere el flujo «Verificar y publicar» en
   https://github.com/safetyvr360-tech/safety-vr/actions (con `gh run watch`
   si está la CLI de GitHub). Tarda alrededor de un minuto y medio.
   - Si falla con «Internal server error» sin arrancar ningún trabajo, es de
     GitHub: relance con un commit nuevo. Ya pasó una vez con el primer commit.
   - Si falla una prueba, corríjala localmente; no suba arreglos a ciegas.
5. **Verifique la página publicada:** https://safetyvr360-tech.github.io/safety-vr/
   debe mostrar la plataforma (portada, capacitación EC-01, verificación de
   certificados) y `/avance/` el estado del proyecto.
6. **Bitácora:** anote en `docs/05-estado.md` el commit publicado y el
   resultado de Actions. Dígale al usuario la dirección y qué cambió.

Lo que nunca se sube: secretos, `.env`, `node_modules/`, `sitio/` (lo genera
Actions) ni los documentos de negocio de `F:\...\02-SAFETY-VR` (modelo
financiero, contrato).
