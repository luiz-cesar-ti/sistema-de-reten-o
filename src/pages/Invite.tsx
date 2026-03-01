import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function Invite() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [inviteData, setInviteData] = useState<any>(null);
    const [registrationComplete, setRegistrationComplete] = useState(false);

    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');

    const [passwordStrength, setPasswordStrength] = useState({
        length: false,
        uppercase: false,
        number: false,
        special: false
    });

    useEffect(() => {
        async function validateToken() {
            if (!token) return;
            try {
                const { data, error } = await supabase
                    .from('invite_tokens')
                    .select('*')
                    .eq('token', token)
                    .eq('status', 'pending')
                    .single();

                if (error || !data) throw new Error('Token inválido');

                if (new Date(data.expires_at) < new Date()) {
                    throw new Error('Token expirado');
                }

                setInviteData(data);
            } catch (err) {
                toast.error('Link inválido ou expirado. Solicite um novo convite ao administrador.');
            } finally {
                setLoading(false);
            }
        }

        validateToken();
    }, [token]);

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPassword(val);
        setPasswordStrength({
            length: val.length >= 8,
            uppercase: /[A-Z]/.test(val),
            number: /[0-9]/.test(val),
            special: /[^A-Za-z0-9]/.test(val)
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteData) return;

        if (!fullName.trim() || fullName.trim().length < 3) {
            toast.error('Informe seu nome completo (mínimo 3 caracteres).');
            return;
        }

        if (!passwordStrength.length || !passwordStrength.uppercase || !passwordStrength.number || !passwordStrength.special) {
            toast.error('A senha não atende aos requisitos mínimos.');
            return;
        }

        if (password !== passwordConfirm) {
            toast.error('As senhas não coincidem.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Create user in Supabase Auth with metadata
            // Profile will be created on first login (in AuthContext) after email confirmation
            const { error: authError } = await supabase.auth.signUp({
                email: inviteData.email,
                password: password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        invite_token_id: inviteData.id,
                    }
                }
            });

            if (authError) throw authError;

            // 2. Mark invite token as used
            await supabase
                .from('invite_tokens')
                .update({ status: 'used', used_at: new Date().toISOString(), full_name: fullName.trim() })
                .eq('id', inviteData.id);

            toast.success('Conta criada! Verifique seu e-mail para ativar.');
            setRegistrationComplete(true);

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Ocorreu um erro ao criar a conta.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0d1b2a]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent"></div>
            </div>
        );
    }

    if (!inviteData && !registrationComplete) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0d1b2a] p-4">
                <div className="w-full max-w-lg bg-[#1b263b]/80 backdrop-blur-sm rounded-2xl shadow-2xl p-12 border border-white/5 text-center space-y-4">
                    <img src="/logo-objetivo.png" alt="Objetivo" className="h-16 object-contain mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-400">Convite Inválido</h2>
                    <p className="text-blue-200/60 text-sm">Link inválido ou expirado. Solicite um novo convite ao administrador.</p>
                </div>
            </div>
        );
    }

    if (registrationComplete) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0d1b2a] px-4">
                <div className="w-full max-w-lg bg-[#1b263b]/80 backdrop-blur-sm rounded-2xl shadow-2xl p-12 border border-white/5 text-center space-y-6">
                    <img src="/logo-objetivo.png" alt="Objetivo" className="h-16 object-contain mx-auto" />
                    <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Verifique seu E-mail</h2>
                    <p className="text-blue-200/60 text-sm">
                        Enviamos um link de confirmação para <strong className="text-yellow-400">{inviteData?.email}</strong>.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-blue-200/70">
                        <p>Abra seu e-mail e clique no link de confirmação para ativar sua conta.</p>
                        <p className="mt-2 text-yellow-400/80">Após confirmar, faça login normalmente.</p>
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-4 rounded-xl shadow-lg text-sm font-bold text-[#0d1b2a] bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        Ir para o Login
                    </button>
                </div>
            </div>
        );
    }

    const strengthCount = Object.values(passwordStrength).filter(Boolean).length;
    const strengthColor = strengthCount <= 1 ? 'bg-red-500' : strengthCount <= 3 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0d1b2a] px-4 py-8 font-sans">
            <div className="w-full max-w-lg bg-[#1b263b]/80 backdrop-blur-sm rounded-2xl shadow-2xl p-12 border border-white/5">
                {/* Branding */}
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo-objetivo.png" alt="Objetivo Logo" className="h-16 object-contain mb-4 drop-shadow-lg" />
                    <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center leading-tight">
                        Sistema de
                    </h1>
                    <h1 className="text-3xl font-black uppercase tracking-widest text-center leading-tight bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                        Retenção
                    </h1>
                    <div className="w-12 h-0.5 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mt-4"></div>
                    <p className="mt-3 text-xs text-blue-200/50 text-center font-medium tracking-wider uppercase">
                        Completar Cadastro
                    </p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">E-mail</label>
                        <input type="email" disabled value={inviteData.email} className="block w-full rounded-xl border border-white/10 bg-[#0d1b2a]/60 py-3.5 px-4 text-white/50 sm:text-sm outline-none cursor-not-allowed" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">Nome Completo</label>
                        <input
                            type="text"
                            required
                            placeholder="Seu nome completo"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="block w-full rounded-xl border border-white/10 bg-[#0d1b2a]/60 py-3.5 px-4 text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 sm:text-sm transition-colors outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">Senha</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={handlePasswordChange}
                            className="block w-full rounded-xl border border-white/10 bg-[#0d1b2a]/60 py-3.5 px-4 text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 sm:text-sm transition-colors outline-none"
                        />
                        <div className="mt-3">
                            <div className="flex h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full ${strengthColor} transition-all duration-300 rounded-full`} style={{ width: `${(strengthCount / 4) * 100}%` }}></div>
                            </div>
                            <ul className="grid grid-cols-2 gap-1 mt-2 text-xs">
                                <li className={`${passwordStrength.length ? 'text-green-400' : 'text-gray-600'}`}>Mínimo 8 chars</li>
                                <li className={`${passwordStrength.uppercase ? 'text-green-400' : 'text-gray-600'}`}>1 letra maiúscula</li>
                                <li className={`${passwordStrength.number ? 'text-green-400' : 'text-gray-600'}`}>1 número</li>
                                <li className={`${passwordStrength.special ? 'text-green-400' : 'text-gray-600'}`}>1 char especial</li>
                            </ul>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">Confirmar Senha</label>
                        <input
                            type="password"
                            required
                            value={passwordConfirm}
                            onChange={(e) => setPasswordConfirm(e.target.value)}
                            className="block w-full rounded-xl border border-white/10 bg-[#0d1b2a]/60 py-3.5 px-4 text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 sm:text-sm transition-colors outline-none"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-[#0d1b2a] bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 focus:outline-none disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-[#0d1b2a]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Criando conta...
                                </span>
                            ) : (
                                'Completar Cadastro'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
