import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import { Loader2, ArrowLeft, Mail, Copy, Check } from 'lucide-react';

const formSchema = z.object({
    email: z.string().email('E-mail inválido')
        .refine(val =>
            val.endsWith('@objetivoportal.com.br') ||
            val.endsWith('@objetivobaixada.com.br') ||
            val.endsWith('@objetivopraiagrande.com.br') ||
            val.endsWith('@ccpa.com.br')
            , {
                message: 'O e-mail deve ter o domínio oficial autorizado (@objetivoportal.com.br, @objetivobaixada.com.br, @objetivopraiagrande.com.br ou @ccpa.com.br)'
            }),
    unit_id: z.string().uuid('Selecione uma unidade'),
    role: z.enum(['coordenacao', 'diretor', 'atendimento'], {
        message: 'Selecione o nível de acesso'
    })
});

type FormData = z.infer<typeof formSchema>;

export function UsuarioForm() {
    const { profile, activeUnitId, logAction, units, hasPrivilege } = useAuth();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            role: 'atendimento',
            unit_id: activeUnitId || ''
        }
    });

    const onSubmit = async (data: FormData) => {
        if (!hasPrivilege('admin')) {
            toast.error('Acesso negado');
            return;
        }

        setSubmitting(true);
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);
            const generatedToken = crypto.randomUUID().replace(/-/g, '').substring(0, 32);

            const { data: tokenData, error } = await supabase
                .from('invite_tokens')
                .insert({
                    email: data.email.toLowerCase(),
                    role: data.role,
                    unit_id: data.unit_id,
                    token: generatedToken,
                    expires_at: expiresAt.toISOString(),
                    created_by: profile?.id
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    toast.error('Já existe um convite pendente para este e-mail');
                    return;
                }
                throw error;
            }

            await logAction('user_invited', 'invite_tokens', tokenData.id, {
                email: data.email,
                role: data.role,
                unit_id: data.unit_id
            });

            setInviteLink(`${window.location.origin}/convite/${generatedToken}`);
            toast.success('Link de convite gerado!');

        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao gerar convite.');
        } finally {
            setSubmitting(false);
        }
    };

    const copyToClipboard = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success('Link copiado! Envie via WhatsApp.');
        setTimeout(() => setCopied(false), 3000);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/usuarios')} className="p-2 text-gray-500 hover:text-gray-900 bg-white rounded-full shadow-sm hover:shadow transition-all">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Convidar Usuário</h1>
                    <p className="text-sm text-gray-500">Gere um link de convite para enviar via WhatsApp</p>
                </div>
            </div>

            {!inviteLink ? (
                <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
                    <div className="bg-blue-50 border-l-4 border-objetivo-blue p-4 rounded text-sm text-blue-900">
                        <p><strong>Atenção:</strong> O sistema aceita apenas e-mails institucionais (@objetivoportal.com.br, @objetivobaixada.com.br, @objetivopraiagrande.com.br ou @ccpa.com.br).</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Institucional</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="email"
                                placeholder="nome@objetivoportal.com.br"
                                {...register('email')}
                                className={`block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ${errors.email ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} sm:text-sm`}
                            />
                        </div>
                        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                        <select
                            {...register('unit_id')}
                            className={`block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ${errors.unit_id ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-objetivo-blue'} sm:text-sm`}
                        >
                            <option value="">Selecione a unidade</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        {errors.unit_id && <p className="mt-1 text-xs text-red-500">{errors.unit_id.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
                        <select
                            {...register('role')}
                            className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-objetivo-blue sm:text-sm"
                        >
                            <option value="atendimento">Atendimento (Cria registros, visualiza sua unidade)</option>
                            <option value="coordenacao">Coordenação (Visualiza dados, propõe edições pendentes em alunos)</option>
                            <option value="diretor">Direção (Aprova pendências, visualiza dash e relatórios)</option>
                        </select>
                        {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role.message}</p>}
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex justify-center items-center gap-2 rounded-md bg-objetivo-blue px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-objetivo-blue focus:ring-offset-2 transition-colors"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {submitting ? 'Gerando...' : 'Gerar Link de Convite'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-green-200 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Link Gerado!</h2>
                        <p className="text-sm text-gray-500">Copie e envie via WhatsApp para o usuário.</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                        <p className="text-sm font-mono text-gray-800 break-all flex-1">{inviteLink}</p>
                        <button
                            onClick={copyToClipboard}
                            className="flex-shrink-0 px-4 py-2 bg-objetivo-blue text-white rounded-md text-sm font-medium hover:bg-blue-800 flex items-center gap-2 transition-colors"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                        <p className="text-sm text-amber-800">⏱ Este link expira em <strong>1 hora</strong>.</p>
                    </div>

                    <div className="text-center">
                        <button
                            onClick={() => { setInviteLink(null); navigate('/usuarios'); }}
                            className="text-objetivo-blue font-medium hover:underline text-sm"
                        >
                            Voltar para lista de usuários
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
