import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { UserPlus, Shield, User, ShieldCheck, MoreVertical, Eye, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    privileges: string[];
    is_active: boolean;
    created_at: string;
    is_deleted: boolean;
}

const ALL_PRIVILEGES = ['admin', 'diretor', 'coordenacao', 'atendimento'] as const;

const privilegeLabels: Record<string, string> = {
    'admin': 'Admin Master',
    'diretor': 'Direção',
    'coordenacao': 'Coordenação',
    'atendimento': 'Atendimento'
};

const roleStyles: Record<string, string> = {
    'admin': 'bg-purple-50 text-purple-700 border-purple-200',
    'diretor': 'bg-orange-50 text-orange-700 border-orange-200',
    'coordenacao': 'bg-teal-50 text-teal-700 border-teal-200',
    'atendimento': 'bg-blue-50 text-blue-700 border-blue-200'
};

const roleIcons: Record<string, any> = {
    'admin': Shield,
    'diretor': ShieldCheck,
    'coordenacao': Eye,
    'atendimento': User
};

export function Usuarios() {
    const { activeUnitId, hasPrivilege } = useAuth();

    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!activeUnitId) return;
        fetchUsers();
    }, [activeUnitId]);

    // Close menu on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_units')
                .select(`
          profile:profiles!user_units_user_id_fkey(id, full_name, email, role, privileges, is_active, created_at, is_deleted)
        `)
                .eq('unit_id', activeUnitId);

            if (error) throw error;

            const profiles = (data || []).map(item => (item as any).profile as UserProfile).filter(p => Boolean(p) && !p.is_deleted);
            setUsers(profiles);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao buscar usuários da unidade');
        } finally {
            setLoading(false);
        }
    };

    const togglePrivilege = async (userId: string, privilege: string) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (!userToUpdate) return;

        const currentPrivileges: string[] = userToUpdate.privileges || [];
        const hasPriv = currentPrivileges.includes(privilege);

        const newPrivileges = hasPriv
            ? currentPrivileges.filter((p: string) => p !== privilege)
            : [...currentPrivileges, privilege];

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ privileges: newPrivileges })
                .eq('id', userId);

            if (error) throw error;

            // Update local state
            setUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, privileges: newPrivileges } : u
            ));

            toast.success(
                hasPriv
                    ? `Privilégio "${privilegeLabels[privilege]}" removido`
                    : `Privilégio "${privilegeLabels[privilege]}" adicionado`
            );
        } catch (err) {
            console.error(err);
            toast.error('Erro ao atualizar privilégios');
        }
    };

    const changePrimaryRole = async (userId: string, newRole: string) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (!userToUpdate || userToUpdate.role === newRole) return;

        const newPrivileges = (userToUpdate.privileges || []).filter((p: string) => p !== newRole);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole, privileges: newPrivileges })
                .eq('id', userId);

            if (error) throw error;

            setUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, role: newRole, privileges: newPrivileges } : u
            ));
            toast.success(`Cargo principal alterado para "${privilegeLabels[newRole]}"`);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao alterar cargo');
        }
    };

    const deleteUser = async (userId: string) => {
        if (!window.confirm("Tem certeza que deseja apagar permanentemente este usuário? Suas ações nos registros ficarão mantidas.")) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_deleted: true, is_active: false })
                .eq('id', userId);

            if (error) throw error;

            setUsers(prev => prev.filter(u => u.id !== userId));
            toast.success('Usuário apagado com sucesso');
            setOpenMenuId(null);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao apagar usuário');
        }
    };

    const unificados: Record<string, any> = {};
    users.forEach(u => {
        if (!unificados[u.id]) unificados[u.id] = u;
    });
    const unificadosArray = Object.values(unificados);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Usuários</h1>
                    <p className="mt-1 text-sm text-gray-500">Gestão de acessos da unidade atual.</p>
                </div>
                {hasPrivilege('admin') && (
                    <Link
                        to="/usuarios/novo"
                        className="flex items-center gap-2 bg-objetivo-blue hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors"
                    >
                        <UserPlus className="w-5 h-5" />
                        Convidar Usuário
                    </Link>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                {loading ? (
                    <div className="p-8"><div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded"></div>)}</div></div>
                ) : unificadosArray.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Nenhum usuário encontrado na unidade.</div>
                ) : (
                    <div className="w-full">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nível de Acesso</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {unificadosArray.map((u) => {
                                    const RoleIcon = roleIcons[u.role] || User;
                                    const extraPrivileges = (u.privileges || []).filter((p: string) => p !== u.role);

                                    return (
                                        <tr key={u.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10">
                                                        <div className="h-10 w-10 rounded-full bg-blue-100 text-objetivo-blue flex items-center justify-center font-bold text-lg">
                                                            {u.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{u.full_name}</div>
                                                        <div className="text-sm text-gray-500">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {/* Main role badge */}
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleStyles[u.role] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                                        <RoleIcon className="w-3 h-3" />
                                                        {privilegeLabels[u.role] || u.role}
                                                    </span>
                                                    {/* Extra privilege badges */}
                                                    {extraPrivileges.map((p: string) => {
                                                        const PrivIcon = roleIcons[p] || User;
                                                        return (
                                                            <span key={p} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${roleStyles[p] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                                                <PrivIcon className="w-3 h-3" />
                                                                +{privilegeLabels[p] || p}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {u.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => deleteUser(u.id)}
                                                    className="text-red-400 hover:text-red-700 transition-colors p-1 rounded-md hover:bg-red-50"
                                                    title="Excluir Usuário"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>

                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                                                    className="text-gray-500 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100"
                                                    title="Opções de Cargo e Privilégios"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {openMenuId === u.id && (
                                                    <div ref={menuRef} className="absolute right-12 top-10 z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-xl py-2 text-left">
                                                        <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cargo Principal</p>
                                                        {ALL_PRIVILEGES.map(role => {
                                                            const isCurrentRole = u.role === role;
                                                            return (
                                                                <button
                                                                    key={`role-${role}`}
                                                                    onClick={() => { if (!isCurrentRole) changePrimaryRole(u.id, role); }}
                                                                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${isCurrentRole ? 'bg-blue-50 cursor-default' : 'hover:bg-gray-50'}`}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        {(() => { const Icon = roleIcons[role] || User; return <Icon className={`w-4 h-4 ${isCurrentRole ? 'text-objetivo-blue' : 'text-gray-400'}`} />; })()}
                                                                        <span className={isCurrentRole ? 'text-objetivo-blue font-medium' : 'text-gray-700'}>{privilegeLabels[role]}</span>
                                                                    </span>
                                                                    {isCurrentRole && <Check className="w-4 h-4 text-objetivo-blue" />}
                                                                </button>
                                                            );
                                                        })}

                                                        <div className="border-t border-gray-100 my-1"></div>
                                                        <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Privilégios Extras</p>
                                                        {ALL_PRIVILEGES.map(priv => {
                                                            if (priv === u.role) return null; // Don't show the user's own role
                                                            const isActive = (u.privileges || []).includes(priv);
                                                            return (
                                                                <button
                                                                    key={priv}
                                                                    onClick={() => togglePrivilege(u.id, priv)}
                                                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        {(() => { const Icon = roleIcons[priv] || User; return <Icon className="w-4 h-4 text-gray-400" />; })()}
                                                                        {privilegeLabels[priv]}
                                                                    </span>
                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                        {isActive ? 'Ativo' : 'Inativo'}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}

                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
