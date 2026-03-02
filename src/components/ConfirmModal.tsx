import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import React from 'react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    alertText?: React.ReactNode;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'warning',
    alertText
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const styles = {
        danger: {
            icon: AlertTriangle,
            iconColor: 'text-red-500',
            buttonBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
            alertBg: 'bg-red-50 border-red-100',
            alertText: 'text-red-700',
        },
        warning: {
            icon: AlertCircle,
            iconColor: 'text-orange-500',
            buttonBg: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
            alertBg: 'bg-orange-50 border-orange-100',
            alertText: 'text-orange-700',
        },
        info: {
            icon: Info,
            iconColor: 'text-blue-500',
            buttonBg: 'bg-objetivo-blue hover:bg-blue-800 focus:ring-objetivo-blue',
            alertBg: 'bg-blue-50 border-blue-100',
            alertText: 'text-blue-700',
        }
    };

    const currentStyle = styles[variant];
    const IconComponent = currentStyle.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm transition-opacity">
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 id="modal-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <IconComponent className={`w-5 h-5 ${currentStyle.iconColor}`} />
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-1 rounded-md transition-colors"
                        aria-label="Fechar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <div className="text-gray-600 text-sm leading-relaxed">
                        {message}
                    </div>
                    {alertText && (
                        <div className={`mt-4 border rounded-lg p-3 ${currentStyle.alertBg}`}>
                            <p className={`text-xs flex items-start gap-2 ${currentStyle.alertText}`}>
                                <IconComponent className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{alertText}</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-objetivo-blue transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${currentStyle.buttonBg}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
