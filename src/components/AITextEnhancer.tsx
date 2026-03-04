import React, { useState, forwardRef, useEffect, useRef } from 'react';
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

    // Ref interna para manter a referência atual da div editável
    const internalDivRef = useRef<HTMLDivElement>(null);

    // Sincroniza o prop value com o innerHTML somente se vier "de fora" (ex: limpar formatação ou botão voltar)
    useEffect(() => {
        if (asDiv && internalDivRef.current) {
            if (internalDivRef.current.innerHTML !== value) {
                internalDivRef.current.innerHTML = value;
            }
        }
    }, [value, asDiv]);

    const handleImproveText = async () => {
        const plainTextForCheck = asDiv ? value.replace(/<[^>]*>?/gm, '') : value;
        if (plainTextForCheck.trim().length < 150) return;

        const original = value;
        setOriginalText(original);
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
                console.log('Texto melhorado recebido:', data.improvedText);

                // Dispara o onChange sintético injetando o name para o React Hook Form não se perder
                const fakeEvent = {
                    type: 'change',
                    target: {
                        value: data.improvedText,
                        name: rest.name
                    }
                } as unknown as React.ChangeEvent<HTMLTextAreaElement>;

                onChange(fakeEvent);
            }
        } catch (error) {
            console.error('AI Enhancement Error:', error);
            setOriginalText(null);
            toast.error('Não foi possível melhorar o texto. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreText = () => {
        if (originalText !== null) {
            const fakeEvent = {
                target: {
                    value: originalText,
                    name: rest.name
                }
            } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
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
        onChange({ target: { value: e.currentTarget.innerHTML, name: rest.name } } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    };

    // Remove tags HTML para checar o tamanho se for Div
    const plainText = asDiv ? value.replace(/<[^>]*>?/gm, '') : value;
    const charsNeeded = 150 - plainText.trim().length;
    const showImproveButton = charsNeeded <= 0;

    return (
        <div className="w-full flex flex-col gap-3">
            {asDiv ? (
                <div
                    {...(rest as unknown as React.HTMLAttributes<HTMLDivElement>)}
                    // Passa tanto a ref externa quanto a ref interna
                    ref={(node) => {
                        internalDivRef.current = node as HTMLDivElement;
                        if (typeof ref === 'function') {
                            ref(node);
                        } else if (ref) {
                            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node as HTMLDivElement;
                        }
                    }}
                    contentEditable
                    onInput={handleDivInput}
                    // Removemos dangerouslySetInnerHTML, pois agora o valor inicial e 
                    // a sincronização externa estão sendo gerenciados pelo useEffect.
                    className={`${className} min-h-[100px] outline-none`}
                    suppressContentEditableWarning={true}
                />
            ) : (
                <textarea
                    {...rest}
                    ref={ref as React.RefObject<HTMLTextAreaElement>}
                    value={value}
                    onChange={handleChange}
                    disabled={isLoading || rest.disabled}
                    className={`${className}`}
                />
            )}

            {/* AI Improve Button / Loader Area */}
            <div className="flex items-center justify-end gap-3">
                {!isLoading && charsNeeded > 0 && plainText.trim().length > 0 && (
                    <span className="text-xs text-gray-500 font-medium">
                        Faltam {charsNeeded} caracteres para ativar Melhoria com IA.
                    </span>
                )}
                {isLoading ? (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-400 rounded-md shadow-sm select-none transition-all">
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        Analisando com IA...
                    </div>
                ) : showImproveButton ? (
                    <button
                        type="button"
                        onClick={handleImproveText}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg rounded-md transition-all select-none transform hover:-translate-y-0.5"
                        title="A IA vai organizar, corrigir e melhorar seu texto profissionalmente."
                    >
                        <Sparkles className="w-4 h-4" />
                        Melhorar com IA
                    </button>
                ) : null}
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
