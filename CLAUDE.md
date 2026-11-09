# SAFETY VR — instrucciones para Claude Code

SAFETY VR es una de las tres plataformas de la holding ULTRAMEDIA COMPANY:
simuladores de realidad virtual para seguridad industrial (SST) por
suscripción, con cuatro portales (Trabajador, Empresa/HSE, Proveedor SST y
Operación). Este repositorio es el MVP.

- Repositorio: https://github.com/safetyvr360-tech/safety-vr
- Página comercial publicada: https://safetyvr360-tech.github.io/safety-vr/ (inglés en /en/)
- Demo jugable: https://safetyvr360-tech.github.io/safety-vr/demo/
- Estado del proyecto: https://safetyvr360-tech.github.io/safety-vr/avance/
- Documentos de negocio y backup histórico (fuera del repositorio):
  `F:\ULTRAMEDIA COMPANY - PROYECTOS\02-SAFETY-VR`

## Cómo trabajar con el usuario

- Responder siempre en español. Tratar al usuario de «usted».
- Antes de cambiar algo, hacer un respaldo (un commit limpio o un .zip en
  `respaldos/`) por si algo sale mal, y entregar todo lo producido.
- Al terminar cada acción, mostrar una vista previa de cómo va todo
  (`npm run previsualizacion` y la página en `sitio/`, o la demo publicada).
- Hacer una sola pregunta por vez cuando haga falta aclarar algo.
- Al iniciar, leer `docs/05-estado.md` (bitácora). Al terminar, agregar arriba
  la entrada de la sesión.

## Las 6 directivas del contrato técnico (obligatorias)

1. **Doble ciega.** Nunca exponer juntos los dos lados del precio fuera del
   portal de Operación. En SAFETY VR también aplica al desempeño: la empresa
   y los terceros ven la competencia certificada, no el puntaje ni las
   respuestas; la telemetría identifica al trabajador con una cuenta, nunca con
   nombre ni correo (ADR-001).
2. **RLS obligatorio en PostgreSQL.** Toda tabla nueva lleva `@@map` en
   snake_case, `ENABLE` + `FORCE ROW LEVEL SECURITY`, política explícita, casos
   positivos **y negativos** en `prisma/sql/pruebas/aislamiento.sql` y la prueba
   de integración en verde. Prohibido aplicar migraciones a mano: siempre
   `node tools/aplicar-migraciones.mjs`.
3. **Método de Ruptura.** Ninguna tarea está terminada solo porque las pruebas
   pasen: hay que romper la implementación a propósito, ver fallar la prueba
   correcta y restaurar (skill `/romper`).
4. **Bilingüe nativo** es-CO (de «usted») e inglés, de primera clase. Ningún
   texto visible en el código: todo en `mensajes/es-CO.json` y
   `mensajes/en.json`; `src/i18n/catalogo.test.ts` lo vigila.
5. **Runtime puro Node 22** (`--experimental-strip-types`): imports con `.ts`
   explícito, `import type` para tipos, sin `enum` y sin propiedades de
   parámetro en constructores. Sin dependencias innecesarias.
6. **Máquina de estados y bitácora atómica.** Toda transición de estado y su
   registro van en la misma transacción SQL, y desde todo estado vivo se
   alcanza un estado final.

## Comandos

```bash
npm test                  # todas las pruebas (node --test, sin dependencias)
npm run romper            # Método de Ruptura automático (tools/romper-motor.mjs)
npm run previsualizacion  # arma sitio/ (plataforma + /avance/) y previsualizacion/index.html
npm run probar-visor      # prueba en navegador real (necesita Playwright)
npm run dev               # app Next.js en local (antes: npm install)
npm run build             # compila la app y revisa los tipos
```

Cada push a `main` corre todo en GitHub Actions y publica `sitio/` en GitHub
Pages. Mapa del código: `LEEME.md`.

## Siguiente en el plan

App Next.js con sistema de diseño bilingüe (hecha: `src/app/`); autenticación y puerta del visor
con código de seis dígitos; portal de Empresa; LRS propio y punto de
sincronización (upsert por id); correr las migraciones 001 y 002 en
PostgreSQL; probar el modo RV en un Meta Quest; fotos 360° reales de EC-01.
