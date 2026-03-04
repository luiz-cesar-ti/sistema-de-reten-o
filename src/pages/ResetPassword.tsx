import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function ResetPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login`,
            });

            if (error) throw error;

            setSent(true);
            toast.success('E-mail de recuperação enviado!');
        } catch (err) {
            console.error(err);
            toast.error('Erro ao enviar e-mail. Verifique o endereço.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#0d1b2a] items-center justify-center font-sans p-4">
            <div className="w-full max-w-lg bg-[#1b263b]/80 backdrop-blur-sm rounded-2xl shadow-2xl p-12 border border-white/5">
                {/* Header */}
                <div className="flex flex-col items-center mb-10">
                    <img
                        src="/logo-objetivo.png"
                        alt="Objetivo Logo"
                        className="h-16 object-contain mb-6 drop-shadow-lg"
                    />
                    <h1 className="text-xl font-black text-white uppercase tracking-widest text-center leading-tight">
                        Recuperar Senha
                    </h1>
                    <p className="mt-3 text-xs text-blue-200/50 text-center font-medium tracking-wider">
                        Insira seu e-mail para receber o link de recuperação
                    </p>
                </div>

                {sent ? (
                    <div className="text-center space-y-6">
                        <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-bold text-lg">E-mail enviado!</p>
                            <p className="text-blue-200/60 text-sm mt-2">
                                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                            </p>
                        </div>
                        <Link
                            to="/login"
                            className="inline-block text-sm font-bold text-objetivo-amber hover:text-yellow-300 transition-colors tracking-wider uppercase"
                        >
                            ← Voltar ao Login
                        </Link>
                    </div>
                ) : (
                    <form className="space-y-5" onSubmit={handleReset}>
                        <div>
                            <label htmlFor="reset-email" className="block text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">
                                E-mail cadastrado
                            </label>
                            <input
                                id="reset-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="block w-full rounded-xl border border-white/10 bg-[#0d1b2a]/60 py-3.5 px-4 text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 sm:text-sm transition-colors outline-none"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="pt-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-[#0d1b2a] bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 focus:outline-none disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-[#0d1b2a]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Enviando...
                                    </span>
                                ) : (
                                    'Enviar Link de Recuperação'
                                )}
                            </button>
                        </div>

                        <div className="text-center pt-2">
                            <Link
                                to="/login"
                                className="text-sm font-bold text-blue-200/50 hover:text-white transition-colors tracking-wider"
                            >
                                ← Voltar ao Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
