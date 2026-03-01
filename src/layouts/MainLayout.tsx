import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Users, FileWarning, UserCog, ChevronLeft, ChevronRight } from 'lucide-react';

export function MainLayout() {
    const { profile, units, activeUnitId, setActiveUnitId, signOut, hasPrivilege } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <aside
                className={`relative bg-[#0d1b2a] text-white flex flex-col transition-all duration-300 ease-in-out z-20 ${isCollapsed ? 'w-20' : 'w-64'
                    }`}
            >
                {/* Collapse Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-8 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#0d1b2a] rounded-full p-1 shadow-md hover:scale-110 transition-transform z-50 flex items-center justify-center border-2 border-[#0d1b2a]"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                <div className={`py-6 flex flex-col ${isCollapsed ? 'items-center px-2' : 'px-5'}`}>
                    {isCollapsed ? (
                        <img src="/logo-objetivo.png" alt="Objetivo" className="h-7 object-contain" />
                    ) : (
                        <div className="flex flex-col items-center w-full gap-3">
                            <img src="/logo-objetivo.png" alt="Objetivo Logo" className="h-10 object-contain drop-shadow-md" />
                            <div className="text-center">
                                <span className="text-[12px] font-black text-white/70 uppercase tracking-[0.2em] block leading-none">Sistema de</span>
                                <span className="text-[18px] font-black uppercase tracking-widest block leading-tight mt-0.5 bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent">Retenção</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className={`mx-4 h-px bg-white/10 ${isCollapsed ? 'mx-2' : ''}`}></div>

                <nav className="flex-1 px-3 space-y-1.5 mt-4 hide-scrollbar overflow-y-auto">
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) => `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg transition-all duration-200 group ${isActive ? 'bg-white/10 text-white shadow-sm border-l-4 border-yellow-400' : 'text-blue-200/60 hover:bg-white/5 hover:text-white border-l-4 border-transparent'}`}
                        title="Dashboard"
                    >
                        <LayoutDashboard className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span className="font-medium">Dashboard</span>}
                    </NavLink>

                    <NavLink
                        to="/alunos"
                        className={({ isActive }) => `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg transition-all duration-200 group ${isActive ? 'bg-white/10 text-white shadow-sm border-l-4 border-yellow-400' : 'text-blue-200/60 hover:bg-white/5 hover:text-white border-l-4 border-transparent'}`}
                        title="Alunos"
                    >
                        <Users className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span className="font-medium">Alunos</span>}
                    </NavLink>

                    {(hasPrivilege('admin') || hasPrivilege('diretor') || hasPrivilege('coordenacao')) && (
                        <NavLink
                            to="/pendencias"
                            className={({ isActive }) => `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg transition-all duration-200 group ${isActive ? 'bg-white/10 text-white shadow-sm border-l-4 border-yellow-400' : 'text-blue-200/60 hover:bg-white/5 hover:text-white border-l-4 border-transparent'}`}
                            title="Pendências"
                        >
                            <FileWarning className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                            {!isCollapsed && <span className="font-medium">Pendências</span>}
                        </NavLink>
                    )}

                    {hasPrivilege('admin') && (
                        <NavLink
                            to="/usuarios"
                            className={({ isActive }) => `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg transition-all duration-200 group ${isActive ? 'bg-white/10 text-white shadow-sm border-l-4 border-yellow-400' : 'text-blue-200/60 hover:bg-white/5 hover:text-white border-l-4 border-transparent'}`}
                            title="Usuários"
                        >
                            <UserCog className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                            {!isCollapsed && <span className="font-medium">Usuários</span>}
                        </NavLink>
                    )}
                </nav>

                <div className="p-4 bg-[#0a1520] border-t border-white/5">
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-500 text-[#0d1b2a] flex items-center justify-center font-bold shadow-md flex-shrink-0">
                            {profile?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 overflow-hidden min-w-0">
                                <p className="text-sm font-bold text-white truncate">{profile?.full_name}</p>
                                <p className="text-xs text-blue-200/50 truncate flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                    {profile?.role?.toUpperCase()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        {units.length > 1 ? (
                            <select
                                value={activeUnitId || ''}
                                onChange={(e) => setActiveUnitId(e.target.value)}
                                className="block w-64 rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-objetivo-blue sm:text-sm sm:leading-6"
                            >
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-md">
                                {units[0]?.name || 'Carregando unidade...'}
                            </span>
                        )}
                    </div>

                    <div>
                        <button
                            onClick={signOut}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sair
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto bg-gray-50 relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
