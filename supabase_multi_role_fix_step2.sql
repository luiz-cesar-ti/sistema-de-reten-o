-- 1. POLÍTICAS PERMISSIVAS PARA GARANTIR O CADASTRO COMPLETO (Tabelas Secundárias)
-- Como o cadastro de aluno também insere um Registro Inicial em "student_reasons" 
-- e um Log de Auditoria em "audit_logs", precisamos garantir que essas tabelas
-- aceitem a credencial do Diretor com Privilégio de Atendimento.

-- Adiciona a política flexível na tabela de motivos (student_reasons)
DROP POLICY IF EXISTS "Permitir insert multi_role_fix (student_reasons)" ON public.student_reasons;
CREATE POLICY "Permitir insert multi_role_fix (student_reasons)" ON public.student_reasons
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

-- Adiciona a política flexível na tabela de logs (audit_logs)
DROP POLICY IF EXISTS "Permitir insert multi_role_fix (audit_logs)" ON public.audit_logs;
CREATE POLICY "Permitir insert multi_role_fix (audit_logs)" ON public.audit_logs
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
