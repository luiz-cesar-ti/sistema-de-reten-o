-- 1. ADICIONANDO COLUNA LOGICA "IS_DELETED"
-- Isso permite uma exclusão baseada apenas em ocultação sem destruir vínculos
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;


-- 2. CORRIJINDO A REGRA DE QUEM PODE CADASTRAR ALUNOS NO SISTEMA
-- A regra original barrava Diretores que recebiam a TAG extras de "Atendimento", pois baseava-se apenas em 'role'.
-- Estamos substituindo pela leitura da mochila de Privilégios Globais ('privileges' array).
DROP POLICY IF EXISTS "Permitir insert por atendimento ou admin" ON public.students;

CREATE POLICY "Permitir insert por usuarios autorizados (privileges)" ON public.students
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      'admin' = ANY(profiles.privileges) OR profiles.role = 'admin' OR
      'atendimento' = ANY(profiles.privileges) OR profiles.role = 'atendimento' OR
      'diretor' = ANY(profiles.privileges) OR profiles.role = 'diretor'
    )
  )
);


-- 3. AJUSTE DE ATIVACAO: Garantir que 'is_deleted = true' sobreponha o 'is_active' (Opcional p/ Banco, Tratamento Front)
-- Para usuarios que foram Soft Deleted, mantemos o log íntegro de exclusao, mas podemos desativa-los da autenticação caso loguem.
