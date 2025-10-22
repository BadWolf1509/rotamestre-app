-- DESABILITAR RLS TEMPORARIAMENTE
alter table usuarios disable row level security;
alter table unidades disable row level security;
alter table rotas disable row level security;
alter table paradas disable row level security;
alter table logs disable row level security;

-- REMOVER TODAS AS POLÍTICAS (forçando)
do $$
declare
    pol record;
begin
    for pol in (
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
    ) loop
        execute format('drop policy if exists %I on %I.%I',
            pol.policyname, pol.schemaname, pol.tablename);
    end loop;
end $$;

-- REMOVER FUNÇÕES
drop function if exists public.get_user_papel();
drop function if exists public.get_user_unidade_id();

-- REABILITAR RLS
alter table usuarios enable row level security;
alter table unidades enable row level security;
alter table rotas enable row level security;
alter table paradas enable row level security;
alter table logs enable row level security;

-- POLÍTICAS SIMPLES PARA USUARIOS
create policy "usuarios_select_own" on usuarios for select using (auth.uid() = id);
create policy "usuarios_update_own" on usuarios for update using (auth.uid() = id);

-- POLÍTICAS PARA UNIDADES
create policy "unidades_select" on unidades for select using (
    id in (select unidade_id from usuarios where id = auth.uid())
);

-- POLÍTICAS PARA ROTAS
create policy "rotas_select" on rotas for select using (
    (motorista_id = auth.uid()) or
    (unidade_id in (select unidade_id from usuarios where id = auth.uid() and papel = 'gestor'))
);

create policy "rotas_insert" on rotas for insert with check (
    unidade_id in (select unidade_id from usuarios where id = auth.uid() and papel = 'gestor')
);

create policy "rotas_update" on rotas for update using (
    (motorista_id = auth.uid()) or
    (unidade_id in (select unidade_id from usuarios where id = auth.uid() and papel = 'gestor'))
);

create policy "rotas_delete" on rotas for delete using (
    unidade_id in (select unidade_id from usuarios where id = auth.uid() and papel = 'gestor')
);

-- POLÍTICAS PARA PARADAS
create policy "paradas_select" on paradas for select using (
    rota_id in (
        select id from rotas where motorista_id = auth.uid()
        or unidade_id in (select unidade_id from usuarios where id = auth.uid() and papel = 'gestor')
    )
);

create policy "paradas_insert" on paradas for insert with check (
    rota_id in (
        select id from rotas where unidade_id in (
            select unidade_id from usuarios where id = auth.uid() and papel = 'gestor'
        )
    )
);

create policy "paradas_update" on paradas for update using (
    rota_id in (
        select id from rotas where motorista_id = auth.uid()
        or unidade_id in (select unidade_id from usuarios where id = auth.uid() and papel = 'gestor')
    )
);

create policy "paradas_delete" on paradas for delete using (
    rota_id in (
        select id from rotas where unidade_id in (
            select unidade_id from usuarios where id = auth.uid() and papel = 'gestor'
        )
    )
);

-- POLÍTICAS PARA LOGS
create policy "logs_select" on logs for select using (
    usuario_id in (
        select u2.id from usuarios u1
        join usuarios u2 on u2.unidade_id = u1.unidade_id
        where u1.id = auth.uid() and u1.papel = 'gestor'
    )
);

create policy "logs_insert" on logs for insert with check (auth.uid() is not null);