import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { subMonths, format, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AnimatedNumber = ({ value }: { value: number }) => {
    const [display, setDisplay] = useState(value);
    useEffect(() => {
        let startTimestamp: number;
        const duration = 600;
        const startValue = display;
        const difference = value - startValue;
        if (difference === 0) return;
        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - Math.min(progress, 1), 4);
            setDisplay(Math.round(startValue + difference * easeOutQuart));
            if (progress < 1) requestAnimationFrame(step);
            else setDisplay(value);
        };
        requestAnimationFrame(step);
    }, [value]);
    return <>{display}</>;
};
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

// --- SWR FETCHER ---
const fetchDashboardData = async ([_key, activeUnitId, dateRange, needsPendentes]: [string, string, { start: string, end: string }, boolean]) => {
    if (!activeUnitId) throw new Error("No active unit");

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const startStr = dateRange.start + 'T00:00:00';
    const endStr = dateRange.end + 'T23:59:59';
    const startD = new Date(startStr);
    const endD = new Date(endStr);

    const [
        studentsResult,
        pendentesResult,
        cancelsResult,
        transfersResult
    ] = await Promise.all([
        supabase
            .from('students')
            .select('id, status, education_level, created_at, full_name, serie, spoke_with_coordination, coordination_reversed, spoke_with_direction, categoria_motivo')
            .eq('unit_id', activeUnitId)
            .eq('is_deleted', false)
            .gte('created_at', startD.toISOString())
            .lte('created_at', endD.toISOString())
            .order('created_at', { ascending: false }),

        needsPendentes
            ? supabase
                .from('student_reasons')
                .select('id, students!inner(unit_id, is_deleted)', { count: 'exact', head: true })
                .eq('approval_status', 'pending')
                .eq('students.unit_id', activeUnitId)
                .eq('students.is_deleted', false)
            : Promise.resolve({ count: 0 }),

        supabase.from('students').select('id', { count: 'exact', head: true })
            .eq('unit_id', activeUnitId).eq('is_deleted', false).eq('status', 'cancelamento'),

        supabase.from('students').select('id', { count: 'exact', head: true })
            .eq('unit_id', activeUnitId).eq('is_deleted', false).eq('status', 'transferencia')
    ]);

    const students = studentsResult.data || [];
    const pendentesCount = pendentesResult.count || 0;
    const totalCancels = cancelsResult.count || 0;
    const totalTransfers = transfersResult.count || 0;

    const monthMap = new Map();
    let loopDate = new Date(endD);
    loopDate.setDate(1);
    loopDate.setHours(0, 0, 0, 0);
    const startMonth = new Date(startD);
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);

    while (loopDate >= startMonth) {
        const ym = format(loopDate, 'yyyy-MM');
        monthMap.set(ym, { name: format(loopDate, 'MMM/yy', { locale: ptBR }), yearMonth: ym, Cancelamentos: 0, Transferências: 0 });
        loopDate.setMonth(loopDate.getMonth() - 1);
    }

    const lvlMap: Record<string, number> = {};
    const catMap: Record<string, { cancelamentos: number, transferencias: number }> = {};
    let spokeCoord = 0, reverted = 0, spokeDir = 0, mesAtualCount = 0;

    students.forEach(s => {
        const dText = format(parseISO(s.created_at), 'yyyy-MM');
        if (monthMap.has(dText)) {
            const g = monthMap.get(dText);
            if (s.status === 'cancelamento') g.Cancelamentos++;
            if (s.status === 'transferencia') g.Transferências++;
        }

        const nm = levelsMap[s.education_level] || s.education_level;
        lvlMap[nm] = (lvlMap[nm] || 0) + 1;

        const cat = s.categoria_motivo || 'Não Informado';
        if (!catMap[cat]) catMap[cat] = { cancelamentos: 0, transferencias: 0 };
        if (s.status === 'cancelamento') catMap[cat].cancelamentos++;
        else if (s.status === 'transferencia') catMap[cat].transferencias++;

        if (s.spoke_with_coordination) spokeCoord++;
        if (s.coordination_reversed) reverted++;
        if (s.spoke_with_direction) spokeDir++;

        if (new Date(s.created_at) >= currentMonthStart) mesAtualCount++;
    });

    const totalS = students.length || 1;
    const totalCoord = spokeCoord || 1;

    const processedCategories = Object.entries(catMap)
        .map(([name, counts]) => {
            const total = counts.cancelamentos + counts.transferencias;
            return {
                name,
                Cancelamentos: counts.cancelamentos,
                Transferências: counts.transferencias,
                total,
                percent: students.length > 0 ? Math.round((total / students.length) * 100) : 0
            };
        })
        .filter(cat => cat.total > 0)
        .sort((a, b) => b.total - a.total);

    return {
        metrics: {
            cancelamentos: totalCancels,
            transferencias: totalTransfers,
            pendentes: pendentesCount,
            mesAtual: mesAtualCount,
        },
        chartData: Array.from(monthMap.values()),
        levelData: Object.entries(lvlMap).map(([name, value]) => ({ name, value })),
        categoryData: processedCategories,
        indicators: {
            coord: Math.round((spokeCoord / totalS) * 100),
            revert: Math.round((reverted / totalCoord) * 100),
            dir: Math.round((spokeDir / totalS) * 100),
        },
        recent: students.slice(0, 5)
    };
};
// --- END FETCHER ---

export function Dashboard() {
    const { activeUnitId, hasPrivilege, units } = useAuth();
    const activeUnit = units.find(u => u.id === activeUnitId);

    const [dateRange, setDateRange] = useState({
        start: format(subMonths(new Date(), 5), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas as Categorias');
    const [periodSelect, setPeriodSelect] = useState<string>('Últimos 6 Meses');

    const needsPendentes = hasPrivilege('admin') || hasPrivilege('diretor') || hasPrivilege('coordenacao');

    const { data, isLoading } = useSWR(
        activeUnitId ? ['dashboard', activeUnitId, dateRange, needsPendentes] : null,
        fetchDashboardData,
        {
            revalidateOnFocus: false, // Evita refetches excessivos ao trocar de aba do navegador
            dedupingInterval: 60000 // Usa cache em vez de refetch por 1 minuto
        }
    );

    // Default values se 'data' ainda não estiver pronto
    const {
        metrics = { cancelamentos: 0, transferencias: 0, pendentes: 0, mesAtual: 0 },
        chartData = [],
        levelData = [],
        categoryData = [],
        indicators = { coord: 0, revert: 0, dir: 0 },
        recent = []
    } = data || {};

    // Auto-reset category if the selected one is no longer in the filtered data range
    useEffect(() => {
        if (selectedCategory !== 'Todas as Categorias') {
            const categoryExists = categoryData.some((c: any) => c.name === selectedCategory && (c.Cancelamentos > 0 || c.Transferências > 0));
            if (!categoryExists) {
                setSelectedCategory('Todas as Categorias');
            }
        }
    }, [categoryData, selectedCategory]);

    if (isLoading && !data) {
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
                                <Pie
                                    data={levelData}
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={5}
                                    dataKey="value"
                                    isAnimationActive={true}
                                    label={(props: any) => {
                                        if (!props || typeof props.percent !== 'number') return null;
                                        const { cx, cy, midAngle, outerRadius, percent, value } = props;
                                        const RADIAN = Math.PI / 180;
                                        // Puxa o rótulo com segurança para a borda externa permitindo a linha de conexão se formar
                                        const rInfo = (outerRadius || 75) + 25;
                                        const angle = midAngle || 0;
                                        const x = cx + rInfo * Math.cos(-angle * RADIAN);
                                        const y = cy + rInfo * Math.sin(-angle * RADIAN);

                                        return (
                                            <text
                                                x={x}
                                                y={y}
                                                fill="#374151"
                                                textAnchor={x > cx ? 'start' : 'end'}
                                                dominantBaseline="central"
                                                className="text-[12px] font-bold"
                                            >
                                                {`${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                                            </text>
                                        );
                                    }}
                                    labelLine={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '2 2' }}
                                >
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
                            recent.map((s) => (
                                <div
                                    key={s.id}
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
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Seção 6: Análise de Motivos */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
                    className="bg-white p-6 rounded-2xl shadow-sm lg:col-span-3 flex flex-col"
                >
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h3 className="text-xl font-bold text-gray-800">Análise por Categoria de Motivo</h3>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full sm:w-auto rounded-lg border border-gray-300 py-2.5 pl-4 pr-10 text-sm font-medium focus:border-objetivo-blue focus:outline-none focus:ring-2 focus:ring-objetivo-blue/20 bg-gray-50 shadow-sm"
                            >
                                <option value="Todas as Categorias">Todas as Categorias</option>
                                {categoryData.filter((c: any) => c.Cancelamentos > 0 || c.Transferências > 0).map((cat: any) => (
                                    <option key={cat.name} value={cat.name}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={periodSelect}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPeriodSelect(val);
                                    const end = format(new Date(), 'yyyy-MM-dd');
                                    if (val === 'Mês Atual') setDateRange({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end });
                                    else if (val === 'Últimos 3 Meses') setDateRange({ start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'), end });
                                    else if (val === 'Últimos 6 Meses') setDateRange({ start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'), end });
                                }}
                                className="w-full sm:w-auto rounded-lg border border-gray-300 py-2.5 pl-4 pr-10 text-sm font-medium focus:border-objetivo-blue focus:outline-none focus:ring-2 focus:ring-objetivo-blue/20 bg-gray-50 shadow-sm"
                            >
                                <option value="Mês Atual">Mês Atual</option>
                                <option value="Últimos 3 Meses">Últimos 3 Meses</option>
                                <option value="Últimos 6 Meses">Últimos 6 Meses</option>
                                <option value="Personalizado" hidden>Personalizado</option>
                            </select>
                        </div>
                    </div>

                    {/* Body */}
                    {(() => {
                        let currCancels = 0;
                        let currTransfers = 0;

                        if (selectedCategory === 'Todas as Categorias') {
                            currCancels = categoryData.reduce((acc: number, c: any) => acc + c.Cancelamentos, 0);
                            currTransfers = categoryData.reduce((acc: number, c: any) => acc + c.Transferências, 0);
                        } else {
                            const found = categoryData.find((c: any) => c.name === selectedCategory);
                            if (found) {
                                currCancels = found.Cancelamentos;
                                currTransfers = found.Transferências;
                            }
                        }

                        const categoryTotal = currCancels + currTransfers;
                        const cancelPerc = categoryTotal > 0 ? Math.round((currCancels / categoryTotal) * 100) : 0;
                        const transferPerc = categoryTotal > 0 ? Math.round((currTransfers / categoryTotal) * 100) : 0;

                        return (
                            <div className="flex flex-col lg:flex-row gap-8">
                                {/* 40% Left Column */}
                                <div className="w-full lg:w-[40%] flex flex-col justify-center">
                                    <div className="flex flex-col border border-gray-100 bg-gray-50/50 p-4 rounded-2xl gap-4 relative">
                                        {/* Cancelamentos Card */}
                                        <div className="bg-[#b91c1c] rounded-xl p-5 text-white flex flex-col items-center justify-center relative shadow-md h-[180px]">
                                            <UserMinus className="w-6 h-6 absolute top-4 left-4 opacity-80" />
                                            <div className="text-[48px] leading-none font-bold mt-2">
                                                <AnimatedNumber value={currCancels} />
                                            </div>
                                            <div className="text-[24px] font-semibold mt-1 opacity-90"><AnimatedNumber value={cancelPerc} />%</div>
                                            <div className="text-sm font-medium opacity-80 mt-1 uppercase tracking-wider">Cancelamentos</div>
                                        </div>

                                        {/* Divider */}
                                        <div className="w-full h-px border-b border-dashed border-gray-300"></div>

                                        {/* Transferências Card */}
                                        <div className="bg-[#1e3a8a] rounded-xl p-5 text-white flex flex-col items-center justify-center relative shadow-md h-[180px]">
                                            <ArrowRightLeft className="w-6 h-6 absolute top-4 left-4 opacity-80" />
                                            <div className="text-[48px] leading-none font-bold mt-2">
                                                <AnimatedNumber value={currTransfers} />
                                            </div>
                                            <div className="text-[24px] font-semibold mt-1 opacity-90"><AnimatedNumber value={transferPerc} />%</div>
                                            <div className="text-sm font-medium opacity-80 mt-1 uppercase tracking-wider">Transferências</div>
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-500 mt-6 font-medium text-center">
                                        Total geral: <span className="font-bold text-gray-700"><AnimatedNumber value={categoryTotal} /></span> casos no período
                                    </p>
                                </div>

                                {/* 60% Right Column - Donut Chart */}
                                <div className="w-full lg:w-[60%] flex flex-col items-center justify-center min-h-[350px] relative mt-4 lg:mt-0">
                                    {categoryTotal === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                                            {/* Empty Donut Visual Placeholder */}
                                            <div className="w-[220px] h-[220px] rounded-full border-[30px] border-gray-100 flex items-center justify-center">
                                                <AlertCircle className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <span className="font-medium mt-2">Sem dados no período</span>
                                        </div>
                                    ) : (
                                        <div className="w-full h-[320px] relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Cancelamentos', value: currCancels, fill: '#dc2626' },
                                                            { name: 'Transferências', value: currTransfers, fill: '#2563eb' }
                                                        ].filter(d => d.value > 0)}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={110}
                                                        dataKey="value"
                                                        isAnimationActive={true}
                                                        animationDuration={600}
                                                        animationEasing="ease-out"
                                                        label={(props: any) => {
                                                            const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
                                                            if (typeof percent !== 'number') return null;
                                                            const RADIAN = Math.PI / 180;
                                                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                            return (
                                                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize="16">
                                                                    {`${(percent * 100).toFixed(0)}%`}
                                                                </text>
                                                            );
                                                        }}
                                                        labelLine={false}
                                                    >
                                                        {[
                                                            { name: 'Cancelamentos', value: currCancels, fill: '#dc2626' },
                                                            { name: 'Transferências', value: currTransfers, fill: '#2563eb' }
                                                        ].filter(d => d.value > 0).map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip formatter={(val: any) => [val, 'casos']} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            {/* Center Text */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-4xl font-extrabold text-gray-800 tracking-tight leading-none"><AnimatedNumber value={categoryTotal} /></span>
                                                <span className="text-sm font-medium text-gray-500 mt-1">casos</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-row items-center justify-center gap-6 mt-6 shrink-0 text-sm font-semibold text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 rounded-full bg-[#dc2626] shadow-sm"></span>
                                            Cancelamento de Matrícula
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 rounded-full bg-[#2563eb] shadow-sm"></span>
                                            Transferência
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
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
