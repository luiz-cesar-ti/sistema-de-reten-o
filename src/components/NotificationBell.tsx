import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
    const { activeUnitId, hasPrivilege } = useAuth();
    const [unreadReasonsCount, setUnreadReasonsCount] = useState(0);
    const [newStudentsCount, setNewStudentsCount] = useState(0);
    const navigate = useNavigate();

    // Renderiza apenas para admin, diretor, coordenacao (motivos) ou atendimento (ver alunos novos)
    const isMasterAdmin = hasPrivilege('admin') || hasPrivilege('diretor');
    const isCoordination = hasPrivilege('coordenacao');
    const isAtendimento = hasPrivilege('atendimento'); // Se existir esse role

    // Quais modulos podemos ver notificações?
    const canSeeReasons = isMasterAdmin || isCoordination;
    const canSeeStudents = isMasterAdmin || isAtendimento;

    useEffect(() => {
        if (!activeUnitId) return;
        let isMounted = true;

        const fetchReasonsCount = async () => {
            if (!canSeeReasons) return;
            try {
                const { count, error } = await supabase
                    .from('student_reasons')
                    .select('id, students!inner(unit_id)', { count: 'exact', head: true })
                    .eq('approval_status', 'pending')
                    .eq('students.unit_id', activeUnitId);

                if (error) {
                    console.error('Error fetching reasons count:', error);
                } else if (count !== null && isMounted) {
                    setUnreadReasonsCount(count);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        };

        const fetchStudentsCount = async () => {
            if (!canSeeStudents) return;
            // Let's count students created TODAY in this unit to represent "new registrations"
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            try {
                const { count, error } = await supabase
                    .from('students')
                    .select('id', { count: 'exact', head: true })
                    .eq('unit_id', activeUnitId)
                    .gte('created_at', today.toISOString());

                if (error) {
                    console.error('Error fetching students count:', error);
                } else if (count !== null && isMounted) {
                    setNewStudentsCount(count);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        };

        fetchReasonsCount();
        fetchStudentsCount();

        // Inscreve-se no canal Realtime para Motivos Pendentes
        const channelReasons = supabase.channel('public:student_reasons')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'student_reasons' },
                () => {
                    fetchReasonsCount();
                }
            )
            .subscribe();

        // Inscreve-se no canal Realtime para Alunos
        const channelStudents = supabase.channel('public:students')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'students' },
                () => {
                    fetchStudentsCount();
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channelReasons);
            supabase.removeChannel(channelStudents);
        };
    }, [canSeeReasons, canSeeStudents, activeUnitId]);

    const totalUnread = unreadReasonsCount + newStudentsCount;
    if (!canSeeReasons && !canSeeStudents) return null;

    const handleClick = () => {
        // Redireciona para o painel com mais pendências, priorizando os motivos caso o usuário seja Admin
        if (unreadReasonsCount > 0 && canSeeReasons) {
            navigate('/pendencias');
        } else {
            // Caso contrario (se eh so atendimento ou se tem so aluno novo), o lugar ideal é a tela /alunos
            navigate(canSeeReasons ? '/pendencias' : '/alunos');
        }
    };

    return (
        <button
            onClick={handleClick}
            className="relative p-3 bg-objetivo-blue text-white hover:bg-blue-900 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-md flex items-center justify-center shrink-0 group"
            title="Notificações em Tempo Real"
        >
            <Bell className="w-6 h-6 group-hover:animate-pulse" />

            {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 text-xs font-black text-white bg-red-500 border-2 border-white rounded-full animate-in zoom-in duration-300 shadow-sm">
                    {totalUnread > 99 ? '99+' : totalUnread}
                </span>
            )}

            {/* Pulso de notificação discreta atrás do sino quando há itens não lidos */}
            {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex w-6 h-6">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                </span>
            )}
        </button>
    );
}
