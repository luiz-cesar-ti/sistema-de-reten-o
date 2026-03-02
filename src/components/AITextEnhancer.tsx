import React, { useState, forwardRef } from 'react';
import { Sparkles, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface AITextEnhancerProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement> | { target: { value: string } }) => void;
    asDiv?: boolean;
}

export const AITextEnhancer = forwardRef<HTMLTextAreaElement | HTMLDivElement, AITextEnhancerProps>((props, ref) => {
    const { value = '', onChange, className = '', asDiv = false, ...rest } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [originalText, setOriginalText] = useState<string | null>(null);

    const handleImproveText = async () => {
        if (value.trim().length < 20) return;

        setIsLoading(true);
        try {
            // Usa a rota da Vercel Function
            const response = await fetch('/api/improve-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: value }),
            });

            if (!response.ok) {
                throw new Error('Falha ao melhorar texto');
            }

            const data = await response.json();

            if (data.improvedText) {
                setOriginalText(value);
                // Dispara o onChange sintético
                const fakeEvent = {
                    target: { value: data.improvedText }
                } as React.ChangeEvent<HTMLTextAreaElement>;
                onChange(fakeEvent);
            }
        } catch (error) {
            console.error('AI Enhancement Error:', error);
            toast.error('Não foi possível melhorar o texto. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreText = () => {
        if (originalText !== null) {
            const fakeEvent = {
                target: { value: originalText }
            } as React.ChangeEvent<HTMLTextAreaElement>;
            onChange(fakeEvent);
            setOriginalText(null);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Se o usuário editar manualmente após usar a IA, sumimos com o botão de restaurar
        if (originalText !== null) {
            setOriginalText(null);
        }
        onChange(e);
    };

    const handleDivInput = (e: React.FormEvent<HTMLDivElement>) => {
        if (originalText !== null) {
            setOriginalText(null);
        }
        onChange({ target: { value: e.currentTarget.innerHTML } });
    };

    // Remove tags HTML para checar o tamanho se for Div
    const plainText = asDiv ? value.replace(/<[^>]*>?/gm, '') : value;
    const showImproveButton = plainText.trim().length >= 20;

    return (
        <div className="w-full flex flex-col gap-2">
            <div className="relative w-full">
                {asDiv ? (
                    <div
                        {...(rest as any)}
                        ref={ref as React.RefObject<HTMLDivElement>}
                        contentEditable
                        onInput={handleDivInput}
                        dangerouslySetInnerHTML={{ __html: value }}
                        className={`${className} pb-8 min-h-[100px] outline-none`} // padding-bottom extra para os botões
                        suppressContentEditableWarning={true}
                    />
                ) : (
                    <textarea
                        {...rest}
                        ref={ref as React.RefObject<HTMLTextAreaElement>}
                        value={value}
                        onChange={handleChange}
                        disabled={isLoading || rest.disabled}
                        className={`${className} pb-8`} // padding-bottom extra para os botões
                    />
                )}

                {/* AI Improve Button / Loader Overlay Area */}
                <div className="absolute bottom-2 left-2 flex items-center">
                    {isLoading ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded select-none">
                            <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                            Analisando...
                        </div>
                    ) : showImproveButton ? (
                        <button
                            type="button"
                            onClick={handleImproveText}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors select-none"
                            title="A IA vai organizar, corrigir e melhorar seu texto profissionalmente."
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Melhorar com IA
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Original Text Disclosure */}
            {originalText !== null && (
                <div className="flex flex-col gap-1 p-2 bg-gray-50 border border-gray-100 rounded-md text-xs animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 font-medium">Texto Original Reservado</span>
                        <button
                            type="button"
                            onClick={handleRestoreText}
                            className="text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 transition-colors"
                        >
                            <RefreshCcw className="w-3 h-3" />
                            Restaurar texto original
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
