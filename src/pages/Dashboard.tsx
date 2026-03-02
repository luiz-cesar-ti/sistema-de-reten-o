import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { subMonths, startOfMonth, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { UserMinus, ArrowRightLeft, AlertCircle, CalendarDays, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const levelsMap: Record<string, string> = {
    'educacao_infantil': 'Educação Infantil',
    'ensino_fundamental_1': 'Ensino Fundamental I',
    'ensino_fundamental_2': 'Ensino Fundamental II',
    'ensino_medio': 'Ensino Médio'
};
const COLORS = ['#1a237e', '#FFA000', '#f44336', '#4caf50'];

export function Dashboard() {
    const { activeUnitId, hasPrivilege, units } = useAuth();
    const activeUnit = units.find(u => u.id === activeUnitId);

    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        cancelamentos: 0,
        transferencias: 0,
        pendentes: 0,
        mesAtual: 0,
    });

    const [chartData, setChartData] = useState<any[]>([]);
    const [levelData, setLevelData] = useState<any[]>([]);
    const [indicators, setIndicators] = useState({ coord: 0, revert: 0, dir: 0 });
    const [recent, setRecent] = useState<any[]>([]);

    const [dateRange, setDateRange] = useState({
        start: format(subMonths(new Date(), 5), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    useEffect(() => {
        if (!activeUnitId) return;

        fetchDashboardData();
    }, [activeUnitId, dateRange]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const currentMonthStart = startOfMonth(new Date()).toISOString();

            // Adjust dates avoiding JS UTC parsing bug on YYYY-MM-DD strings
            const startStr = dateRange.start + 'T00:00:00';
            const endStr = dateRange.end + 'T23:59:59';
            const startD = new Date(startStr);
            const endD = new Date(endStr);

            // Fetch all students for unit in selected date range
            const { data: students } = await supabase
                .from('students')
                .select('*')
                .eq('unit_id', activeUnitId)
                .gte('created_at', startD.toISOString())
                .lte('created_at', endD.toISOString())
                .order('created_at', { ascending: false });

            // Fetch pending reasons for the unit if director/admin
            let pendentesCount = 0;
            if (hasPrivilege('admin') || hasPrivilege('diretor') || hasPrivilege('coordenacao')) {
                const { count } = await supabase
                    .from('student_reasons')
                    .select('id, students!inner(unit_id)', { count: 'exact', head: true })
                    .eq('approval_status', 'pending')
                    .eq('students.unit_id', activeUnitId);
                pendentesCount = count || 0;
            }

            if (!students) {
                setLoading(false);
                return;
            }

            // Calculate simple metrics using all lifetime stats? Or 6 months? 
            // The prompt just says "Total de cancelamentos" which usually means all time unless specified. Let's fetch all time for top metrics.
            const { count: totalCancels } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('unit_id', activeUnitId).eq('status', 'cancelamento');
            const { count: totalTransfers } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('unit_id', activeUnitId).eq('status', 'transferencia');
            const { count: monthTotal } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('unit_id', activeUnitId).gte('created_at', currentMonthStart);

            setMetrics({
                cancelamentos: totalCancels || 0,
                transferencias: totalTransfers || 0,
                pendentes: pendentesCount,
                mesAtual: monthTotal || 0,
            });

            // Chart 1: Group By Month dynamically from Start to End (Reverse Chronological: Newest on Left)
            const monthMap = new Map();
            let loopDate = new Date(endD);
            loopDate.setDate(1); // align to month start
            loopDate.setHours(0, 0, 0, 0);

            const startMonth = new Date(startD);
            startMonth.setDate(1);
            startMonth.setHours(0, 0, 0, 0);

            while (loopDate >= startMonth) {
                const ym = format(loopDate, 'yyyy-MM');
                monthMap.set(ym, {
                    name: format(loopDate, 'MMM/yy', { locale: ptBR }),
                    yearMonth: ym,
                    Cancelamentos: 0,
                    Transferências: 0
                });
                loopDate.setMonth(loopDate.getMonth() - 1);
            }

            students.forEach(s => {
                const dText = format(parseISO(s.created_at), 'yyyy-MM');
                if (monthMap.has(dText)) {
                    const g = monthMap.get(dText);
                    if (s.status === 'cancelamento') g.Cancelamentos++;
                    if (s.status === 'transferencia') g.Transferências++;
                }
            });
            setChartData(Array.from(monthMap.values()));

            // Chart 2: Levels distribution
            const lvlMap: Record<string, number> = {};
            students.forEach(s => {
                const nm = levelsMap[s.education_level] || s.education_level;
                lvlMap[nm] = (lvlMap[nm] || 0) + 1;
            });
            setLevelData(Object.entries(lvlMap).map(([name, value]) => ({ name, value })));

            // Indicators: 
            let spokeCoord = 0;
            let reverted = 0;
            let spokeDir = 0;
            students.forEach(s => {
                if (s.spoke_with_coordination) spokeCoord++;
                if (s.coordination_reversed) reverted++;
                if (s.spoke_with_direction) spokeDir++;
            });
            const totalS = students.length || 1;
            const totalCoord = spokeCoord || 1;

            setIndicators({
                coord: Math.round((spokeCoord / totalS) * 100),
                revert: Math.round((reverted / totalCoord) * 100),
                dir: Math.round((spokeDir / totalS) * 100),
            });

            // Recent 5
            setRecent(students.slice(0, 5));

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8"><div className="animate-pulse flex flex-col gap-4"><div className="h-32 bg-gray-200 rounded-xl"></div><div className="h-64 bg-gray-200 rounded-xl"></div></div></div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                    <p className="text-sm md:text-lg font-semibold text-objetivo-blue mt-1">Bem-Vindo {activeUnit?.name || ''}</p>
                </div>

                {/* Global Date Filter Component */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-100 w-full sm:w-auto">
                    <div className="flex flex-col w-full sm:w-auto">
                        <span className="text-xs text-gray-500 font-medium ml-1">Início</span>
                        <input
                            type="date"
                            className="text-sm border-0 focus:ring-0 p-1 text-gray-700 bg-transparent cursor-pointer w-full"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        />
                    </div>
                    <span className="text-gray-300 hidden sm:block">-</span>
                    <div className="flex flex-col w-full sm:w-auto">
                        <span className="text-xs text-gray-500 font-medium ml-1">Fim</span>
                        <input
                            type="date"
                            className="text-sm border-0 focus:ring-0 p-1 text-gray-700 bg-transparent cursor-pointer w-full"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Seção 1: Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Cancelamentos" value={metrics.cancelamentos} icon={<UserMinus className="w-6 h-6 text-red-600" />} color="bg-red-50" delay={0.1} />
                <MetricCard title="Transferências" value={metrics.transferencias} icon={<ArrowRightLeft className="w-6 h-6 text-orange-600" />} color="bg-orange-50" delay={0.2} />
                <MetricCard title="Pendentes" value={metrics.pendentes} icon={<AlertCircle className={`w-6 h-6 ${metrics.pendentes > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />} color={metrics.pendentes > 0 ? 'bg-yellow-50' : 'bg-gray-50'} delay={0.3} flash={metrics.pendentes > 0} />
                <MetricCard title="Este Mês" value={metrics.mesAtual} icon={<CalendarDays className="w-6 h-6 text-blue-600" />} color="bg-blue-50" delay={0.4} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Seção 2: Gráfico Barras */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2"
                >
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Evolução Temporal</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <RechartsTooltip />
                                <Legend />
                                <Bar dataKey="Cancelamentos" fill="#f44336" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Transferências" fill="#FFA000" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Seção 3: Pizza */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
                >
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Níveis de Ensino</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={levelData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {levelData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Seção 4: Indicadores */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between"
                >
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Efetividade</h3>
                    <div className="space-y-6 flex-1 flex flex-col justify-center">
                        <div>
                            <div className="flex justify-between mb-1 text-sm font-medium text-gray-700"><span>Atendidos Coordenação</span><span>{indicators.coord}%</span></div>
                            <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-objetivo-blue h-2 rounded-full" style={{ width: `${indicators.coord}%` }}></div></div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1 text-sm font-medium text-gray-700"><span>Reversões Coordenação</span><span>{indicators.revert}%</span></div>
                            <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${indicators.revert}%` }}></div></div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1 text-sm font-medium text-gray-700"><span>Atendidos Direção</span><span>{indicators.dir}%</span></div>
                            <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-objetivo-amber h-2 rounded-full" style={{ width: `${indicators.dir}%` }}></div></div>
                        </div>
                    </div>
                </motion.div>

                {/* Seção 5: Recentes */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800">5 Casos Mais Recentes</h3>
                        <Link to="/alunos" className="text-sm font-medium text-objetivo-blue hover:underline">Ver todos</Link>
                    </div>
                    {/* The date picker elements were moved to the header section */}
                    <div className="divide-y divide-gray-100">
                        {recent.length === 0 ? (
                            <p className="text-gray-500 text-sm py-4">Nenhum registro encontrado.</p>
                        ) : (
                            recent.map((s, idx) => (
                                <motion.div
                                    key={s.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.9 + (idx * 0.1) }}
                                    className="py-3 flex items-center justify-between"
                                >
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{s.full_name}</p>
                                        <p className="text-xs text-gray-500">{levelsMap[s.education_level]} • {s.serie}</p>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                                        <div className={`text-xs font-medium border px-2 py-1 rounded truncate max-w-[100px] md:max-w-none ${s.status === 'cancelamento' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                                            }`}>
                                            <span className="hidden md:inline">{s.status === 'cancelamento' ? 'Cancelamento de Matrícula' : 'Transferência'}</span>
                                            <span className="md:hidden">{s.status === 'cancelamento' ? 'Cancel.' : 'Transf.'}</span>
                                        </div>
                                        <Link to={`/alunos/${s.id}`} className="p-1 text-gray-400 hover:text-objetivo-blue transition-colors">
                                            <ArrowRight className="w-5 h-5" />
                                        </Link>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </div >
    );
}

function MetricCard({ title, value, icon, color, delay, flash = false }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
            className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center ${flash ? 'animate-pulse' : ''}`}
        >
            <div className={`p-4 rounded-full ${color}`}>
                {icon}
            </div>
            <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <motion.h4
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.2 }}
                    className="text-2xl font-bold text-gray-900"
                >
                    {value}
                </motion.h4>
            </div>
        </motion.div>
    );
}
