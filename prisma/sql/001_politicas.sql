-- SAFETY VR — esquema de cimientos y Row Level Security jerárquica.
-- El aislamiento lo hace PostgreSQL, no un WHERE en la aplicación.

create extension if not exists ltree;
create schema if not exists app;

-- ---------------------------------------------------------------- contexto
-- Tres planos de permisos. La conexión fija solo lo que corresponde al actor.
create or replace function app.ruta_actual() returns ltree
  language sql stable as $$
    select nullif(current_setting('app.ruta_actual', true), '')::ltree
  $$;

create or replace function app.trabajador_actual() returns uuid
  language sql stable as $$
    select nullif(current_setting('app.trabajador_actual', true), '')::uuid
  $$;

create or replace function app.es_operacion() returns boolean
  language sql stable as $$
    select coalesce(nullif(current_setting('app.es_operacion', true), ''), 'off') = 'on'
  $$;

-- Dos alcances distintos, y la diferencia es ADR-001.
-- El subárbol es para lo ESTRUCTURAL: un distribuidor ve las organizaciones,
-- sedes y cuadrillas de sus empresas cliente.
create or replace function app.en_mi_arbol(fila ltree) returns boolean
  language sql stable as $$
    select app.ruta_actual() is not null and fila operator(public.<@) app.ruta_actual()
  $$;

-- La coincidencia exacta es para lo PERSONAL: trabajadores, sesiones y
-- certificados los ve la empresa dueña y nadie más por encima de ella.
-- Un distribuidor jamás ve la PII de los trabajadores de sus clientes.
create or replace function app.es_mi_organizacion(fila ltree) returns boolean
  language sql stable as $$
    select app.ruta_actual() is not null and fila operator(public.=) app.ruta_actual()
  $$;

-- ---------------------------------------------------------------- tablas
create table organizacion (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 text not null check (tipo in ('distribuidor', 'empresa')),
  ruta                 ltree not null unique,
  nombre               text not null,
  plan                 text not null default 'piloto',
  moneda               text not null default 'COP',
  idioma               text not null default 'es-CO',
  asientos_contratados integer not null default 15,
  creada_en            timestamptz not null default now()
);

create table usuario (
  id     uuid primary key default gen_random_uuid(),
  correo text not null unique,
  nombre text not null
);

create table membresia (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references usuario(id) on delete cascade,
  organizacion_id uuid not null references organizacion(id) on delete cascade,
  ruta            ltree not null,
  rol             text not null check (rol in ('admin', 'sst', 'instructor', 'lectura')),
  unique (usuario_id, organizacion_id)
);

create table sede (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion(id) on delete cascade,
  ruta            ltree not null,
  nombre          text not null
);

create table cuadrilla (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion(id) on delete cascade,
  sede_id         uuid not null references sede(id) on delete cascade,
  ruta            ltree not null,
  nombre          text not null
);

create table trabajador (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion(id) on delete cascade,
  cuadrilla_id    uuid references cuadrilla(id) on delete set null,
  ruta            ltree not null,
  documento       text not null,
  nombre          text not null,
  cargo           text not null,
  unique (organizacion_id, documento)
);

-- Catálogo: es de Safety VR, no de ninguna organización.
create table simulador (
  id     uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  riesgo text not null
);

create table version_simulador (
  id             uuid primary key default gen_random_uuid(),
  simulador_id   uuid not null references simulador(id) on delete cascade,
  version        text not null,
  entrega        text not null check (entrega in ('webxr', 'nativo_instalado')),
  estado         text not null default 'borrador' check (estado in ('borrador', 'publicada', 'retirada')),
  validado_por   text,
  licencia_sst   text,
  norma          text,
  validado_el    timestamptz,
  unique (simulador_id, version)
);

create table asignacion_ruta (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion(id) on delete cascade,
  trabajador_id   uuid not null references trabajador(id) on delete cascade,
  version_id      uuid not null references version_simulador(id),
  ruta            ltree not null,
  estado          text not null default 'asignada'
);

-- El eje del modelo: la sesión.
create table sesion (
  id              uuid primary key,
  organizacion_id uuid not null references organizacion(id) on delete cascade,
  trabajador_id   uuid not null references trabajador(id) on delete cascade,
  version_id      uuid not null references version_simulador(id),
  ruta            ltree not null,
  iniciada_en     timestamptz not null default now(),
  duracion_s      integer,
  puntaje         integer,
  veredicto       text check (veredicto in ('apto', 'no_apto', 'incompleta'))
);

-- Doble ciega de desempeño (ADR-001): la telemetría cruda vive en su propia
-- tabla justamente para que la RLS pueda protegerla. La empresa NO la ve.
create table grabacion_sesion (
  id            uuid primary key default gen_random_uuid(),
  sesion_id     uuid not null references sesion(id) on delete cascade,
  trabajador_id uuid not null references trabajador(id) on delete cascade,
  telemetria    jsonb not null
);

create table certificado (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion(id) on delete cascade,
  trabajador_id   uuid not null references trabajador(id) on delete cascade,
  sesion_id       uuid not null references sesion(id) on delete cascade,
  ruta            ltree not null,
  codigo          text not null unique,
  emitido_el      timestamptz not null default now(),
  vigente_hasta   date not null,
  hash            text not null,
  hash_anterior   text
);

create table bitacora (
  id        bigserial primary key,
  ruta      ltree,
  actor     text not null,
  accion    text not null,
  detalle   jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index on organizacion using gist (ruta);
create index on membresia  using gist (ruta);
create index on sede       using gist (ruta);
create index on cuadrilla  using gist (ruta);
create index on trabajador using gist (ruta);
create index on asignacion_ruta using gist (ruta);
create index on sesion     using gist (ruta);
create index on certificado using gist (ruta);
create index on bitacora   using gist (ruta);

-- --------------------------------------------- la ruta no la pone la aplicación
create or replace function app.fijar_ruta() returns trigger
  language plpgsql as $$
  begin
    select o.ruta into new.ruta from organizacion o where o.id = new.organizacion_id;
    if new.ruta is null then
      raise exception 'organizacion_id % no existe', new.organizacion_id;
    end if;
    return new;
  end $$;

do $$
declare t text;
begin
  foreach t in array array['membresia','sede','cuadrilla','trabajador','asignacion_ruta','sesion','certificado'] loop
    execute format(
      'create trigger tg_ruta before insert or update of organizacion_id on %I
         for each row execute function app.fijar_ruta()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['organizacion','usuario','membresia','sede','cuadrilla','trabajador',
                           'simulador','version_simulador','asignacion_ruta','sesion',
                           'grabacion_sesion','certificado','bitacora'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- Plano de organización: su subárbol y nada más. Operación lo ve todo.
do $$
declare t text;
begin
  foreach t in array array['organizacion','membresia','sede','cuadrilla'] loop
    execute format(
      'create policy p_arbol on %I using (app.es_operacion() or app.en_mi_arbol(ruta))
         with check (app.es_operacion() or app.en_mi_arbol(ruta))', t);
  end loop;
end $$;

-- Dato personal: coincidencia exacta de organización, más el plano del
-- trabajador sobre lo suyo. El distribuidor queda afuera por diseño.
create policy p_personal on trabajador
  using (app.es_operacion() or app.es_mi_organizacion(ruta) or id = app.trabajador_actual())
  with check (app.es_operacion() or app.es_mi_organizacion(ruta));

create policy p_personal on asignacion_ruta
  using (app.es_operacion() or app.es_mi_organizacion(ruta)
         or trabajador_id = app.trabajador_actual())
  with check (app.es_operacion() or app.es_mi_organizacion(ruta));

create policy p_personal on sesion
  using (app.es_operacion() or app.es_mi_organizacion(ruta)
         or trabajador_id = app.trabajador_actual())
  with check (app.es_operacion() or app.es_mi_organizacion(ruta)
              or trabajador_id = app.trabajador_actual());

create policy p_personal on certificado
  using (app.es_operacion() or app.es_mi_organizacion(ruta)
         or trabajador_id = app.trabajador_actual())
  with check (app.es_operacion() or app.es_mi_organizacion(ruta));

-- Doble ciega: la grabación NO tiene plano de organización.
create policy p_grabacion on grabacion_sesion
  using (app.es_operacion() or trabajador_id = app.trabajador_actual())
  with check (app.es_operacion() or trabajador_id = app.trabajador_actual());

-- Catálogo: lo lee todo el mundo, lo escribe solo Operación.
do $$
declare t text;
begin
  foreach t in array array['simulador','version_simulador'] loop
    execute format('create policy p_lectura on %I for select using (true)', t);
    execute format('create policy p_escritura on %I for all using (app.es_operacion())
                      with check (app.es_operacion())', t);
  end loop;
end $$;

-- El usuario se ve a sí mismo y a quien comparte su árbol.
create policy p_usuario on usuario
  using (
    app.es_operacion()
    or exists (select 1 from membresia m where m.usuario_id = usuario.id and app.en_mi_arbol(m.ruta))
  )
  with check (app.es_operacion());

create policy p_bitacora on bitacora
  using (app.es_operacion() or app.en_mi_arbol(ruta))
  with check (true);
