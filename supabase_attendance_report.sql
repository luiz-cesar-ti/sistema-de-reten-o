-- 1. ADICIONA A COLUNA DE RELATO DE ATENDIMENTO
-- Esta coluna vai guardar o texto original descritivo do motivo inserido pela equipe de Atendimento
--  no momento em que o aluno solicita o Cancelamento/Transferência.

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS attendance_report TEXT;
