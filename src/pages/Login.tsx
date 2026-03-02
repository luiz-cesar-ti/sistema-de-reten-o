import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { logAction } = useAuth();
    const navigate = useNavigate();

    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutTimer, setLockoutTimer] = useState(0);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (lockoutTimer > 0) {
            toast.error(`Muitas tentativas. Aguarde ${lockoutTimer}s.`);
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            const userId = data.user?.id;
            if (userId) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (profileData && !profileData.is_active) {
                    await supabase.auth.signOut();
                    toast.error('Sua conta foi desativada.');
                    return;
                }
            }

            await logAction('login_success', 'auth', userId, { ip: 'unknown' });
            navigate('/dashboard');
        } catch (err: any) {
            console.error(err);
            toast.error('Credenciais inválidas.');

            const attempts = failedAttempts + 1;
            setFailedAttempts(attempts);

            if (attempts >= 3) {
                setLockoutTimer(30);
                const interval = setInterval(() => {
                    setLockoutTimer((prev) => {
                        if (prev <= 1) {
                            clearInterval(interval);
                            setFailedAttempts(0);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#0d1b2a] items-center justify-center font-sans p-4">
            <div className="w-full max-w-lg bg-[#1b263b]/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 md:p-12 border border-white/5">
                {/* Branding */}
                <div className="flex flex-col items-center mb-6 md:mb-10">
                    <img
                        src="/logo-objetivo.png"
                        alt="Objetivo Logo"
                        className="h-16 md:h-24 object-contain mb-4 md:mb-6 drop-shadow-lg"
                    />
                    <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest text-center leading-tight">
                        Sistema de
                    </h1>
                    <h1 className="text-3xl md:text-4xl font-black uppercase tracking-widest text-center leading-tight bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                        Retenção
                    </h1>
                    <p className="mt-3 md:mt-4 text-[10px] md:text-xs text-blue-200/50 text-center font-medium tracking-wider uppercase">
                        Acesso restrito ao painel de gestão
                    </p>
                </div>

                {/* Form */}
                <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email-address" className="block text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">
                            E-mail
                        </label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            disabled={lockoutTimer > 0}
                            className="block w-full rounded-xl border border-white/10 bg-[#0d1b2a]/60 py-3.5 px-4 text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 sm:text-sm transition-colors outline-none"
                            placeholder="E-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">
                            Senha
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            disabled={lockoutTimer > 0}
                            className="block w-full rounded-xl border border-white/10 bg-[#0d1b2a]/60 py-3.5 px-4 text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 sm:text-sm transition-colors outline-none"
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="pt-3">
                        <button
                            type="submit"
                            disabled={loading || lockoutTimer > 0}
                            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-[#0d1b2a] bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 focus:outline-none disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-[#0d1b2a]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Acessando...
                                </span>
                            ) : lockoutTimer > 0 ? (
                                `Aguarde ${lockoutTimer}s`
                            ) : (
                                'Acessar Plataforma'
                            )}
                        </button>
                    </div>
                </form>

                <div className="text-center pt-5">
                    <Link
                        to="/reset-password"
                        className="text-xs font-bold text-blue-200/40 hover:text-objetivo-amber transition-colors tracking-wider uppercase"
                    >
                        Esqueci a senha
                    </Link>
                </div>
            </div>
        </div>
    );
}
