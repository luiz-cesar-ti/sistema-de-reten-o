import { Loader2 } from 'lucide-react';

export function LoadingSpinner() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50">
            <Loader2 className="w-8 h-8 text-objetivo-blue animate-spin" />
            <p className="mt-4 text-sm font-medium text-gray-500">Carregando...</p>
        </div>
    );
}
