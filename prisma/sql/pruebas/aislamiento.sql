-- SAFETY VR — pruebas de intrusión entre organizaciones.
-- Casos positivos (lo que SÍ se debe ver) y negativos (lo que JAMÁS).
-- Corre como app_rol, que no es superusuario: la RLS sí le aplica.

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ------------------------------------------------------------------ semilla
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_rol') then
    create role app_rol nologin;
  end if;
end $$;
grant usage on schema app, public to app_rol;
grant select, insert, update, delete on all tables in schema public to app_rol;
grant usage, select on all sequences in schema public to app_rol;
grant execute on all functions in schema app to app_rol;

truncate organizacion, usuario, simulador, bitacora restart identity cascade;

insert into organizacion (id, tipo, ruta, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'distribuidor', 'consultoria',             'Consultoría SST del Caribe'),
  ('22222222-2222-2222-2222-222222222222', 'empresa',      'consultoria.metalurgica', 'Metalúrgica del Caribe'),
  ('33333333-3333-3333-3333-333333333333', 'empresa',      'consultoria.portuaria',   'Portuaria del Atlántico'),
  ('44444444-4444-4444-4444-444444444444', 'empresa',      'quimica',                 'Química del Norte');

insert into sede (id, organizacion_id, nombre) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Malambo'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Soledad');

insert into trabajador (id, organizacion_id, documento, nombre, cargo) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'CC104', 'J. Villa',   'Operario'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'CC723', 'R. Mendoza', 'Montacarguista'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'CC551', 'A. Pérez',   'Mantenimiento');

insert into simulador (id, codigo, nombre, riesgo) values
  ('cccccccc-0000-0000-0000-000000000001', 'EC-01', 'Ingreso a espacio confinado', 'espacios_confinados');
insert into version_simulador (id, simulador_id, version, entrega, estado) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '3.2.0', 'webxr', 'publicada');

insert into sesion (id, organizacion_id, trabajador_id, version_id, puntaje, veredicto) values
  ('eeeeeeee-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 89, 'apto');

insert into grabacion_sesion (sesion_id, trabajador_id, telemetria) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   '{"mirada": [[0.1,0.2]], "pulso": [88,92]}'::jsonb);

-- ------------------------------------------------------------------ utilería
create or replace function app.exigir(cond boolean, titulo text) returns void
  language plpgsql as $$
  begin
    if cond then raise notice 'ok    %', titulo;
    else raise exception 'FALLA %', titulo;
    end if;
  end $$;

create or replace procedure app.como_empresa(r text) language sql as $$
  select set_config('app.ruta_actual', r, true),
         set_config('app.trabajador_actual', '', true),
         set_config('app.es_operacion', 'off', true);
$$;

create or replace procedure app.como_trabajador(t text) language sql as $$
  select set_config('app.ruta_actual', '', true),
         set_config('app.trabajador_actual', t, true),
         set_config('app.es_operacion', 'off', true);
$$;

create or replace procedure app.como_operacion() language sql as $$
  select set_config('app.ruta_actual', '', true),
         set_config('app.trabajador_actual', '', true),
         set_config('app.es_operacion', 'on', true);
$$;

-- ------------------------------------------------------------------ pruebas
-- Una transacción, un contexto: igual que una petición en producción.
begin;
set local role app_rol;

-- POSITIVO: la empresa ve a sus propios trabajadores.
call app.como_empresa('consultoria.metalurgica');
select app.exigir((select count(*) from trabajador) = 1, 'la empresa ve solo su trabajador');
select app.exigir(exists (select 1 from trabajador where documento = 'CC104'),
  'la empresa ve a J. Villa, que es suyo');

-- NEGATIVO: no ve a los de la otra empresa del mismo distribuidor.
select app.exigir(not exists (select 1 from trabajador where documento = 'CC723'),
  'la empresa NO ve al trabajador de la empresa hermana');

-- NEGATIVO: no ve a los de una organización ajena al árbol.
select app.exigir(not exists (select 1 from trabajador where documento = 'CC551'),
  'la empresa NO ve al trabajador de otra organización');

-- NEGATIVO, ADR-001: la empresa jamás ve la telemetría cruda de su trabajador.
select app.exigir((select count(*) from grabacion_sesion) = 0,
  'la empresa NO ve la telemetria cruda de su propio trabajador');

-- POSITIVO: pero sí ve el veredicto de la sesión.
select app.exigir((select veredicto from sesion limit 1) = 'apto',
  'la empresa SI ve el veredicto de aptitud');

-- POSITIVO: el distribuidor ve la estructura de sus empresas cliente.
call app.como_empresa('consultoria');
select app.exigir((select count(*) from organizacion) = 3,
  'el distribuidor ve sus tres organizaciones del arbol');
select app.exigir((select count(*) from sede) = 1,
  'el distribuidor ve la sede de su empresa cliente');

-- NEGATIVO, ADR-001: el distribuidor NO ve la PII de esos trabajadores.
select app.exigir((select count(*) from trabajador) = 0,
  'el distribuidor NO ve ningun trabajador de sus empresas cliente');
select app.exigir((select count(*) from sesion) = 0,
  'el distribuidor NO ve las sesiones de sus empresas cliente');

-- NEGATIVO: una organización ajena no ve nada del árbol de la consultoría.
call app.como_empresa('quimica');
select app.exigir((select count(*) from organizacion) = 1,
  'la organizacion ajena solo se ve a si misma');
select app.exigir((select count(*) from trabajador) = 1,
  'la organizacion ajena solo ve su propio trabajador');

-- POSITIVO: el trabajador ve lo suyo, incluida su grabación.
call app.como_trabajador('bbbbbbbb-0000-0000-0000-000000000001');
select app.exigir((select count(*) from grabacion_sesion) = 1,
  'el trabajador SI ve su propia grabacion');
select app.exigir((select count(*) from sesion) = 1, 'el trabajador ve su sesion');

-- NEGATIVO: y nada de nadie más.
select app.exigir((select count(*) from trabajador) = 1,
  'el trabajador solo se ve a si mismo');
select app.exigir(not exists (select 1 from trabajador where documento = 'CC723'),
  'el trabajador NO ve a otros trabajadores');

-- NEGATIVO: sin contexto no se ve absolutamente nada.
call app.como_empresa('');
select app.exigir((select count(*) from organizacion) = 0, 'sin contexto no se ve ninguna organizacion');
select app.exigir((select count(*) from trabajador) = 0, 'sin contexto no se ve ningun trabajador');
select app.exigir((select count(*) from sesion) = 0, 'sin contexto no se ve ninguna sesion');

-- POSITIVO: el catálogo lo lee cualquiera.
select app.exigir((select count(*) from simulador) = 1, 'el catalogo se lee sin contexto');

-- NEGATIVO: pero no lo escribe cualquiera.
do $$ begin
  begin
    insert into simulador (codigo, nombre, riesgo) values ('XX-99', 'Intruso', 'nada');
    raise exception 'FALLA una empresa pudo escribir en el catalogo';
  exception when insufficient_privilege then
    raise notice 'ok    una empresa NO puede escribir en el catalogo';
  end;
end $$;

-- NEGATIVO: no se puede sembrar una fila en el árbol de otro.
call app.como_empresa('consultoria.metalurgica');
do $$
declare bloqueado boolean := false;
begin
  begin
    insert into trabajador (organizacion_id, documento, nombre, cargo)
      values ('44444444-4444-4444-4444-444444444444', 'CC999', 'Infiltrado', 'Operario');
  exception when insufficient_privilege or raise_exception then
    bloqueado := true;
  end;
  if not bloqueado then
    raise exception 'FALLA se pudo insertar un trabajador en otra organizacion';
  end if;
  raise notice 'ok    NO se puede insertar un trabajador en otra organizacion';
end $$;

call app.como_operacion();
select app.exigir((select count(*) from trabajador where documento = 'CC999') = 0,
  'el intento de infiltracion no dejo ninguna fila escrita');
call app.como_empresa('consultoria.metalurgica');

-- POSITIVO: Operación lo ve todo, que es su razón de ser.
call app.como_operacion();
select app.exigir((select count(*) from trabajador) = 3, 'operacion ve los tres trabajadores');
select app.exigir((select count(*) from grabacion_sesion) = 1, 'operacion ve la grabacion');

commit;

-- ------------------------------- toda tabla debe tener al menos una política
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
  if faltan is not null then
    raise exception 'FALLA tablas sin politica RLS: %', faltan;
  end if;
  raise notice 'ok    toda tabla tiene politica RLS';
end $$;

do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not (c.relrowsecurity and c.relforcerowsecurity);
  if faltan is not null then
    raise exception 'FALLA tablas sin ENABLE+FORCE RLS: %', faltan;
  end if;
  raise notice 'ok    toda tabla tiene ENABLE + FORCE row level security';
end $$;
