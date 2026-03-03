import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Check, X, AlertCircle, Eye, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { ConfirmModal } from '../components/ConfirmModal';

export function Pendencias() {
    const { profile, activeUnitId, logAction } = useAuth();

    const [loading, setLoading] = useState(true);
    const [pendencias, setPendencias] = useState<any[]>([]);
    const [confirmActionData, setConfirmActionData] = useState<{ id: string, action: 'approved' | 'rejected', type: 'reason' | 'new_student' } | null>(null);

    useEffect(() => {
        if (!activeUnitId) return;
        fetchPendencias();
    }, [activeUnitId]);

    const fetchPendencias = async () => {
        setLoading(true);
        try {
            // Must query student_reasons with status 'pending' matching the active unit
            const { data, error } = await supabase
                .from('student_reasons')
                .select(`
          id, reason_text, created_at, created_by_name,
          students!inner(id, full_name, unit_id, serie, education_level, status, is_deleted)
        `)
                .eq('approval_status', 'pending')
                .eq('students.unit_id', activeUnitId)
                .eq('students.is_deleted', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select(`id, full_name, unit_id, serie, education_level, status, is_deleted, attendance_report, created_at`)
                .eq('approval_status', 'pending')
                .eq('unit_id', activeUnitId)
                .eq('is_deleted', false);

            if (studentsError) throw studentsError;

            const reasonsList = (data || []).map(r => ({ ...r, type: 'reason' }));
            const studentsList = (studentsData || []).map(s => ({
                id: s.id,
                type: 'new_student',
                reason_text: s.attendance_report || 'Novo Registro',
                created_at: s.created_at,
                created_by_name: 'Usuário (Novo Registro)',
                students: {
                    id: s.id,
                    full_name: s.full_name,
                    unit_id: s.unit_id,
                    serie: s.serie,
                    education_level: s.education_level,
                    status: s.status,
                    is_deleted: s.is_deleted
                }
            }));

            const combined = [...reasonsList, ...studentsList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setPendencias(combined);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao buscar pendências');
        } finally {
            setLoading(false);
        }
    };

    const handleActionClick = (id: string, action: 'approved' | 'rejected', type: 'reason' | 'new_student') => {
        setConfirmActionData({ id, action, type });
    };

    const confirmAction = async () => {
        if (!profile || !confirmActionData) return;

        const { id, action, type } = confirmActionData;

        try {
            const pendingItem = pendencias.find(p => p.id === id);

            if (type === 'new_student') {
                if (action === 'approved') {
                    const { error } = await supabase.from('students').update({ approval_status: 'approved' }).eq('id', id);
                    if (error) throw error;
                    await logAction('student_approved', 'students', id);
                } else {
                    const { error } = await supabase.from('students').update({ approval_status: 'rejected', is_deleted: true }).eq('id', id);
                    if (error) throw error;
                    await logAction('student_rejected', 'students', id);
                }
            } else {
                if (action === 'approved' && pendingItem) {
                    try {
                        const parsed = JSON.parse(pendingItem.reason_text);
                        if (parsed.isCoordination) {
                            const payload = {
                                spoke_with_coordination: parsed.spoke_with_coordination,
                                coordination_reversed: parsed.coordination_reversed,
                                coordination_no_reversal_reason: parsed.coordination_no_reversal_reason
                            };
                            const { error: updateError } = await supabase.from('students').update(payload).eq('id', pendingItem.students.id);
                            if (updateError) throw updateError;

                            await logAction('coordination_info_updated', 'students', pendingItem.students.id);
                        }
                    } catch (e) {
                        // Trata como texto normal caso não seja JSON de coordenação
                    }
                }

                const { error } = await supabase
                    .from('student_reasons')
                    .update({
                        approval_status: action,
                        approved_by: profile.id,
                        approved_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;

                await logAction(action === 'approved' ? 'reason_approved' : 'reason_rejected', 'student_reasons', id);
            }

            toast.success(action === 'approved' ? 'Ação aprovada!' : 'Ação rejeitada!');

            setPendencias(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error(err);
            toast.error('Erro ao aplicar ação.');
        } finally {
            setConfirmActionData(null);
        }
    };

    const renderReasonContent = (text: string) => {
        try {
            const parsed = JSON.parse(text);
            if (parsed.isCoordination) {
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-objetivo-blue flex items-center gap-1 mb-2">
                            <UserMinus className="w-4 h-4" /> Solicitação da Coordenação
                        </p>
                        <p className="text-gray-700 text-sm"><span className="font-medium text-gray-500">Conversou com a família?</span> {parsed.spoke_with_coordination ? 'Sim' : 'Não'}</p>
                        {parsed.spoke_with_coordination && (
                            <p className="text-gray-700 text-sm"><span className="font-medium text-gray-500">Reverteu a situação?</span> {parsed.coordination_reversed ? 'Sim' : 'Não'}</p>
                        )}
                        {parsed.spoke_with_coordination && parsed.coordination_reversed === false && parsed.coordination_no_reversal_reason && (
                            <div className="mt-2 text-gray-700 text-sm">
                                <span className="font-medium text-gray-500">Motivo da não reversão:</span>
                                <div className="mt-1 p-2 bg-white rounded border border-gray-100 italic">{parsed.coordination_no_reversal_reason}</div>
                            </div>
                        )}
                    </div>
                );
            }
        } catch (e) {
            // Volta para renderização como texto normal
        }

        const cleanHtml = DOMPurify.sanitize(text, {
            ALLOWED_TAGS: ['b', 'strong', 'span'],
            ALLOWED_ATTR: ['class', 'style']
        });

        return <span className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    Pendências de Aprovação
                    {pendencias.length > 0 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
                            {pendencias.length}
                        </span>
                    )}
                </h1>
                <p className="mt-1 text-sm text-gray-500">Motivos pendentes para alunos de sua unidade.</p>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl"></div>)}
                    </div>
                ) : pendencias.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
                        <AlertCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">Tudo em dia!</h3>
                        <p className="text-gray-500 mt-1">Nenhum motivo aguardando aprovação na unidade selecionada.</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {pendencias.map((item, idx) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white border-l-4 border-yellow-400 p-6 rounded-r-xl shadow-sm hover:shadow transition-shadow grid grid-cols-1 md:grid-cols-4 gap-6"
                            >
                                <div className="md:col-span-1 space-y-1">
                                    <p className="text-sm font-medium text-gray-500">Aluno</p>
                                    <Link to={`/alunos/${item.students.id}`} className="font-bold text-objetivo-blue hover:underline">
                                        {item.students.full_name}
                                    </Link>
                                    <p className="text-xs text-gray-500">{item.students.serie}</p>
                                    <span className={`mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${item.students.status === 'cancelamento' ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-orange-50 text-orange-700 ring-orange-600/20'
                                        }`}>
                                        {item.students.status === 'cancelamento' ? 'Cancelamento' : 'Transferência'}
                                    </span>
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-700">Motivo Adicionado por: <span className="font-bold">{item.created_by_name}</span></p>
                                        <p className="text-xs text-gray-400">{format(parseISO(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded border border-gray-100 text-sm text-gray-700">
                                        {renderReasonContent(item.reason_text)}
                                    </div>
                                </div>

                                <div className="md:col-span-1 flex flex-col items-end justify-center gap-3">
                                    <div className="flex w-full sm:w-auto gap-2">
                                        <button
                                            onClick={() => handleActionClick(item.id, 'rejected', item.type)}
                                            className="flex-1 sm:flex-none justify-center flex items-center gap-1 px-4 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                        >
                                            <X className="w-4 h-4" /> Rejeitar
                                        </button>
                                        <button
                                            onClick={() => handleActionClick(item.id, 'approved', item.type)}
                                            className="flex-1 sm:flex-none justify-center flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow-sm"
                                        >
                                            <Check className="w-4 h-4" /> Aprovar
                                        </button>
                                    </div>
                                    <Link to={`/alunos/${item.students.id}`} className="text-xs text-gray-500 hover:text-objetivo-blue flex items-center gap-1 mt-2">
                                        <Eye className="w-3 h-3" /> Ver histórico completo
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            <ConfirmModal
                isOpen={!!confirmActionData}
                onClose={() => setConfirmActionData(null)}
                onConfirm={confirmAction}
                title={confirmActionData?.action === 'approved' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
                message={
                    <>
                        Confirma a <strong className={confirmActionData?.action === 'approved' ? 'text-green-600' : 'text-red-600'}>
                            {confirmActionData?.action === 'approved' ? 'APROVAÇÃO' : 'REJEIÇÃO'}
                        </strong> deste motivo?
                    </>
                }
                confirmText={confirmActionData?.action === 'approved' ? 'Sim, aprovar' : 'Sim, rejeitar'}
                variant={confirmActionData?.action === 'approved' ? 'info' : 'danger'}
            />
        </div>
    );
}
