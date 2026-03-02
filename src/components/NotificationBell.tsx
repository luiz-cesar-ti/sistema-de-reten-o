import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
    const { activeUnitId, hasPrivilege } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    // Renderiza apenas para admin ou diretor
    const isAuthorized = hasPrivilege('admin') || hasPrivilege('diretor');

    useEffect(() => {
        if (!isAuthorized || !activeUnitId) return;

        let isMounted = true;

        const fetchInitialCount = async () => {
            // Conta apenas student_reasons com status pending da unidade atual
            try {
                const { count, error } = await supabase
                    .from('student_reasons')
                    .select('id, students!inner(unit_id)', { count: 'exact', head: true })
                    .eq('approval_status', 'pending')
                    .eq('students.unit_id', activeUnitId);

                if (error) {
                    console.error('Error fetching notification count:', error);
                } else if (count !== null && isMounted) {
                    setUnreadCount(count);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        };

        fetchInitialCount();

        // Inscreve-se no canal Realtime
        const channel = supabase.channel('public:student_reasons')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'student_reasons' },
                () => {
                    // Como precisamos filtrar pela unidade e status através de uma tabela estrangeira (students),
                    // a abordagem mais segura num listener global é apenas dar um refetch no count total
                    // para manter a sincronia exata sempre que houver qualquer mutação na tabela de motivos.
                    fetchInitialCount();
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [isAuthorized, activeUnitId, hasPrivilege]);

    if (!isAuthorized) return null;

    return (
        <button
            onClick={() => navigate('/pendencias')}
            className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-objetivo-blue"
            aria-label="Notificações de pendências"
        >
            <Bell className="w-6 h-6" />

            {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 border-2 border-white rounded-full animate-in zoom-in duration-300">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}

            {/* Pulso de notificação discreta atrás do sino quando há itens não lidos */}
            {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex w-5 h-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                </span>
            )}
        </button>
    );
}
