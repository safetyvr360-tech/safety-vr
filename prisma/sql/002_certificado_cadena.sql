-- 002 · Certificado con hash encadenado (src/certificados/cadena.ts)
--
-- ESTADO: escrito, NO ejecutado (no hay PostgreSQL en el entorno donde se
-- escribió). Correr con node tools/aplicar-migraciones.mjs cuando exista la app,
-- y después prisma/sql/pruebas/certificado_cadena.sql.
--
-- La huella del certificado se calcula sobre: codigo, organizacion_id,
-- trabajador_id, sesion_id, sesion_huella, competencia, version_simulador,
-- emitido_el, vigente_hasta y hash_anterior. Para que un auditor pueda
-- recalcularla desde la base de datos, todos esos campos tienen que estar en la
-- tabla. Faltaban tres.

alter table certificado
  add column sesion_huella     text not null,
  add column competencia       text not null,
  add column version_simulador text not null;

-- emitido_el se fija en la aplicación (entra en la huella): sin default.
alter table certificado alter column emitido_el drop default;

-- Formatos: una huella SHA-256 en hex y el código con su forma pública.
alter table certificado
  add constraint certificado_hash_formato          check (hash ~ '^[0-9a-f]{64}$'),
  add constraint certificado_hash_anterior_formato check (hash_anterior is null or hash_anterior ~ '^[0-9a-f]{64}$'),
  add constraint certificado_sesion_huella_formato check (sesion_huella ~ '^[0-9a-f]{64}$'),
  add constraint certificado_codigo_formato        check (codigo ~ '^SVR-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$');

-- Una sola cadena por organización, sin bifurcaciones: dos emisiones
-- simultáneas no pueden colgar del mismo eslabón. La segunda falla por esta
-- restricción y la aplicación reintenta leyendo el último certificado otra vez.
create unique index certificado_un_sucesor
  on certificado (organizacion_id, coalesce(hash_anterior, ''));

-- Un certificado emitido no se edita: lo que entra en la huella queda fijo.
-- (Borrar sigue gobernado por las llaves foráneas y por RLS.)
create or replace function app.certificado_inmutable() returns trigger
language plpgsql as $$
begin
  if (new.codigo, new.organizacion_id, new.trabajador_id, new.sesion_id, new.sesion_huella,
      new.competencia, new.version_simulador, new.emitido_el, new.vigente_hasta,
      new.hash, new.hash_anterior)
     is distinct from
     (old.codigo, old.organizacion_id, old.trabajador_id, old.sesion_id, old.sesion_huella,
      old.competencia, old.version_simulador, old.emitido_el, old.vigente_hasta,
      old.hash, old.hash_anterior)
  then
    raise exception 'certificado_inmutable: el certificado % no se puede modificar', old.codigo
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger certificado_inmutable
  before update on certificado
  for each row execute function app.certificado_inmutable();
