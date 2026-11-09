-- SAFETY VR — pruebas de la migración 002 (certificado con hash encadenado).
-- ESTADO: escritas, NO ejecutadas. Correr después de aislamiento.sql (usa su
-- semilla y su utilería app.exigir), como superusuario de pruebas: aquí se
-- prueban restricciones e invariantes de la tabla, no la RLS.

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Huellas de ejemplo con el formato correcto (64 hex).
\set h1 '''1111111111111111111111111111111111111111111111111111111111111111'''
\set h2 '''2222222222222222222222222222222222222222222222222222222222222222'''
\set h3 '''3333333333333333333333333333333333333333333333333333333333333333'''
\set hs '''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''

insert into certificado (organizacion_id, trabajador_id, sesion_id, codigo, emitido_el, vigente_hasta,
                         hash, hash_anterior, sesion_huella, competencia, version_simulador)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001',
        'eeeeeeee-0000-0000-0000-000000000001', 'SVR-0000-0000-0000', '2026-11-08T18:00:00Z', '2027-11-08',
        :h1, null, :hs, 'EC-01', 'EC-01@3.2.0');

-- positivo: el segundo eslabón cuelga del primero
insert into certificado (organizacion_id, trabajador_id, sesion_id, codigo, emitido_el, vigente_hasta,
                         hash, hash_anterior, sesion_huella, competencia, version_simulador)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001',
        'eeeeeeee-0000-0000-0000-000000000001', 'SVR-0000-0000-0011', '2026-11-08T18:01:00Z', '2027-11-08',
        :h2, :h1, :hs, 'EC-01', 'EC-01@3.2.0');
select app.exigir((select count(*) from certificado) = 2, 'se encadenan dos certificados');

-- negativo: bifurcación (otro certificado colgando del mismo eslabón)
do $$ begin
  insert into certificado (organizacion_id, trabajador_id, sesion_id, codigo, emitido_el, vigente_hasta,
                           hash, hash_anterior, sesion_huella, competencia, version_simulador)
  values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001',
          'eeeeeeee-0000-0000-0000-000000000001', 'SVR-0000-0000-0022', now(), '2027-11-08',
          repeat('3', 64), repeat('1', 64), repeat('a', 64), 'EC-01', 'EC-01@3.2.0');
  raise exception 'FALLA se permitió bifurcar la cadena';
exception when unique_violation then raise notice 'ok    no se puede bifurcar la cadena';
end $$;

-- negativo: dos comienzos de cadena en la misma organización
do $$ begin
  insert into certificado (organizacion_id, trabajador_id, sesion_id, codigo, emitido_el, vigente_hasta,
                           hash, hash_anterior, sesion_huella, competencia, version_simulador)
  values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001',
          'eeeeeeee-0000-0000-0000-000000000001', 'SVR-0000-0000-0033', now(), '2027-11-08',
          repeat('4', 64), null, repeat('a', 64), 'EC-01', 'EC-01@3.2.0');
  raise exception 'FALLA se permitieron dos comienzos de cadena';
exception when unique_violation then raise notice 'ok    una sola cadena por organización';
end $$;

-- negativo: editar un certificado emitido
do $$ begin
  update certificado set vigente_hasta = '2035-01-01' where codigo = 'SVR-0000-0000-0000';
  raise exception 'FALLA se permitió alargar la vigencia';
exception when check_violation then raise notice 'ok    un certificado emitido no se edita';
end $$;

-- negativo: huella con formato inválido
do $$ begin
  insert into certificado (organizacion_id, trabajador_id, sesion_id, codigo, emitido_el, vigente_hasta,
                           hash, hash_anterior, sesion_huella, competencia, version_simulador)
  values ('44444444-4444-4444-4444-444444444444', 'bbbbbbbb-0000-0000-0000-000000000003',
          'eeeeeeee-0000-0000-0000-000000000001', 'SVR-0000-0000-0044', now(), '2027-11-08',
          'no-es-una-huella', null, repeat('a', 64), 'EC-01', 'EC-01@3.2.0');
  raise exception 'FALLA se aceptó una huella mal formada';
exception when check_violation then raise notice 'ok    la huella debe ser SHA-256 en hex';
end $$;

-- negativo: código con letras fuera del alfabeto (U)
do $$ begin
  insert into certificado (organizacion_id, trabajador_id, sesion_id, codigo, emitido_el, vigente_hasta,
                           hash, hash_anterior, sesion_huella, competencia, version_simulador)
  values ('44444444-4444-4444-4444-444444444444', 'bbbbbbbb-0000-0000-0000-000000000003',
          'eeeeeeee-0000-0000-0000-000000000001', 'SVR-UUUU-0000-0000', now(), '2027-11-08',
          repeat('5', 64), null, repeat('a', 64), 'EC-01', 'EC-01@3.2.0');
  raise exception 'FALLA se aceptó un código con letras confundibles';
exception when check_violation then raise notice 'ok    el código respeta el alfabeto';
end $$;
