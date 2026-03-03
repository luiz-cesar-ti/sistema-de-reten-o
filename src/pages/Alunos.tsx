import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, Check, X, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

const levelsMap: Record<string, string> = {
    'educacao_infantil': 'Educação Infantil',
    'ensino_fundamental_1': 'Ensino Fundamental I',
    'ensino_fundamental_2': 'Ensino Fundamental II',
    'ensino_medio': 'Ensino Médio'
};

export const categoryColors: Record<string, string> = {
    'Financeiro / Mensalidade': 'bg-red-50 text-red-700 ring-red-600/20',
    'Pedagógico / Qualidade de Ensino': 'bg-blue-50 text-blue-700 ring-blue-600/20',
    'Conflito com Professor': 'bg-orange-50 text-orange-700 ring-orange-600/20',
    'Conflito com Colegas / Bullying': 'bg-purple-50 text-purple-700 ring-purple-600/20',
    'Mudança de Cidade ou Região': 'bg-teal-50 text-teal-700 ring-teal-600/20',
    'Mudança para Escola Concorrente': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    'Insatisfação com Gestão Escolar': 'bg-pink-50 text-pink-700 ring-pink-600/20',
    'Motivo Pessoal / Familiar': 'bg-green-50 text-green-700 ring-green-600/20',
    'Não Informado': 'bg-gray-50 text-gray-700 ring-gray-600/20'
};

const fetchStudents = async ([_key, activeUnitId]: [string, string]) => {
    if (!activeUnitId) throw new Error("No active unit");
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('unit_id', activeUnitId)
        .neq('approval_status', 'pending')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export function Alunos() {
    const { activeUnitId, hasPrivilege } = useAuth();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterLevel, setFilterLevel] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const { data: students = [], isLoading: loading, mutate } = useSWR(
        activeUnitId ? ['alunos', activeUnitId] : null,
        fetchStudents,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000
        }
    );

    useEffect(() => {
        if (!activeUnitId) return;

        // Realtime Subscription - Updates SWR cache when database changes
        const channel = supabase.channel('public:students_page')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'students' },
                () => {
                    mutate();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeUnitId, mutate]);

    const filteredStudents = students.filter(s => {
        const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase());
        const matchType = filterType ? s.status === filterType : true;
        const matchLevel = filterLevel ? s.education_level === filterLevel : true;
        const matchCategory = filterCategory ? s.categoria_motivo === filterCategory : true;
        return matchSearch && matchType && matchLevel && matchCategory;
    });

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Alunos</h1>
                    <p className="mt-1 text-sm text-gray-500">Gestão de evasões e transferências.</p>
                </div>
                {hasPrivilege('atendimento') && (
                    <Link
                        to="/alunos/novo"
                        className="bg-objetivo-blue hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors"
                    >
                        Novo Registro
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por nome..."
                        className="block w-full rounded-md border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-objetivo-blue sm:text-sm sm:leading-6"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="h-5 w-5 text-gray-400" />
                    <select
                        className="block w-full md:w-48 rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-objetivo-blue sm:text-sm sm:leading-6"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="">Todos os Tipos</option>
                        <option value="evasao">Evasão</option>
                        <option value="transferencia_rede">Transferência Rede</option>
                    </select>

                    <select
                        className="block w-full md:w-48 rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-objetivo-blue sm:text-sm sm:leading-6"
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                    >
                        <option value="">Nível de Ensino</option>
                        {Object.entries(levelsMap).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>

                    <select
                        className="block w-full md:w-48 rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-objetivo-blue sm:text-sm sm:leading-6"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="">Todas as Categorias</option>
                        {Object.keys(categoryColors).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8"><div className="animate-pulse space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded"></div>)}</div></div>
                ) : filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Nenhum aluno encontrado para os filtros selecionados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aluno</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ensino / Série</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Coord.</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Direção</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredStudents.map((student, idx) => (
                                    <motion.tr
                                        key={student.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => navigate(`/alunos/${student.id}`)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{levelsMap[student.education_level]}</div>
                                            <div className="text-sm text-gray-500">{student.serie}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${student.status === 'evasao' ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-orange-50 text-orange-700 ring-orange-600/20'
                                                }`}>
                                                {student.status === 'evasao' ? 'Evasão' : 'Transferência entre unidades da Rede'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {student.categoria_motivo ? (
                                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${categoryColors[student.categoria_motivo] || categoryColors['Não Informado']}`}>
                                                    {student.categoria_motivo}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">Não categorizado</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {student.spoke_with_coordination ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {student.spoke_with_direction ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(parseISO(student.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link to={`/alunos/${student.id}`} className="text-objetivo-blue hover:text-blue-900 flex items-center justify-end gap-1">
                                                <Eye className="w-4 h-4" /> Detalhes
                                            </Link>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
