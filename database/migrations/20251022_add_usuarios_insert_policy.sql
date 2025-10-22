-- Adiciona política RLS para permitir gestores criarem motoristas na sua unidade

-- Política de INSERT para usuarios
-- Permite que gestores criem motoristas na mesma unidade
create policy "usuarios_insert_motorista" on usuarios for insert
with check (
  -- O novo usuário deve ser motorista
  papel = 'motorista'
  and
  -- Deve ser na mesma unidade do gestor que está criando
  unidade_id in (
    select unidade_id from usuarios
    where id = auth.uid() and papel = 'gestor'
  )
);