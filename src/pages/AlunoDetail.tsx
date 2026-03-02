import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Check, X, ArrowLeft, Plus, Clock, ShieldCheck, UserMinus, Edit2, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { ConfirmModal } from '../components/ConfirmModal';

export function AlunoDetail() {
    const { id } = useParams<{ id: string }>();
    const { profile, logAction, hasPrivilege } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<any>(null);
    const [reasons, setReasons] = useState<any[]>([]);

    const [showAddReason, setShowAddReason] = useState(false);
    const [newReasonText, setNewReasonText] = useState('');
    const [addingReason, setAddingReason] = useState(false);

    const [confirmReasonData, setConfirmReasonData] = useState<{ id: string, action: 'approved' | 'rejected' } | null>(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    const handleFormat = (command: string, arg?: string | undefined) => {
        const editor = document.getElementById('reason-textarea');
        if (!editor) return;

        // Se for formatação de cor de fundo (hiliteColor) para compatibilidade cross-browser
        if (command === 'hiliteColor') {
            document.execCommand('styleWithCSS', false, 'true');
        }

        document.execCommand(command, false, arg || undefined);
        editor.focus();

        // Atualiza o state com o HTML gerado
        setNewReasonText(editor.innerHTML);
    };

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [editingCoord, setEditingCoord] = useState(false);
    const [savingCoord, setSavingCoord] = useState(false);
    const [coordForm, setCoordForm] = useState({
        spoke_with_coordination: null as boolean | null,
        coordination_reversed: null as boolean | null,
        coordination_no_reversal_reason: '' as string | null
    });

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*, units(name)')
                .eq('id', id)
                .single();

            if (studentError) throw studentError;
            setStudent(studentData);

            const { data: reasonsData, error: reasonsError } = await supabase
                .from('student_reasons')
                .select('*')
                .eq('student_id', id)
                .order('created_at', { ascending: true });

            if (reasonsError) throw reasonsError;

            const isApprover = hasPrivilege('admin') || hasPrivilege('diretor');
            const visibleReasons = (reasonsData || []).filter(r => {
                if (r.approval_status !== 'pending') return true;
                if (isApprover) return true;
                if (r.created_by === profile?.id) return true;
                return false;
            });

            // Fetch roles for the authors of these reasons
            const authorIds = [...new Set(visibleReasons.map(r => r.created_by))].filter(Boolean);
            let rolesMap: Record<string, string> = {};
            if (authorIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, role')
                    .in('id', authorIds);

                if (profilesData) {
                    const roleNames: Record<string, string> = {
                        'admin': 'Admin Master',
                        'diretor': 'Direção',
                        'coordenacao': 'Coordenação',
                        'atendimento': 'Atendimento'
                    };
                    profilesData.forEach(p => {
                        rolesMap[p.id] = roleNames[p.role] || p.role;
                    });
                }
            }

            const reasonsWithRoles = visibleReasons.map(r => ({
                ...r,
                author_role: rolesMap[r.created_by] || 'Usuário'
            }));

            setReasons(reasonsWithRoles);

            const reasonIds = reasonsWithRoles ? reasonsWithRoles.map(r => r.id) : [];
            const idsList = reasonIds.length ? reasonIds.join(',') : '00000000-0000-0000-0000-000000000000';

            const { data: logsData } = await supabase
                .from('audit_logs')
                .select('*')
                .or(`and(entity.eq.students,entity_id.eq.${id}),and(entity.eq.student_reasons,entity_id.in.(${idsList}))`)
                .order('created_at', { ascending: false });

            setAuditLogs(logsData || []);
        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao carregar os dados do aluno.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddReason = async () => {
        const editorDiv = document.getElementById('reason-textarea');
        const currentText = (editorDiv ? editorDiv.innerHTML : newReasonText).trim();

        if (!currentText || currentText === '<br>') {
            toast.error('O motivo não pode estar vazio.');
            return;
        }

        setAddingReason(true);
        try {
            const cleanReason = DOMPurify.sanitize(currentText);
            const needsApproval = !(hasPrivilege('admin') || hasPrivilege('diretor'));
            const status = needsApproval ? 'pending' : 'approved';

            const payload: any = {
                student_id: id,
                reason_text: cleanReason,
                created_by: profile?.id,
                created_by_name: profile?.full_name,
                approval_status: status
            };

            if (status === 'approved') {
                payload.approved_by = profile?.id;
                payload.approved_at = new Date().toISOString();
            }

            const { data, error } = await supabase.from('student_reasons').insert(payload).select().single();

            if (error) throw error;

            await logAction('reason_added', 'student_reasons', data.id, { status });
            toast.success(status === 'approved' ? 'Motivo adicionado e aprovado automaticamente!' : 'Motivo enviado para aprovação.');

            setReasons([...reasons, data]);
            setNewReasonText('');
            if (editorDiv) editorDiv.innerHTML = ''; // Limpa o editor visual HTML
            setShowAddReason(false);
        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao adicionar motivo.');
        } finally {
            setAddingReason(false);
        }
    };

    const handleReasonAction = (reasonId: string, action: 'approved' | 'rejected') => {
        if (!profile || (!hasPrivilege('admin') && !hasPrivilege('diretor'))) return;
        setConfirmReasonData({ id: reasonId, action });
    };

    const confirmReasonAction = async () => {
        if (!confirmReasonData || !profile || (!hasPrivilege('admin') && !hasPrivilege('diretor'))) return;

        const { id: reasonId, action } = confirmReasonData;

        try {
            const { error } = await supabase
                .from('student_reasons')
                .update({
                    approval_status: action,
                    approved_by: profile.id,
                    approved_at: new Date().toISOString()
                })
                .eq('id', reasonId);

            if (error) throw error;

            await logAction(action === 'approved' ? 'reason_approved' : 'reason_rejected', 'student_reasons', reasonId);
            toast.success(action === 'approved' ? 'Motivo aprovado!' : 'Motivo rejeitado!');

            // Refetch to cleanly update audit logs and status
            fetchData();
        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao atualizar status.');
        } finally {
            setConfirmReasonData(null);
        }
    };

    const handleDeleteStudent = () => {
        if (!hasPrivilege('admin')) return;
        setShowConfirmDelete(true);
    };

    const confirmDeleteStudent = async () => {
        if (!hasPrivilege('admin')) return;

        try {
            const { error } = await supabase
                .from('students')
                .update({ is_deleted: true })
                .eq('id', id);

            if (error) throw error;

            await logAction('reason_added', 'students', id, { note: 'Aluno excluído (soft delete)' });
            toast.success('Aluno excluído com sucesso!');
            navigate('/alunos');
        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao excluir aluno.');
        } finally {
            setShowConfirmDelete(false);
        }
    };

    const renderReasonContent = (text: string) => {
        try {
            const parsed = JSON.parse(text);
            if (parsed.isCoordination) {
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-objetivo-blue flex items-center gap-1 mb-2">
                            <UserMinus className="w-4 h-4" /> Atualização da Coordenação
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

    const handleEditCoordClick = () => {
        setCoordForm({
            spoke_with_coordination: student.spoke_with_coordination,
            coordination_reversed: student.coordination_reversed,
            coordination_no_reversal_reason: student.coordination_no_reversal_reason || ''
        });
        setEditingCoord(true);
    };

    const handleSaveCoordination = async () => {
        setSavingCoord(true);
        try {
            const cleanReason = coordForm.coordination_no_reversal_reason ? DOMPurify.sanitize(coordForm.coordination_no_reversal_reason.trim()) : null;

            if (!profile) return;

            // Save JSON structured pendency string instead of updating the student
            const pendingObject = {
                isCoordination: true,
                spoke_with_coordination: coordForm.spoke_with_coordination,
                coordination_reversed: coordForm.spoke_with_coordination ? coordForm.coordination_reversed : null,
                coordination_no_reversal_reason: (coordForm.spoke_with_coordination && coordForm.coordination_reversed === false) ? cleanReason : null
            };

            const reasonPayload = {
                student_id: id,
                reason_text: JSON.stringify(pendingObject),
                created_by: profile.id,
                created_by_name: profile.full_name,
                approval_status: 'pending'
            };

            const { error: reasonError } = await supabase.from('student_reasons').insert(reasonPayload);
            if (reasonError) throw reasonError;

            await logAction('reason_added', 'student_reasons', id);
            toast.success('Edição enviada para aprovação da Direção!');
            setEditingCoord(false);
            fetchData(); // Refresh history logs
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar as informações.');
        } finally {
            setSavingCoord(false);
        }
    };

    if (loading) {
        return <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-40 bg-gray-200 rounded-xl"></div><div className="h-64 bg-gray-200 rounded-xl"></div></div></div>;
    }

    if (!student) {
        return <div className="p-8 text-center text-gray-500">Aluno não encontrado.</div>;
    }

    const levelsMap: Record<string, string> = {
        'educacao_infantil': 'Educação Infantil',
        'ensino_fundamental_1': 'Ensino Fundamental I',
        'ensino_fundamental_2': 'Ensino Fundamental II',
        'ensino_medio': 'Ensino Médio'
    };

    const pendingCoordination = reasons.some(r => r.approval_status === 'pending' && r.reason_text?.startsWith('{"isCoordination":true'));

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/alunos')} className="p-2 text-gray-500 hover:text-gray-900 bg-white rounded-full shadow-sm hover:shadow transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Detalhes do Registro</h1>
                    </div>
                </div>
                {hasPrivilege('admin') && (
                    <button
                        onClick={handleDeleteStudent}
                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-md shadow-sm transition-colors text-sm font-medium border border-red-200"
                    >
                        <Trash2 className="w-4 h-4" />
                        Excluir Aluno
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Bloco de Informações do Aluno */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Nome completo</p>
                            <p className="font-semibold text-gray-900">{student.full_name}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">RA</p>
                                <p className="font-medium text-gray-900">{student.ra}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Unidade</p>
                                <p className="font-medium text-gray-900">{student.units?.name}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Ensino</p>
                                <p className="font-medium text-gray-900">{levelsMap[student.education_level]}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Série</p>
                                <p className="font-medium text-gray-900">{student.serie}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${student.status === 'cancelamento' ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-orange-50 text-orange-700 ring-orange-600/20'
                                }`}>
                                {student.status === 'cancelamento' ? 'Cancelamento de Matrícula' : 'Transferência'}
                            </span>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Data de Registro</p>
                            <p className="font-medium text-gray-900">{format(parseISO(student.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                        </div>
                    </div>

                    {/* Bloco de Relato do Atendimento */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2"><UserMinus className="w-4 h-4 text-orange-500" /> Relato do Atendimento</h3>
                        </div>
                        <div className="text-gray-700 text-sm whitespace-pre-wrap">
                            {student.attendance_report || <span className="text-gray-400 italic">Nenhum relato inicial registrado.</span>}
                        </div>
                    </div>

                    {/* Bloco da Coordenação */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2"><UserMinus className="w-4 h-4 text-objetivo-blue" /> Coordenação</h3>
                            {student.spoke_with_coordination === null && !editingCoord && !pendingCoordination && (profile?.role === 'coordenacao' || profile?.privileges?.includes('coordenacao')) && (
                                <button onClick={handleEditCoordClick} className="text-gray-400 hover:text-objetivo-blue" title="Editar informações da coordenação">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {pendingCoordination && !editingCoord && (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-md text-sm mt-3 mb-1">
                                <p className="font-semibold flex items-center gap-1"><Clock className="w-4 h-4" /> Em Análise</p>
                                <p className="mt-1">Uma edição da coordenação está aguardando aprovação da Direção/Admin.</p>
                            </div>
                        )}

                        {editingCoord ? (
                            <div className="space-y-4 text-sm mt-2">
                                <div>
                                    <p className="font-medium text-gray-700 mb-1">Já conversou com a coordenação?</p>
                                    <div className="flex gap-4 border p-2 rounded-md border-gray-200 bg-gray-50">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={coordForm.spoke_with_coordination === true} onChange={() => setCoordForm({ ...coordForm, spoke_with_coordination: true })} className="text-objetivo-blue focus:ring-objetivo-blue" /> Sim
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={coordForm.spoke_with_coordination === false} onChange={() => setCoordForm({ ...coordForm, spoke_with_coordination: false, coordination_reversed: null, coordination_no_reversal_reason: '' })} className="text-objetivo-blue focus:ring-objetivo-blue" /> Não
                                        </label>
                                    </div>
                                </div>

                                {coordForm.spoke_with_coordination === true && (
                                    <div>
                                        <p className="font-medium text-gray-700 mb-1">Conseguiu reverter?</p>
                                        <div className="flex gap-4 border p-2 rounded-md border-gray-200 bg-gray-50">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={coordForm.coordination_reversed === true} onChange={() => setCoordForm({ ...coordForm, coordination_reversed: true, coordination_no_reversal_reason: '' })} className="text-objetivo-blue focus:ring-objetivo-blue" /> Sim
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={coordForm.coordination_reversed === false} onChange={() => setCoordForm({ ...coordForm, coordination_reversed: false })} className="text-objetivo-blue focus:ring-objetivo-blue" /> Não
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {coordForm.spoke_with_coordination === true && coordForm.coordination_reversed === false && (
                                    <div>
                                        <p className="font-medium text-gray-700 mb-1">Motivo da não reversão:</p>
                                        <textarea
                                            value={coordForm.coordination_no_reversal_reason || ''}
                                            onChange={e => setCoordForm({ ...coordForm, coordination_no_reversal_reason: e.target.value })}
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:border-objetivo-blue focus:ring-1 focus:ring-objetivo-blue"
                                            rows={3}
                                            placeholder="Descreva..."
                                        />
                                    </div>
                                )}

                                <div className="flex gap-2 justify-end pt-2">
                                    <button onClick={() => setEditingCoord(false)} className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50 text-gray-600">Cancelar</button>
                                    <button onClick={handleSaveCoordination} disabled={savingCoord} className="px-3 py-1.5 text-xs font-semibold bg-objetivo-blue text-white rounded hover:bg-blue-800 disabled:opacity-50 flex items-center gap-1"><Save className="w-3 h-3" /> Salvar</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm space-y-2 mt-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Conversou?</span>
                                    <span className="font-medium flex items-center gap-1">
                                        {student.spoke_with_coordination === null ? <span className="text-gray-400">Não informado</span> : student.spoke_with_coordination ? <><Check className="w-4 h-4 text-green-500" /> Sim</> : <><X className="w-4 h-4 text-red-500" /> Não</>}
                                    </span>
                                </div>
                                {student.spoke_with_coordination === true && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Reverteu?</span>
                                        <span className="font-medium flex items-center gap-1">
                                            {student.coordination_reversed === null ? <span className="text-gray-400">---</span> : student.coordination_reversed ? <><Check className="w-4 h-4 text-green-500" /> Sim</> : <><X className="w-4 h-4 text-red-500" /> Não</>}
                                        </span>
                                    </div>
                                )}
                                {student.spoke_with_coordination === true && student.coordination_reversed === false && student.coordination_no_reversal_reason && (
                                    <div className="mt-2 p-3 bg-gray-50 rounded-md text-gray-700 border border-gray-200">
                                        <p className="text-xs text-gray-500 mb-1 font-semibold">Motivo da não reversão:</p>
                                        {student.coordination_no_reversal_reason}
                                    </div>
                                )}
                            </div>
                        )}

                        <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 mt-6"><ShieldCheck className="w-4 h-4 text-objetivo-blue" /> Direção</h3>
                        <div className="text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Conversou?</span>
                                <span className="font-medium flex items-center gap-1">
                                    {student.spoke_with_direction ? <><Check className="w-4 h-4 text-green-500" /> Sim</> : <><X className="w-4 h-4 text-red-500" /> Não</>}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline de Motivos */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Histórico de Motivos</h2>
                            {(profile?.role === 'atendimento' || profile?.role === 'coordenacao') && (
                                <button
                                    onClick={() => setShowAddReason(!showAddReason)}
                                    className="flex items-center gap-1 text-sm bg-objetivo-blue text-white px-3 py-1.5 rounded-md hover:bg-blue-800 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            {showAddReason && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                                >
                                    <h3 className="text-sm font-bold text-gray-800 mb-2">Novo Motivo</h3>

                                    {/* Toolbar de Formatação */}
                                    <div className="flex gap-2 mb-2 bg-white p-1.5 rounded-md border border-gray-300 w-fit">
                                        <button
                                            onClick={() => handleFormat('bold', undefined)}
                                            className="px-2 py-1 hover:bg-gray-100 rounded text-gray-700 font-bold text-sm flex items-center gap-1"
                                            title="Negrito"
                                        >
                                            B
                                        </button>
                                        <div className="w-px bg-gray-300 mx-1"></div>
                                        <button
                                            onClick={() => handleFormat('hiliteColor', '#fef08a')}
                                            className="w-6 h-6 rounded-full bg-yellow-200 hover:ring-2 hover:ring-offset-1 hover:ring-yellow-400 transition-all flex items-center justify-center text-[10px]"
                                            title="Destacar de Amarelo"
                                        >
                                            A
                                        </button>
                                        <button
                                            onClick={() => handleFormat('hiliteColor', '#bbf7d0')}
                                            className="w-6 h-6 rounded-full bg-green-200 hover:ring-2 hover:ring-offset-1 hover:ring-green-400 transition-all flex items-center justify-center text-[10px]"
                                            title="Destacar de Verde"
                                        >
                                            V
                                        </button>
                                        <button
                                            onClick={() => handleFormat('hiliteColor', '#fecaca')}
                                            className="w-6 h-6 rounded-full bg-red-200 hover:ring-2 hover:ring-offset-1 hover:ring-red-400 transition-all flex items-center justify-center text-[10px]"
                                            title="Destacar de Vermelho"
                                        >
                                            V
                                        </button>
                                        <div className="w-px bg-gray-300 mx-1"></div>
                                        <button
                                            onClick={() => handleFormat('removeFormat')}
                                            className="px-2 py-1 hover:bg-gray-100 rounded text-gray-500 text-xs flex items-center gap-1"
                                            title="Limpar Formatação"
                                        >
                                            Limpar
                                        </button>
                                    </div>

                                    <div
                                        id="reason-textarea"
                                        contentEditable
                                        onInput={(e) => setNewReasonText(e.currentTarget.innerHTML)}
                                        className="w-full min-h-[100px] rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-objetivo-blue focus:border-objetivo-blue bg-white"
                                        suppressContentEditableWarning={true}
                                    />
                                    <div className="flex justify-between items-center mt-3">
                                        <span className="text-xs text-gray-500 text-right w-full mb-2 block">Digite o seu texto e selecione partes dele antes de clicar nas cores parar destacá-lo.</span>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => { setShowAddReason(false); setNewReasonText(''); }} className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
                                        <button onClick={handleAddReason} disabled={addingReason} className="px-3 py-1.5 text-sm text-white bg-objetivo-amber rounded-md hover:bg-yellow-600 disabled:opacity-50">Salvar Motivo</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative border-l-2 border-gray-200 ml-3 pl-6 space-y-8 py-2">
                            {reasons.map((reason, idx) => (
                                <motion.div
                                    key={reason.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="relative"
                                >
                                    {/* Dot on the timeline */}
                                    <span className={`absolute -left-[33px] top-1 w-4 h-4 rounded-full border-2 border-white 
                    ${reason.approval_status === 'approved' ? 'bg-green-500' :
                                            reason.approval_status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}`}
                                    />

                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-gray-900">{reason.created_by_name} <span className="text-gray-500 font-normal italic">- {reason.author_role}</span></span>
                                        <span className="text-xs text-gray-400">• {format(parseISO(reason.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                    </div>

                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700">
                                        {renderReasonContent(reason.reason_text)}
                                    </div>

                                    <div className="mt-2 flex items-center justify-between">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium 
                      ${reason.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                                                reason.approval_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}
                                        >
                                            {reason.approval_status === 'approved' ? <><Check className="w-3 h-3" /> Aprovado</> :
                                                reason.approval_status === 'rejected' ? <><X className="w-3 h-3" /> Rejeitado</> : <><Clock className="w-3 h-3" /> Pendente aprovação</>}
                                        </span>

                                        {(hasPrivilege('diretor') || hasPrivilege('admin')) && reason.approval_status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleReasonAction(reason.id, 'rejected')} className="text-xs px-2 py-1 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-1"><X className="w-3 h-3" /> Rejeitar</button>
                                                <button onClick={() => handleReasonAction(reason.id, 'approved')} className="text-xs px-2 py-1 bg-white border border-green-200 text-green-600 rounded hover:bg-green-50 flex items-center gap-1"><Check className="w-3 h-3" /> Aprovar</button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        {reasons.length === 0 && (
                            <p className="text-center text-gray-500 py-4">Nenhum motivo registrado.</p>
                        )}
                    </div>

                    {/* Histórico de Alterações (Admin/Direção) */}
                    {(hasPrivilege('admin') || hasPrivilege('diretor')) && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-objetivo-blue" /> Histórico de Alterações
                            </h2>
                            {auditLogs.length > 0 ? (
                                <div className="space-y-4">
                                    {auditLogs.map((log) => (
                                        <div key={log.id} className="flex gap-3 text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                                            <div className="mt-0.5">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                                                    {log.user_name.charAt(0)}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{log.user_name}</p>
                                                <p className="text-gray-600">
                                                    {log.action === 'reason_added' && 'Adicionou um novo motivo'}
                                                    {log.action === 'reason_approved' && 'Aprovou um motivo pendente'}
                                                    {log.action === 'reason_rejected' && 'Rejeitou um motivo'}
                                                    {log.action === 'coordination_info_updated' && 'Editou as informações da coordenação'}
                                                    {!['reason_added', 'reason_approved', 'reason_rejected', 'coordination_info_updated'].includes(log.action) && `Ação: ${log.action}`}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Nenhum registro encontrado no histórico.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!confirmReasonData}
                onClose={() => setConfirmReasonData(null)}
                onConfirm={confirmReasonAction}
                title={confirmReasonData?.action === 'approved' ? 'Aprovar Motivo' : 'Rejeitar Motivo'}
                message={
                    <>
                        Tem certeza que deseja <strong className={confirmReasonData?.action === 'approved' ? 'text-green-600' : 'text-red-600'}>
                            {confirmReasonData?.action === 'approved' ? 'APROVAR' : 'REJEITAR'}
                        </strong> este motivo?
                    </>
                }
                confirmText={confirmReasonData?.action === 'approved' ? 'Sim, aprovar' : 'Sim, rejeitar'}
                variant={confirmReasonData?.action === 'approved' ? 'info' : 'danger'}
            />

            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => setShowConfirmDelete(false)}
                onConfirm={confirmDeleteStudent}
                title="Excluir Aluno"
                message={<>Tem certeza que deseja apagar permanentemente o registro de <strong>{student.full_name}</strong>?</>}
                alertText="O registro ficará oculto em todo o sistema, mas permanecerá no banco de dados para segurança."
                confirmText="Sim, excluir aluno"
                variant="danger"
            />
        </div >
    );
}
