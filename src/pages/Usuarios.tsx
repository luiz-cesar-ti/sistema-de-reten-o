import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { UserPlus, Shield, User, ShieldCheck, Eye, Check, Trash2, X, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteUserModal } from '../components/DeleteUserModal';

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

const roleIcons: Record<string, React.ElementType> = {
    'admin': Shield,
    'diretor': ShieldCheck,
    'coordenacao': Eye,
    'atendimento': User
};

const roleIconColors: Record<string, string> = {
    'admin': 'text-purple-600',
    'diretor': 'text-orange-600',
    'coordenacao': 'text-teal-600',
    'atendimento': 'text-blue-600'
};

const roleActiveStyles: Record<string, string> = {
    'admin': 'bg-purple-50 text-purple-900 border-purple-500 ring-1 ring-purple-500',
    'diretor': 'bg-orange-50 text-orange-900 border-orange-500 ring-1 ring-orange-500',
    'coordenacao': 'bg-teal-50 text-teal-900 border-teal-500 ring-1 ring-teal-500',
    'atendimento': 'bg-blue-50 text-blue-900 border-blue-500 ring-1 ring-blue-500'
};

const roleToggleColors: Record<string, string> = {
    'admin': 'bg-purple-500',
    'diretor': 'bg-orange-500',
    'coordenacao': 'bg-teal-500',
    'atendimento': 'bg-blue-500'
};

export function Usuarios() {
    const { activeUnitId, hasPrivilege } = useAuth();

    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_units')
                .select(`
          profile:profiles!user_units_user_id_fkey(id, full_name, email, role, privileges, is_active, created_at, is_deleted)
        `)
                .eq('unit_id', activeUnitId);

            if (error) throw error;

            const profiles = (data || []).map(item => (item as unknown as { profile: UserProfile }).profile).filter(p => Boolean(p) && !p.is_deleted);
            setUsers(profiles);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao buscar usuários da unidade');
        } finally {
            setLoading(false);
        }
    }, [activeUnitId]);

    useEffect(() => {
        if (!activeUnitId) return;
        fetchUsers();
    }, [activeUnitId, fetchUsers]);

    const togglePrivilege = async (userId: string, privilege: string) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (!userToUpdate) return;

        const currentPrivileges: string[] = userToUpdate.privileges || [];
        const hasPriv = currentPrivileges.includes(privilege);

        const totalAdmins = users.filter(u => u.role === 'admin' || (u.privileges || []).includes('admin')).length;
        if (hasPriv && privilege === 'admin' && totalAdmins <= 1) {
            toast.error('Ação bloqueada: O sistema precisa de pelo menos 1 Administrador Master.');
            return;
        }

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
            setSelectedUser(prev => prev?.id === userId ? { ...prev, privileges: newPrivileges } : prev);

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

        const totalAdmins = users.filter(u => u.role === 'admin' || (u.privileges || []).includes('admin')).length;
        const isCurrentlyAdmin = userToUpdate.role === 'admin' || (userToUpdate.privileges || []).includes('admin');
        const willBeAdmin = newRole === 'admin' || (userToUpdate.privileges || []).includes('admin');

        if (isCurrentlyAdmin && !willBeAdmin && totalAdmins <= 1) {
            toast.error('Ação bloqueada: Você não pode rebaixar o último Administrador Master do sistema.');
            return;
        }

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
            setSelectedUser(prev => prev?.id === userId ? { ...prev, role: newRole, privileges: newPrivileges } : prev);
            toast.success(`Cargo principal alterado para "${privilegeLabels[newRole]}"`);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao alterar cargo');
        }
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_deleted: true, is_active: false })
                .eq('id', userToDelete.id);

            if (error) throw error;

            setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
            toast.success('Usuário apagado com sucesso');
            setSelectedUser(null);
            setUserToDelete(null);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao apagar usuário');
        }
    };

    const handleDeleteClick = (user: UserProfile) => {
        const totalAdmins = users.filter(u => u.role === 'admin' || (u.privileges || []).includes('admin')).length;
        const isCurrentlyAdmin = user.role === 'admin' || (user.privileges || []).includes('admin');

        if (isCurrentlyAdmin && totalAdmins <= 1) {
            toast.error('Ação bloqueada: Você não pode excluir o último Administrador Master.');
            return;
        }
        setUserToDelete(user);
        setSelectedUser(null);
    };

    const unificados: Record<string, UserProfile> = {};
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
                    <div className="overflow-x-auto">
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
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleDeleteClick(u)}
                                                        className="text-red-400 hover:text-red-700 transition-colors p-1.5 rounded-md hover:bg-red-50"
                                                        title="Excluir Usuário"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedUser(u)}
                                                        className="text-gray-500 hover:text-objetivo-blue transition-colors p-1.5 rounded-md hover:bg-blue-50"
                                                        title="Gerenciar Cargo e Privilégios"
                                                    >
                                                        <Settings2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Cargo e Privilégios */}
            {selectedUser && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />

                    {/* Modal */}
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#0d1b2a] to-[#1b2d45] px-6 py-5 text-white">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl">
                                    {selectedUser.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">{selectedUser.full_name}</h3>
                                    <p className="text-sm text-white/60">{selectedUser.email}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Cargo Principal */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Cargo Principal</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {ALL_PRIVILEGES.map(role => {
                                        const isCurrentRole = selectedUser.role === role;
                                        const Icon = roleIcons[role] || User;
                                        return (
                                            <button
                                                key={`role-${role}`}
                                                onClick={() => { if (!isCurrentRole) changePrimaryRole(selectedUser.id, role); }}
                                                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${isCurrentRole
                                                    ? roleActiveStyles[role] || 'border-objetivo-blue bg-blue-50 text-objetivo-blue shadow-sm'
                                                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <Icon className={`w-4 h-4 ${isCurrentRole ? roleIconColors[role] || 'text-objetivo-blue' : roleIconColors[role] || 'text-gray-400'}`} />
                                                <span className="flex-1 text-left">{privilegeLabels[role]}</span>
                                                {isCurrentRole && <Check className={`w-4 h-4 ${roleIconColors[role] || 'text-objetivo-blue'}`} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-100" />

                            {/* Privilégios Extras */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Privilégios Extras</h4>
                                <div className="space-y-2">
                                    {ALL_PRIVILEGES.map(priv => {
                                        if (priv === selectedUser.role) return null;
                                        const isActive = (selectedUser.privileges || []).includes(priv);
                                        const Icon = roleIcons[priv] || User;
                                        return (
                                            <button
                                                key={priv}
                                                onClick={() => togglePrivilege(selectedUser.id, priv)}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <Icon className={`w-4 h-4 ${roleIconColors[priv] || 'text-gray-400'}`} />
                                                    <span className="text-sm font-medium text-gray-900">{privilegeLabels[priv]}</span>
                                                </span>
                                                {/* Toggle switch */}
                                                <div className={`relative w-10 h-6 rounded-full transition-colors ${isActive ? roleToggleColors[priv] || 'bg-green-500' : 'bg-gray-300'
                                                    }`}>
                                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'
                                                        }`} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="w-full py-2.5 bg-[#0d1b2a] hover:bg-[#1b2d45] text-white font-semibold rounded-xl transition-colors"
                            >
                                Concluir
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <DeleteUserModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={confirmDeleteUser}
                userName={userToDelete?.full_name || ''}
            />
        </div>
    );
}
