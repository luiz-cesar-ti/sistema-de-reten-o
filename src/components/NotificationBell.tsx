import { useState, useEffect, useRef } from 'react';
import { Bell, UserPlus, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationItem {
    id: string; // The unique ID for the notification key (reason.id or student.id)
    type: 'student' | 'reason';
    date: string; // ISO String
    authorName: string;
    authorRole: string;
    studentId?: string; // If 'student', go to the student page
}

const roleNames: Record<string, string> = {
    'admin': 'Admin Master',
    'diretor': 'Direção',
    'coordenacao': 'Coordenação',
    'atendimento': 'Atendimento'
};

export function NotificationBell() {
    const { activeUnitId, hasPrivilege } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Renderiza apenas para admin ou diretor
    const isAuthorized = hasPrivilege('admin') || hasPrivilege('diretor');

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isAuthorized || !activeUnitId) return;
        let isMounted = true;

        const fetchData = async () => {
            try {
                // 1. Fetch Pendências (student_reasons)
                const { data: reasons } = await supabase
                    .from('student_reasons')
                    .select('id, created_at, created_by, students!inner(unit_id)')
                    .eq('approval_status', 'pending')
                    .eq('students.unit_id', activeUnitId);

                // 2. Fetch Novos Alunos Hoje
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { data: students } = await supabase
                    .from('students')
                    .select('id, created_at, created_by')
                    .eq('unit_id', activeUnitId)
                    .gte('created_at', today.toISOString());

                // Coletar todos os IDs de autores
                const authorIds = new Set<string>();
                reasons?.forEach(r => authorIds.add(r.created_by));
                students?.forEach(s => authorIds.add(s.created_by));

                const uniqueAuthorIds = Array.from(authorIds).filter(Boolean);

                // Buscar profiles
                let profilesMap: Record<string, { name: string, role: string }> = {};
                if (uniqueAuthorIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, role')
                        .in('id', uniqueAuthorIds);

                    profiles?.forEach(p => {
                        profilesMap[p.id] = {
                            name: p.full_name,
                            role: roleNames[p.role] || p.role
                        };
                    });
                }

                const newNotifs: NotificationItem[] = [];

                reasons?.forEach(r => {
                    newNotifs.push({
                        id: 'r_' + r.id,
                        type: 'reason',
                        date: r.created_at,
                        authorName: profilesMap[r.created_by]?.name || 'Usuário',
                        authorRole: profilesMap[r.created_by]?.role || 'Desconhecido'
                    });
                });

                students?.forEach(s => {
                    newNotifs.push({
                        id: 's_' + s.id,
                        type: 'student',
                        date: s.created_at,
                        studentId: s.id,
                        authorName: profilesMap[s.created_by]?.name || 'Usuário',
                        authorRole: profilesMap[s.created_by]?.role || 'Desconhecido'
                    });
                });

                // Ordenar por data decrescente (mais recentes primeiro)
                newNotifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (isMounted) {
                    setNotifications(newNotifs);
                }

            } catch (error) {
                console.error('Error fetching notifications:', error);
            }
        };

        fetchData();

        // Inscreve-se no canal Realtime para Motivos
        const channelReasons = supabase.channel('public:student_reasons_bell')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_reasons' }, () => fetchData())
            .subscribe();

        // Inscreve-se no canal Realtime para Alunos
        const channelStudents = supabase.channel('public:students_bell')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchData())
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channelReasons);
            supabase.removeChannel(channelStudents);
        };
    }, [isAuthorized, activeUnitId]);

    if (!isAuthorized) return null;

    const totalUnread = notifications.length;

    const handleNotificationClick = (n: NotificationItem) => {
        setIsDropdownOpen(false);
        if (n.type === 'reason') {
            navigate('/pendencias');
        } else if (n.type === 'student' && n.studentId) {
            navigate(`/alunos/${n.studentId}`);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`relative p-3 bg-objetivo-blue text-white hover:bg-blue-900 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-md flex items-center justify-center shrink-0 group ${isDropdownOpen ? 'bg-blue-900 ring-4 ring-blue-100' : ''}`}
                title="Notificações"
            >
                <Bell className={`w-6 h-6 ${isDropdownOpen ? '' : 'group-hover:animate-pulse'}`} />

                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 text-xs font-black text-white bg-red-500 border-2 border-white rounded-full animate-in zoom-in duration-300 shadow-sm">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}

                {totalUnread > 0 && !isDropdownOpen && (
                    <span className="absolute -top-1 -right-1 flex w-6 h-6">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="bg-gray-50 border-b border-gray-100 p-3 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 text-sm">Central de Notificações</h3>
                        {totalUnread > 0 && (
                            <span className="bg-objetivo-blue text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                {totalUnread} novas
                            </span>
                        )}
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">
                                Não há notificações novas hoje.
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {notifications.map((n) => (
                                    <li
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        className="p-4 hover:bg-blue-50 cursor-pointer transition-colors flex gap-3"
                                    >
                                        <div className="flex-shrink-0 mt-0.5">
                                            {n.type === 'student' ? (
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                    <UserPlus className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                                                    <AlertTriangle className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {n.type === 'student' ? (
                                                <p className="text-sm text-gray-800 leading-snug">
                                                    Novo aluno cadastrado pelo <span className="font-bold">{n.authorName}</span> em {format(parseISO(n.date), "dd/MM/yyyy", { locale: ptBR })}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-800 leading-snug">
                                                    Nova pendência da <span className="font-bold">{n.authorRole}</span> <span className="font-bold text-gray-900">{n.authorName}</span>
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {format(parseISO(n.date), "HH:mm", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
