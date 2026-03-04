import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AITextEnhancer } from '../components/AITextEnhancer';

const formSchema = z.object({
    fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    ra: z.string().optional(),
    educationLevel: z.enum(['educacao_infantil', 'ensino_fundamental_1', 'ensino_fundamental_2', 'ensino_medio'], {
        message: 'Selecione o nível de ensino',
    }),
    serie: z.string().min(1, 'Série é obrigatória'),
    status: z.enum(['evasao', 'transferencia_rede'], {
        message: 'Selecione o tipo do caso',
    }),
    categoriaMotivo: z.enum([
        'Financeiro / Mensalidade',
        'Pedagógico / Qualidade de Ensino',
        'Conflito com Professor',
        'Conflito com Colegas / Bullying',
        'Mudança de Cidade ou Região',
        'Mudança para Escola Concorrente',
        'Insatisfação com Gestão Escolar',
        'Motivo Pessoal / Familiar',
        'Não Informado'
    ], {
        message: 'Selecione a categoria do motivo',
    }),
    spokeWithCoordination: z.enum(['yes', 'no']).optional(),
    coordinationReversed: z.enum(['yes', 'no']).optional(),
    coordinationNoReversalReason: z.string().optional(),
    spokeWithDirection: z.enum(['yes', 'no']),
    reasonText: z.string().min(10, 'O motivo deve ter no mínimo 10 caracteres')
}).superRefine((data, ctx) => {
    if (data.spokeWithCoordination === 'yes') {
        if (!data.coordinationReversed) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione se foi revertido', path: ['coordinationReversed'] });
        } else if (data.coordinationReversed === 'no') {
            if (!data.coordinationNoReversalReason || data.coordinationNoReversalReason.trim().length === 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o motivo (obrigatório)', path: ['coordinationNoReversalReason'] });
            } else if (data.coordinationNoReversalReason.trim().length < 20) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Mínimo de 20 caracteres', path: ['coordinationNoReversalReason'] });
            }
        }
    }
});

type FormData = z.infer<typeof formSchema>;

export function AlunoForm() {
    const { user, profile, activeUnitId, logAction } = useAuth();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            spokeWithDirection: 'no'
        }
    });

    const spokeWithCoordination = watch('spokeWithCoordination');
    const coordinationReversed = watch('coordinationReversed');
    const reasonText = watch('reasonText');
    const noReversalReason = watch('coordinationNoReversalReason');

    // Handle conditional resets
    const handleCoordinationChange = (val: 'yes' | 'no') => {
        setValue('spokeWithCoordination', val);
        if (val === 'no') {
            setValue('coordinationReversed', undefined);
            setValue('coordinationNoReversalReason', '');
        }
    };

    const handleReversedChange = (val: 'yes' | 'no') => {
        setValue('coordinationReversed', val);
        if (val === 'yes') {
            setValue('coordinationNoReversalReason', '');
        }
    };

    const onSubmit = async (data: FormData) => {
        if (!activeUnitId || !user || !profile) {
            toast.error('Erro de sessão ou unidade não selecionada.');
            return;
        }

        setSubmitting(true);
        try {
            // Refresh session to ensure JWT has latest claims
            await supabase.auth.refreshSession();

            // DEBUG: Log JWT claims and unit info
            const { data: { session: debugSession } } = await supabase.auth.getSession();
            if (debugSession) {
                const jwt = JSON.parse(atob(debugSession.access_token.split('.')[1]));
                console.log('JWT Claims:', { user_role: jwt.user_role, user_unit_ids: jwt.user_unit_ids });
                console.log('Active Unit ID being sent:', activeUnitId);
            }

            // 1. Sanitize all text fields
            const cleanFullName = DOMPurify.sanitize(data.fullName.trim());
            const cleanSerie = DOMPurify.sanitize(data.serie.trim());
            const cleanReversalReason = data.coordinationNoReversalReason ? DOMPurify.sanitize(data.coordinationNoReversalReason.trim()) : null;
            const cleanReasonText = DOMPurify.sanitize(data.reasonText.trim());

            const spokeCoord = data.spokeWithCoordination === 'yes' ? true : (data.spokeWithCoordination === 'no' ? false : null);
            const coordReversed = data.spokeWithCoordination === 'yes' && data.coordinationReversed ? (data.coordinationReversed === 'yes') : null;

            const finalNoReversalReason = (data.spokeWithCoordination === 'yes' && coordReversed === false && cleanReversalReason) ? cleanReversalReason : null;

            // 2. Insert Student
            const initialApprovalStatus = profile.role === 'atendimento' ? 'pending' : 'approved';

            const { data: studentData, error: studentError } = await supabase.from('students').insert({
                full_name: cleanFullName,
                ra: data.ra ? DOMPurify.sanitize(data.ra.trim()) : null,
                unit_id: activeUnitId,
                education_level: data.educationLevel,
                serie: cleanSerie,
                status: data.status,
                categoria_motivo: data.categoriaMotivo,
                spoke_with_coordination: spokeCoord,
                coordination_reversed: coordReversed,
                coordination_no_reversal_reason: finalNoReversalReason,
                spoke_with_direction: data.spokeWithDirection === 'yes',
                attendance_report: cleanReasonText,
                created_by: user.id,
                approval_status: initialApprovalStatus
            }).select().single();

            if (studentError) throw studentError;

            // 3. Audit Log
            await logAction('student_created', 'students', studentData.id, {
                name: cleanFullName,
                status: data.status,
                approval_status: initialApprovalStatus
            });

            if (initialApprovalStatus === 'pending') {
                toast.success(
                    (t) => (
                        <div className="flex flex-col gap-2">
                            <p className="font-bold text-objetivo-blue">Registro Enviado para Aprovação da Direção!</p>
                            <p className="text-sm">O aluno foi cadastrado, mas só será efetivado após a aprovação da Direção.</p>
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="mt-2 bg-objetivo-blue text-white py-1 px-3 rounded text-sm w-fit"
                            >
                                Entendi
                            </button>
                        </div>
                    ),
                    { duration: 8000 } // Tost com duração estendida para garantir a leitura
                );
                navigate('/');
            } else {
                toast.success('Registro criado com sucesso!');
                navigate(`/alunos/${studentData.id}`);
            }

        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao salvar registro.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Novo Registro de Caso</h1>
                <p className="mt-1 text-sm text-gray-500">Preencha com atenção. Todos os campos com * são obrigatórios.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                {/* SEÇÃO 1 — Identificação do Aluno */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-objetivo-blue mb-4 flex items-center gap-2 border-b pb-2">
                        Identificação do Aluno
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nome completo do aluno <span className="text-red-500">*</span></label>
                            <input type="text" placeholder="Digite o nome completo do aluno" {...register('fullName')} className={`mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ${errors.fullName ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} sm:text-sm`} />
                            {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nível de Ensino <span className="text-red-500">*</span></label>
                            <select {...register('educationLevel')} className={`mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ${errors.educationLevel ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} sm:text-sm`}>
                                <option value="">Selecione o nível de ensino</option>
                                <option value="educacao_infantil">Educação Infantil</option>
                                <option value="ensino_fundamental_1">Ensino Fundamental I</option>
                                <option value="ensino_fundamental_2">Ensino Fundamental II</option>
                                <option value="ensino_medio">Ensino Médio</option>
                            </select>
                            {errors.educationLevel && <p className="mt-1 text-xs text-red-500">{errors.educationLevel.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">RA (Registro do Aluno)</label>
                            <input type="text" placeholder="Ex: 123456" {...register('ra')} className={`mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-objetivo-blue sm:text-sm`} />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Série <span className="text-red-500">*</span></label>
                            <input type="text" placeholder="Ex: 3º ano, 1ª série, Maternal II..." {...register('serie')} className={`mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ${errors.serie ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} sm:text-sm`} />
                            {errors.serie && <p className="mt-1 text-xs text-red-500">{errors.serie.message}</p>}
                        </div>
                    </div>
                </section>

                {/* SEÇÃO 2 — Tipo do Caso */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-objetivo-blue mb-4 flex items-center gap-2 border-b pb-2">
                        Tipo do Caso <span className="text-red-500">*</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className={`relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none ${watch('status') === 'evasao' ? 'border-red-500 ring-1 ring-red-500 bg-red-50' : 'border-gray-300'}`}>
                            <input type="radio" value="evasao" {...register('status')} className="sr-only" />
                            <span className="flex flex-1">
                                <span className="flex flex-col">
                                    <span className={`block text-sm font-medium ${watch('status') === 'evasao' ? 'text-red-900' : 'text-gray-900'}`}>Evasão</span>
                                </span>
                            </span>
                            <Check className={`h-5 w-5 ${watch('status') === 'evasao' ? 'text-red-600' : 'invisible'}`} />
                        </label>

                        <label className={`relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none ${watch('status') === 'transferencia_rede' ? 'border-orange-500 ring-1 ring-orange-500 bg-orange-50' : 'border-gray-300'}`}>
                            <input type="radio" value="transferencia_rede" {...register('status')} className="sr-only" />
                            <span className="flex flex-1">
                                <span className="flex flex-col">
                                    <span className={`block text-sm font-medium ${watch('status') === 'transferencia_rede' ? 'text-orange-900' : 'text-gray-900'}`}>Transferência entre unidades da Rede</span>
                                </span>
                            </span>
                            <Check className={`h-5 w-5 ${watch('status') === 'transferencia_rede' ? 'text-orange-600' : 'invisible'}`} />
                        </label>
                    </div>
                    {errors.status && <p className="mt-2 text-xs text-red-500">{errors.status.message}</p>}
                </section>

                {/* SEÇÃO 2B — Categoria do Motivo */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-objetivo-blue mb-4 flex items-center gap-2 border-b pb-2">
                        Categoria do Motivo <span className="text-red-500">*</span>
                    </h2>
                    <div>
                        <select {...register('categoriaMotivo')} className={`mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ${errors.categoriaMotivo ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} sm:text-sm`}>
                            <option value="">Selecione a categoria mais adequada</option>
                            <option value="Financeiro / Mensalidade">Financeiro / Mensalidade</option>
                            <option value="Pedagógico / Qualidade de Ensino">Pedagógico / Qualidade de Ensino</option>
                            <option value="Conflito com Professor">Conflito com Professor</option>
                            <option value="Conflito com Colegas / Bullying">Conflito com Colegas / Bullying</option>
                            <option value="Mudança de Cidade ou Região">Mudança de Cidade ou Região</option>
                            <option value="Mudança para Escola Concorrente">Mudança para Escola Concorrente</option>
                            <option value="Insatisfação com Gestão Escolar">Insatisfação com Gestão Escolar</option>
                            <option value="Motivo Pessoal / Familiar">Motivo Pessoal / Familiar</option>
                            <option value="Não Informado">Não Informado</option>
                        </select>
                        {errors.categoriaMotivo && <p className="mt-1 text-xs text-red-500">{errors.categoriaMotivo.message}</p>}
                    </div>
                </section>

                {/* SEÇÃO 3 — Atendimento pela Coordenação */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-objetivo-blue mb-4 flex items-center gap-2 border-b pb-2">
                        Atendimento pela Coordenação
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <p className="block text-sm font-medium text-gray-700 mb-2">Já conversou com a coordenação?</p>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="spokeWithCoordination" value="yes" checked={spokeWithCoordination === 'yes'} onChange={() => handleCoordinationChange('yes')} className="w-4 h-4 text-objetivo-blue border-gray-300 focus:ring-objetivo-blue" />
                                    <span className="text-sm">Sim</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="spokeWithCoordination" value="no" checked={spokeWithCoordination === 'no'} onChange={() => handleCoordinationChange('no')} className="w-4 h-4 text-objetivo-blue border-gray-300 focus:ring-objetivo-blue" />
                                    <span className="text-sm">Não</span>
                                </label>
                            </div>
                        </div>

                        <AnimatePresence>
                            {spokeWithCoordination === 'yes' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
                                    <div>
                                        <p className="block text-sm font-medium text-gray-700 mb-2">Conseguiu reverter? <span className="text-red-500">*</span></p>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="coordinationReversed" value="yes" checked={coordinationReversed === 'yes'} onChange={() => handleReversedChange('yes')} className="w-4 h-4 text-objetivo-blue border-gray-300 focus:ring-objetivo-blue" />
                                                <span className="text-sm">Sim</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="coordinationReversed" value="no" checked={coordinationReversed === 'no'} onChange={() => handleReversedChange('no')} className="w-4 h-4 text-objetivo-blue border-gray-300 focus:ring-objetivo-blue" />
                                                <span className="text-sm">Não</span>
                                            </label>
                                        </div>
                                        {errors.coordinationReversed && <p className="mt-1 text-xs text-red-500">{errors.coordinationReversed.message}</p>}
                                    </div>

                                    <AnimatePresence>
                                        {coordinationReversed === 'no' && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                                <label className="block text-sm font-medium text-gray-700">Por qual motivo não foi possível reverter? <span className="text-red-500">*</span></label>
                                                <AITextEnhancer
                                                    placeholder="Descreva o motivo pelo qual não foi possível reverter a situação com a coordenação..."
                                                    {...register('coordinationNoReversalReason')}
                                                    value={noReversalReason || ''}
                                                    rows={4}
                                                    className={`mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ${errors.coordinationNoReversalReason ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} sm:text-sm`}
                                                />
                                                <div className="flex justify-between mt-1">
                                                    <p className="text-xs text-gray-400">{noReversalReason?.length || 0} caracteres</p>
                                                    {errors.coordinationNoReversalReason && <p className="text-xs text-red-500">{errors.coordinationNoReversalReason.message}</p>}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>

                {/* SEÇÃO 4 — Atendimento pela Direção */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-objetivo-blue mb-4 flex items-center gap-2 border-b pb-2">
                        Atendimento pela Direção
                    </h2>
                    <div>
                        <p className="block text-sm font-medium text-gray-700 mb-2">Já conversou com a direção? <span className="text-red-500">*</span></p>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" value="yes" {...register('spokeWithDirection')} className="w-4 h-4 text-objetivo-blue border-gray-300 focus:ring-objetivo-blue" />
                                <span className="text-sm">Sim</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" value="no" {...register('spokeWithDirection')} className="w-4 h-4 text-objetivo-blue border-gray-300 focus:ring-objetivo-blue" />
                                <span className="text-sm">Não</span>
                            </label>
                        </div>
                        {errors.spokeWithDirection && <p className="mt-1 text-xs text-red-500">{errors.spokeWithDirection.message}</p>}
                    </div>
                </section>

                {/* SEÇÃO 5 — Motivo do Cancelamento / Transferência */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-objetivo-blue mb-4 flex items-center gap-2 border-b pb-2">
                        Relato do Atendimento <span className="text-red-500">*</span>
                    </h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Motivo detalhado</label>
                        <AITextEnhancer
                            {...register('reasonText')}
                            value={reasonText || ''}
                            className={`mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ${errors.reasonText ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} min-h-[180px] resize-y sm:text-sm`}
                            placeholder="Descreva detalhadamente o motivo relatado pelo responsável ou pelo aluno para a evasão ou transferência..."
                        />
                        <div className="flex justify-between mt-1">
                            <p className="text-xs text-gray-400">{reasonText?.length || 0} caracteres</p>
                            {errors.reasonText && <p className="text-xs text-red-500">{errors.reasonText.message}</p>}
                        </div>
                    </div>
                </section>

                {/* Ações */}
                <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        disabled={submitting}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-objetivo-blue focus:ring-offset-2"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex justify-center items-center gap-2 rounded-md bg-objetivo-blue px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-objetivo-blue focus:ring-offset-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {submitting ? 'Salvando...' : 'Salvar Registro'}
                    </button>
                </div>
            </form>

            {/* Modal Cancelar */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Tem certeza?</h3>
                        <p className="text-sm text-gray-500 mb-6">Os dados preenchidos serão perdidos.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Continuar editando</button>
                            <button onClick={() => navigate('/alunos')} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">Descartar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
