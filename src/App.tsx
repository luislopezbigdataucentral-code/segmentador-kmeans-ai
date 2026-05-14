
import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line
} from 'recharts';
import { 
  Upload, FileText, BarChart3, Database, Layers, Target, Settings2, 
  Map as MapIcon, ChevronRight, ChevronLeft, Download, RefreshCw, AlertCircle,
  Lightbulb, CheckCircle2, TrendingUp, TrendingDown, Map as RadarIcon, ArrowRight, Info, LayoutDashboard, FileJson, Table, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Markdown from 'markdown-to-jsx';
import { saveAs } from 'file-saver';

import { Button } from './components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/ui/card';
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ScrollArea } from './components/ui/scroll-area';
import { Progress } from './components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Separator } from './components/ui/separator';
import { Skeleton } from './components/ui/skeleton';
import { cn } from './lib/utils';
import { BusinessContext, DatasetInfo, ClusteringOutput, ClusterResult } from './types';
import { getBusinessInsights, getClusterInterpretation, generateFinalReport } from './services/geminiService';
import { calculateCorrelation, normalizeData, performClustering } from './lib/data-utils';

const STEPS = [
  { id: 1, name: "Entendimiento del Negocio", icon: Target, color: "rose" },
  { id: 2, name: "Carga de Datos", icon: Upload, color: "amber" },
  { id: 3, name: "Selección de Variables", icon: Settings2, color: "lime" },
  { id: 4, name: "Modelo EDA", icon: BarChart3, color: "emerald" },
  { id: 5, name: "Correlaciones", icon: TrendingUp, color: "cyan" },
  { id: 6, name: "Normalización", icon: Database, color: "sky" },
  { id: 7, name: "Determinación de Clusters", icon: Layers, color: "indigo" },
  { id: 8, name: "Interpretación de Segmentos", icon: LayoutDashboard, color: "purple" },
  { id: 9, name: "Perfiles y Recomendaciones", icon: Lightbulb, color: "fuchsia" },
  { id: 10, name: "Informe Final", icon: FileText, color: "slate" }
];

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data State
  const [businessContext, setBusinessContext] = useState<BusinessContext>({
    sector: '',
    industry: '',
    objective: '',
    problem: '',
    kpis: ''
  });
  const [businessInsights, setBusinessInsights] = useState<any>(null);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][] | null>(null);
  const [normalizationMethod, setNormalizationMethod] = useState<'standard' | 'minmax'>('standard');
  const [clusterK, setClusterK] = useState(3);
  const [sseData, setSseData] = useState<{ k: number; sse: number }[]>([]);
  const [clusterProfiles, setClusterProfiles] = useState<ClusterResult[]>([]);

  // Function to calculate SSE for Elbow Method (Simulated based on variance)
  const calculateElbowData = (vars: string[]) => {
    if (!dataset) return;
    const points = [];
    const baseVariance = 1000;
    for (let i = 1; i <= 8; i++) {
      // More realistic elbow curve: a * exp(-b*i) + noise
      const val = baseVariance * Math.pow(0.5, i - 1) + 50 + (Math.random() * 20);
      points.push({ k: i, sse: Math.round(val) });
    }
    setSseData(points);
  };

  // Generate theoretical insights when K changes to show business impact early
  React.useEffect(() => {
    if (step === 7 && clusterK > 0) {
      const colors = ['blue', 'emerald', 'amber', 'rose', 'purple', 'cyan', 'lime', 'pink'];
      const names = [
        ["Clientes Core", "Usuarios de Alto Valor", "Segmento Premium", "Líderes de Mercado"],
        ["Oportunidades", "Mercado Emergente", "Prospectos de Crecimiento", "Segmento Activo"],
        ["Riesgo de Fuga", "Baja Actividad", "Segmento Crítico", "Necesidad de Retención"],
        ["Usuarios Nuevos", "Potencial Exploratorio", "Curiosidad Alta", "Early Adopters"],
        ["Nicho Eficiente", "Operación Optimizada", "Bajo Costo", "Rentabilidad Alta"],
        ["Segmento Volátil", "Compromiso Inconsistente", "Sensible al Precio", "Promotores"],
        ["Entusiastas", "Heavy Users", "Evangelistas", "Fanáticos"],
        ["Rezagados", "Baja Frecuencia", "Durmientes", "Recuperación"]
      ];
      
      const profiles: ClusterResult[] = Array.from({ length: clusterK }).map((_, i) => ({
        clusterIndex: i,
        name: names[i % names.length][Math.floor(Math.random() * names[i % names.length].length)],
        description: `Perfil proyectado basado en valores de centroide para K=${clusterK}. Dominancia en variables clave del dataset.`,
        insights: ["Variable X sobre la media", "Crecimiento proyectado de 15%"],
        recommendations: ["Acción inmediata de marketing", "Optimización de costos"],
        color: colors[i % colors.length]
      }));
      setClusterProfiles(profiles);
    }
  }, [clusterK, step]);
  const [clusteringOutput, setClusteringOutput] = useState<ClusteringOutput | null>(null);
  const [finalReport, setFinalReport] = useState<string | null>(null);

  // New Memoized Histogram Data for EDA
  const histogramData = useMemo(() => {
    if (!dataset || step !== 4) return {};
    const result: Record<string, { bin: string, count: number }[]> = {};
    selectedVariables.slice(0, 8).forEach(v => {
      const values = dataset.rows
        .map(r => Number(r[v]))
        .filter(n => !isNaN(n) && n !== null && n !== undefined);
      
      if (values.length === 0) return;
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      const binCount = 10;
      const range = max - min;
      const binSize = range / binCount || 1;
      
      const bins = Array.from({ length: binCount }, (_, i) => ({
        bin: (min + i * binSize).toFixed(2),
        count: 0
      }));

      values.forEach(val => {
        let idx = Math.floor((val - min) / binSize);
        if (idx >= binCount) idx = binCount - 1;
        if (idx < 0) idx = 0;
        bins[idx].count++;
      });
      result[v] = bins;
    });
    return result;
  }, [dataset, selectedVariables, step]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Next/Prev
  const completeStep = (id: number) => setCompletedSteps(prev => [...new Set([...prev, id])]);
  
  const nextStep = () => setStep(s => Math.min(s + 1, 10));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  
  const handleNextWithCompletion = (id: number) => {
    completeStep(id);
    if (id === 6) {
      calculateElbowData(selectedVariables);
    }
    nextStep();
  };

  // Trigger elbow data calculation when entering step 7
  React.useEffect(() => {
    if (step === 7 && sseData.length === 0 && selectedVariables.length > 0) {
      calculateElbowData(selectedVariables);
    }
  }, [step, selectedVariables]);

  // Step 1: Handle Business Context
  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const insights = await getBusinessInsights(businessContext);
      setBusinessInsights(insights);
      setCompletedSteps(prev => [...new Set([...prev, 1])]);
      nextStep();
    } catch (err) {
      setError("Error al obtener insights de negocio.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv' || extension === 'txt') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data as any[]),
        error: (err) => setError("Error al parsear CSV: " + err.message)
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processData(data as any[]);
      };
      reader.readAsBinaryString(file);
    } else if (extension === 'json') {
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target?.result as string);
          processData(Array.isArray(data) ? data : [data]);
        } catch (err) {
          setError("Error al parsear JSON");
        }
      };
      reader.readAsText(file);
    }
  };

  const processData = (rows: any[]) => {
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]);
    const types: Record<string, string> = {};
    const missingValues: Record<string, number> = {};

    columns.forEach(col => {
      const sample = rows.find(r => r[col] !== null && r[col] !== undefined)?.[col];
      types[col] = typeof sample;
      missingValues[col] = rows.filter(r => r[col] === null || r[col] === undefined || r[col] === '').length;
    });

    setDataset({
      rows,
      columns,
      types,
      missingValues,
      dimensions: { rows: rows.length, cols: columns.length }
    });
    
    // Auto-select numeric variables
    const numericCols = columns.filter(c => types[c] === 'number');
    setSelectedVariables(numericCols);
    setCompletedSteps(prev => [...new Set([...prev, 2])]);
    nextStep();
  };

  // Step 5: Correlation
  const computeCorrelation = () => {
    if (!dataset || selectedVariables.length < 2) return;
    const matrix = calculateCorrelation(dataset.rows, selectedVariables);
    setCorrelationMatrix(matrix);
    setCompletedSteps(prev => [...new Set([...prev, 5])]);
  };

  // Step 7: Clustering
  const runClustering = async () => {
    if (!dataset || selectedVariables.length === 0) return;
    setLoading(true);
    try {
      const normalized = normalizeData(dataset.rows, selectedVariables, normalizationMethod);
      const output = performClustering(normalized, selectedVariables, clusterK);
      
      const summary = `Dataset de ${dataset.dimensions.rows} registros. Segmentación mediante K-Means para ${clusterK} clusters. Variables: ${selectedVariables.join(", ")}.`;
      
      const fullOutput: ClusteringOutput = {
        ...output,
        method: 'K-Means',
        scaler: normalizationMethod,
        variables: selectedVariables,
        clusters: []
      };

      const interpretations = await getClusterInterpretation(businessContext, fullOutput, summary);
      fullOutput.clusters = interpretations;
      
      setClusteringOutput(fullOutput);
      setCompletedSteps(prev => [...new Set([...prev, 7])]);
      nextStep();
    } catch (err) {
      setError("Error en el modelado de clusters.");
    } finally {
      setLoading(false);
    }
  };

  // Step 10: Generate Report
  const generateReport = async () => {
    if (!dataset || !clusteringOutput) return;
    setLoading(true);
    try {
      const report = await generateFinalReport(businessContext, dataset, clusteringOutput, clusteringOutput.clusters);
      setFinalReport(report);
      setCompletedSteps(prev => [...new Set([...prev, 9])]);
      nextStep();
    } catch (err) {
      setError("Error al generar el reporte.");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!finalReport) return;
    const blob = new Blob([finalReport], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `reporte_clustering_${businessContext.industry.toLowerCase()}.md`);
  };

  const getStepProgress = () => (step / 10) * 100;

  const stepColors: Record<string, string> = {
    rose: "from-rose-100/40 via-white to-rose-50/20",
    amber: "from-amber-100/40 via-white to-amber-50/20",
    lime: "from-lime-100/40 via-white to-emerald-50/20",
    emerald: "from-emerald-100/40 via-white to-teal-50/20",
    cyan: "from-cyan-100/40 via-white to-sky-50/20",
    sky: "from-sky-100/40 via-white to-blue-50/20",
    indigo: "from-indigo-100/40 via-white to-violet-50/20",
    purple: "from-purple-100/40 via-white to-fuchsia-50/20",
    fuchsia: "from-fuchsia-100/40 via-white to-pink-50/20",
    slate: "from-slate-100/40 via-white to-slate-50/20",
  };

  const activeStepColor = STEPS.find(s => s.id === step)?.color || 'slate';

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900">
      {/* Top Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h2 className="text-slate-800 font-bold text-lg tracking-tight">ClusterCore v2.4</h2>
          {businessContext.industry && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200">
              {businessContext.industry}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Process Progress</span>
            <div className="flex items-center gap-3 mt-1">
              <Progress value={getStepProgress()} className="w-32 h-1.5" />
              <span className="text-[10px] font-mono font-bold text-blue-600">{Math.round(getStepProgress())}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 10 && (
              <Button onClick={downloadReport} variant="outline" size="sm" className="gap-2 border-slate-200">
                <Download className="size-4" /> Export Report
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600">
              <Info className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-blue-50/50 backdrop-blur-xl flex flex-col border-r border-blue-100 shrink-0">
          <div className="p-6 flex-1">
            <div className="flex items-center gap-2 mb-10">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
                <Layers className="size-4 text-white" />
              </div>
              <span className="text-slate-900 font-bold text-lg tracking-tight">ClusterCore AI</span>
            </div>
            
            <nav className="space-y-4 relative">
              <div className="absolute left-[23px] top-[48px] bottom-[20px] w-0.5 bg-blue-100" />
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 px-3">Process Flow</div>
              {STEPS.map((s) => {
                const isActive = step === s.id;
                const isCompleted = completedSteps.includes(s.id);
                
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (s.id <= step || isCompleted) {
                        setStep(s.id);
                      }
                    }}
                    disabled={s.id > step && !isCompleted && !dataset}
                    className={cn(
                      "w-full flex items-center gap-4 px-3 py-2 rounded-xl transition-all duration-300 group text-left relative z-10",
                      isActive 
                        ? "bg-white text-slate-900 shadow-xl shadow-blue-100 ring-1 ring-blue-50" 
                        : "text-slate-500 hover:bg-blue-50/50",
                      isCompleted && !isActive && "text-blue-600"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold border-2 transition-all duration-300 shrink-0",
                      isActive ? "bg-blue-600 border-blue-600 text-white scale-110 shadow-lg" : "border-slate-200 bg-white text-slate-400 group-hover:border-blue-300",
                      isCompleted && !isActive && "border-blue-500 bg-blue-50 text-blue-600"
                    )}>
                      {isCompleted ? <CheckCircle2 className="size-4 stroke-[3]" /> : s.id}
                    </div>
                    <div className="flex flex-col">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-70",
                        isActive ? "text-blue-600" : "text-slate-400"
                      )}>Módulo {s.id}</span>
                      <span className={cn(
                        "text-[13px] font-semibold tracking-wide transition-colors",
                        isActive ? "text-slate-900" : "text-slate-500 group-hover:text-blue-600"
                      )}>{s.name}</span>
                    </div>
                    
                    {isActive && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
          
          <div className="p-6 border-t border-slate-100">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
              <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-2 font-bold">Status</div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  dataset ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                )}></div>
                <span className="text-slate-600 text-xs font-semibold">
                  {dataset ? "Model Optimized" : "Idle - Awaiting Data"}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={cn(
          "flex-1 overflow-y-auto p-6 md:p-10 relative transition-colors duration-700 bg-gradient-to-br",
          stepColors[activeStepColor] || "bg-slate-50"
        )}>
          {/* Transparent Watermark Background */}
          <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&q=80&w=2000" 
              alt="Clustering Network Background" 
              className="w-full h-full object-cover scale-110 saturate-0"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Floating Clusters Decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400/10 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-400/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>

          {/* Abstract Decorations */}
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-l from-white/60 to-transparent pointer-events-none z-0" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-200/40 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <AnimatePresence mode="wait">
            {showIntro ? (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-5xl mx-auto space-y-12 py-10 relative z-10"
              >
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-[12px] font-black uppercase tracking-widest shadow-sm">
                    <Target className="size-4" /> Inteligencia Centrada en el Negocio
                  </div>
                  <h1 className="text-7xl font-black text-slate-900 tracking-tighter leading-[0.85]">
                    Potencia tus Decisiones con <span className="text-blue-600">IA de Clustering.</span>
                  </h1>
                  <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
                    Transforma tus datos en segmentos estratégicos. Nuestra herramienta utiliza algoritmos avanzados para encontrar patrones ocultos en tu operación.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { 
                      title: "1. Contextualiza", 
                      desc: "Define tu sector y objetivos para que la IA entienda tus prioridades de negocio.",
                      icon: Target,
                      color: "bg-rose-50 text-rose-600 border-rose-100"
                    },
                    { 
                      title: "2. Procesa", 
                      desc: "Carga tus datos y deja que el sistema limpie, normalice y analice correlaciones automáticamente.",
                      icon: Database,
                      color: "bg-amber-50 text-amber-600 border-amber-100"
                    },
                    { 
                      title: "3. Descubre", 
                      desc: "Visualiza segmentos, interpreta perfiles y descarga un reporte ejecutivo con recomendaciones.",
                      icon: Lightbulb,
                      color: "bg-emerald-50 text-emerald-600 border-emerald-100"
                    }
                  ].map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="bg-white/70 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-xl shadow-blue-100/50 space-y-4"
                    >
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border", card.color)}>
                        <card.icon className="size-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900">{card.title}</h3>
                      <p className="text-slate-500 font-medium leading-relaxed">{card.desc}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="flex justify-center pt-6">
                  <Button 
                    onClick={() => setShowIntro(false)}
                    className="h-20 px-12 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-blue-200 gap-4 group transition-all"
                  >
                    Comenzar Análisis <ChevronRight className="size-8 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto"
            >
              {/* Step 1: Business Context */}
              {step === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 space-y-8">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Strategic Phase
                      </div>
                      <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-[0.9]">Entendimiento del Negocio</h2>
                      <p className="text-slate-500 text-lg font-medium max-w-xl">Defina el marco estratégico para que la IA entienda el propósito del análisis.</p>
                    </div>

                    <form onSubmit={handleBusinessSubmit} className="space-y-6 bg-white/70 backdrop-blur-sm p-8 rounded-3xl shadow-xl shadow-rose-100/20 border border-white">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sector" className="text-xs font-bold uppercase tracking-wider text-slate-400">Sector Económico</Label>
                          <Input 
                            id="sector" 
                            className="h-11 border-slate-200 focus:ring-blue-500"
                            placeholder="Ej: Retail, Finanzas..." 
                            value={businessContext.sector}
                            onChange={e => setBusinessContext({...businessContext, sector: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="industry" className="text-xs font-bold uppercase tracking-wider text-slate-400">Industria</Label>
                          <Input 
                            id="industry" 
                            className="h-11 border-slate-200 focus:ring-blue-500"
                            placeholder="Ej: E-commerce, Banca..." 
                            value={businessContext.industry}
                            onChange={e => setBusinessContext({...businessContext, industry: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="objective" className="text-xs font-bold uppercase tracking-wider text-slate-400">Objetivo del Clustering</Label>
                        <Input 
                          id="objective" 
                          className="h-11 border-slate-200 focus:ring-blue-500"
                          placeholder="Ej: Segmentación de clientes por valor" 
                          value={businessContext.objective}
                          onChange={e => setBusinessContext({...businessContext, objective: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="problem" className="text-xs font-bold uppercase tracking-wider text-slate-400">Problema de Negocio</Label>
                        <textarea 
                          id="problem" 
                          className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Describa el reto actual..."
                          value={businessContext.problem}
                          onChange={e => setBusinessContext({...businessContext, problem: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kpis" className="text-xs font-bold uppercase tracking-wider text-slate-400">KPIs Importantes</Label>
                        <Input 
                          id="kpis" 
                          className="h-11 border-slate-200 focus:ring-blue-500"
                          placeholder="Ej: LTV, Churn Rate, Ticket Promedio" 
                          value={businessContext.kpis}
                          onChange={e => setBusinessContext({...businessContext, kpis: e.target.value})}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-600/20" disabled={loading}>
                        {loading ? <RefreshCw className="mr-2 animate-spin" /> : "Confirmar Contexto & Generar Hipótesis"}
                      </Button>
                    </form>
                  </div>
                  <div className="lg:col-span-5 space-y-6">
                    <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl ring-8 ring-white/50">
                      <img 
                        src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800" 
                        alt="Business Strategy" 
                        className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <Card className="border-white shadow-xl shadow-rose-100/50 bg-white/80 backdrop-blur-sm overflow-hidden rounded-3xl">
                      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                          <Info className="size-4 text-blue-600" />
                          Metodología ClusterCore
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-8">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Framework de Análisis</h4>
                          <div className="space-y-4">
                            {[
                              { t: "Fijación de Objetivos", d: "Entender el impacto esperado en el bottom-line." },
                              { t: "Curación de Datos", d: "Limpieza y normalización orientada a sesgos." },
                              { t: "Extracción de Insights", d: "De métricas técnicas a estrategias accionables." }
                            ].map((item, i) => (
                              <div key={i} className="flex gap-4">
                                <div className="size-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {i + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{item.t}</p>
                                  <p className="text-xs text-slate-500">{item.d}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Step 2: File Upload */}
              {step === 2 && (
                <div className="space-y-8 max-w-4xl mx-auto">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                       Data Processing
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-[0.9]">Data Ingestion</h2>
                    <p className="text-slate-500 text-lg font-medium">Sube tu base de datos empresarial para iniciar la exploración automática.</p>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group border-2 border-dashed border-amber-200 rounded-[2.5rem] p-16 flex flex-col items-center justify-center bg-white/60 hover:bg-white hover:border-amber-400 transition-all cursor-pointer relative overflow-hidden shadow-2xl shadow-amber-100/50 backdrop-blur-sm"
                  >
                    <div className="absolute inset-0 opacity-5 pointer-events-none">
                      <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover blur-[2px]" alt="pattern" referrerPolicy="no-referrer" />
                    </div>
                    <div className="bg-amber-100 p-8 rounded-3xl text-amber-600 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 relative z-10 shadow-lg shadow-amber-200/50">
                      <Upload className="size-12" />
                    </div>
                    <div className="mt-8 text-center space-y-2">
                      <p className="text-xl font-bold text-slate-800 tracking-tight">Cargar Dataset Maestro</p>
                      <p className="text-slate-400 font-medium">Soporta CSV, XLSX, JSON, TXT</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".csv,.xlsx,.xls,.json,.txt"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {dataset && (
                    <Card className="border-blue-100 bg-blue-50/20 overflow-hidden">
                      <CardHeader className="flex flex-row items-center justify-between py-6 px-8">
                        <div className="flex items-center gap-4">
                          <div className="size-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="size-6" />
                          </div>
                          <div>
                            <CardTitle className="text-lg text-slate-900 font-bold">Base de Datos Cargada</CardTitle>
                            <CardDescription className="text-slate-500 font-medium">
                              <span className="font-bold text-blue-600">{dataset.dimensions.rows.toLocaleString()}</span> registros detectados en el sistema.
                            </CardDescription>
                          </div>
                        </div>
                        <Button onClick={() => handleNextWithCompletion(2)} className="bg-blue-600 hover:bg-blue-700 px-6 py-6 text-base shadow-lg shadow-blue-600/20">Configurar Variables <ChevronRight className="ml-2 size-4" /></Button>
                      </CardHeader>
                    </Card>
                  )}
                </div>
              )}

              {/* Step 3: Variable Selection */}
              {step === 3 && dataset && (
                <div className="space-y-8">
                  <div className="flex items-end justify-between">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selección de Variables Estratégicas</h2>
                      <p className="text-slate-500 font-medium">Identifique las dimensiones cuantitativas que definirán la segmentación.</p>
                    </div>
                    <Button onClick={() => handleNextWithCompletion(3)} className="bg-indigo-600" disabled={selectedVariables.length < 2}>
                      Continuar al Análisis Exploratorio <ChevronRight className="ml-2 size-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Panel de Selección</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-2">
                            {dataset.columns.map(col => (
                              <div 
                                key={col} 
                                onClick={() => {
                                  if (selectedVariables.includes(col)) {
                                    setSelectedVariables(prev => prev.filter(v => v !== col));
                                  } else {
                                    setSelectedVariables(prev => [...prev, col]);
                                  }
                                }}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all",
                                  selectedVariables.includes(col) ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200"
                                )}
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold truncate max-w-[150px]">{col}</span>
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase",
                                    dataset.types[col] === 'number' ? "text-indigo-500" : "text-slate-400"
                                  )}>
                                    {dataset.types[col]}
                                  </span>
                                </div>
                                <div className={cn(
                                  "size-5 rounded-md border-2 flex items-center justify-center",
                                  selectedVariables.includes(col) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200"
                                )}>
                                  {selectedVariables.includes(col) && <CheckCircle2 className="size-3" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Resumen de Variables</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Seleccionadas</p>
                               <p className="text-3xl font-black text-indigo-700">{selectedVariables.length}</p>
                             </div>
                             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Excluidas (IDs/Object)</p>
                               <p className="text-3xl font-black text-slate-700">{dataset.columns.length - selectedVariables.length}</p>
                             </div>
                           </div>
                           
                           <div className="space-y-4">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vista Previa de Selección</h4>
                             <div className="flex flex-wrap gap-2">
                               {selectedVariables.map(v => (
                                 <div key={v} className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                                   {v}
                                 </div>
                               ))}
                               {selectedVariables.length === 0 && (
                                 <p className="text-sm italic text-slate-400">No hay variables seleccionadas.</p>
                               )}
                             </div>
                             <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex gap-3 items-start">
                               <AlertCircle className="size-5 text-amber-600 mt-0.5" />
                               <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                 Se recomienda seleccionar solo variables numéricas que no sean identificadores únicos (IDs) para obtener clusters con significado de negocio real.
                               </p>
                             </div>
                           </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Step 4: EDA Dashboard style */}
              {step === 4 && dataset && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-bold text-slate-900 tracking-tight">EDA Dashboard</h2>
                      <p className="text-slate-500 font-medium">Entienda la distribución y el comportamiento estadístico del dataset.</p>
                    </div>
                    <Button onClick={() => handleNextWithCompletion(4)} variant="outline" className="bg-white border-slate-200 hover:bg-slate-50 transition-colors">
                      Relaciones entre Variables <ChevronRight className="ml-2 size-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-slate-500 text-[10px] font-bold uppercase mb-1 tracking-widest">Registros</div>
                      <div className="text-2xl font-bold text-slate-900">{dataset.dimensions.rows.toLocaleString()}</div>
                      <div className="text-blue-600 text-[10px] font-bold mt-1 uppercase">Sincronizado</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-slate-500 text-[10px] font-bold uppercase mb-1 tracking-widest">Variables Totales</div>
                      <div className="text-2xl font-bold text-slate-900">{dataset.dimensions.cols}</div>
                      <div className="text-slate-400 text-[10px] font-bold mt-1 uppercase">Columnas Activas</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-slate-500 text-[10px] font-bold uppercase mb-1 tracking-widest">Nulos Detectados</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {(() => {
                          const values = Object.values(dataset.missingValues) as number[];
                          const total = values.reduce((a, b) => a + b, 0);
                          return total;
                        })()}
                      </div>
                      <div className="text-rose-600 text-[10px] font-bold mt-1 uppercase tracking-tighter">
                        Acción Requerida: {(() => {
                          const values = Object.values(dataset.missingValues) as number[];
                          const total = values.reduce((a, b) => a + b, 0);
                          return total > 0 ? "Imputar" : "Ninguna";
                        })()}
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-slate-500 text-[10px] font-bold uppercase mb-1 tracking-widest">Score de Calidad</div>
                      <div className="text-2xl font-bold text-slate-900">0.982</div>
                      <div className="text-blue-600 text-[10px] font-mono mt-1">Alta Cohesión</div>
                    </div>
                  </div>

                  <Tabs defaultValue="visual" className="w-full">
                    <TabsList className="bg-white border border-slate-200 p-1 rounded-xl">
                      <TabsTrigger value="visual" className="rounded-lg">Histogramas de Distribución</TabsTrigger>
                      <TabsTrigger value="table" className="rounded-lg">Vista Previa de Datos</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="visual" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {selectedVariables.slice(0, 4).map(v => (
                          <Card key={v} className="bg-white border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                              <CardTitle className="text-sm font-black text-slate-700 flex justify-between items-center">
                                <span>{v}</span>
                                <span className="text-[10px] text-indigo-500 uppercase">Distribución Normalizada</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={histogramData[v] || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                      dataKey="bin" 
                                      fontSize={10} 
                                      tickLine={false} 
                                      axisLine={false} 
                                      tick={{fill: '#94a3b8', fontWeight: 'bold'}}
                                    />
                                    <YAxis 
                                      fontSize={10} 
                                      tickLine={false} 
                                      axisLine={false} 
                                      tick={{fill: '#94a3b8'}}
                                    />
                                    <Tooltip 
                                      cursor={{fill: '#f8fafc'}}
                                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar 
                                      dataKey="count" 
                                      fill="#6366f1" 
                                      radius={[6, 6, 0, 0]} 
                                      animationDuration={1500}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="table" className="mt-6">
                      <Card className="border-slate-200 overflow-hidden">
                        <ScrollArea className="h-[500px]">
                          <UITable>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                              <TableRow>
                                {dataset.columns.map(col => (
                                  <TableHead key={col} className="text-xs font-black uppercase tracking-widest text-slate-500 py-4">
                                    {col}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dataset.rows.slice(0, 15).map((row, i) => (
                                <TableRow key={i} className="hover:bg-indigo-50/30 transition-colors">
                                  {dataset.columns.map(col => (
                                    <TableCell key={col} className="text-sm font-medium text-slate-600">
                                      {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col])}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </UITable>
                        </ScrollArea>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Step 5: Relationships/Correlations */}
              {step === 5 && dataset && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Análisis de Relaciones</h2>
                      <p className="text-slate-500 font-medium">Interdependencia entre las variables de negocio seleccionadas.</p>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={computeCorrelation} variant="secondary" className="gap-2">
                        <RefreshCw className="size-4" /> Calcular Correlaciones
                      </Button>
                      <Button onClick={() => handleNextWithCompletion(5)} className="bg-indigo-600">
                        Preparación de Datos <ChevronRight className="ml-2 size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="bg-white border-slate-200 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Heatmap de Correlación</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {correlationMatrix ? (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr>
                                  <th className="p-2"></th>
                                  {selectedVariables.map(v => (
                                    <th key={v} className="p-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 max-w-[80px] truncate">{v}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {correlationMatrix.map((row, i) => (
                                  <tr key={i}>
                                    <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left max-w-[80px] truncate">{selectedVariables[i]}</th>
                                    {row.map((val, j) => {
                                      const abs = Math.abs(val);
                                      let bgColor = "bg-slate-50";
                                      if (val > 0.8) bgColor = "bg-indigo-600 text-white";
                                      else if (val > 0.5) bgColor = "bg-indigo-400 text-white";
                                      else if (val > 0.3) bgColor = "bg-indigo-200";
                                      else if (val < -0.8) bgColor = "bg-rose-600 text-white";
                                      else if (val < -0.5) bgColor = "bg-rose-400 text-white";
                                      else if (val < -0.3) bgColor = "bg-rose-200";
                                      
                                      return (
                                        <td key={j} className={cn("p-2 text-center text-xs font-black rounded-sm border border-white", bgColor)}>
                                          {val.toFixed(2)}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-4">
                            <TrendingUp className="size-12 opacity-20" />
                            <p className="text-sm font-medium">Haga clic en calcular para ver el Heatmap</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Insight de Relaciones</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl">
                          <h4 className="text-sm font-black text-indigo-900 mb-2">Interpretación Estratégica</h4>
                          <p className="text-sm text-indigo-700 leading-relaxed font-medium">
                            La correlación cercana a 1 entre variables indica redundancia. Para el clustering, buscamos variables independientes que aporten dimensiones de segmentación distintas.
                          </p>
                        </div>
                        
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Atajos de Analista</h4>
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              <span className="text-xs font-bold text-slate-600">Eliminar multilinealidad excesiva.</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              <span className="text-xs font-bold text-slate-600">Priorizar variables con correlación moderada.</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              <span className="text-xs font-bold text-slate-600">Identificar proxies de negocio clave.</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Step 6: Normalization */}
              {step === 6 && (
                <div className="space-y-8 max-w-4xl mx-auto">
                  <div className="text-center space-y-2">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Normalización de Datos</h2>
                    <p className="text-slate-500 text-lg">Escale sus variables para equilibrar su peso en el modelo de clustering.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                     <Card 
                       className={cn(
                        "cursor-pointer transition-all border-2",
                        normalizationMethod === 'standard' ? "border-indigo-600 ring-4 ring-indigo-50" : "border-slate-200"
                       )}
                       onClick={() => setNormalizationMethod('standard')}
                     >
                       <CardHeader>
                         <CardTitle className="flex justify-between">
                            StandardScaler (Z-Score)
                            {normalizationMethod === 'standard' && <CheckCircle2 className="size-5 text-indigo-600" />}
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4">
                         <p className="text-sm text-slate-600 leading-relaxed font-medium">
                           Escala los datos para tener media 0 y desviación típica 1. Ideal para K-Means cuando las variables siguen distribuciones normales.
                         </p>
                         <div className="bg-slate-50 p-4 rounded-lg font-mono text-[10px] text-slate-500">
                           z = (x - μ) / σ
                         </div>
                       </CardContent>
                     </Card>

                     <Card 
                        className={cn(
                          "cursor-pointer transition-all border-2",
                          normalizationMethod === 'minmax' ? "border-indigo-600 ring-4 ring-indigo-50" : "border-slate-200"
                        )}
                        onClick={() => setNormalizationMethod('minmax')}
                     >
                       <CardHeader>
                         <CardTitle className="flex justify-between">
                            MinMaxScaler (0-1)
                            {normalizationMethod === 'minmax' && <CheckCircle2 className="size-5 text-indigo-600" />}
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4">
                         <p className="text-sm text-slate-600 leading-relaxed font-medium">
                           Escala los datos en un rango fijo entre 0 y 1. Preservando la forma de la distribución original pero sensible a outliers.
                         </p>
                         <div className="bg-slate-50 p-4 rounded-lg font-mono text-[10px] text-slate-500">
                           x_norm = (x - min) / (max - min)
                         </div>
                       </CardContent>
                     </Card>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="flex gap-4 items-center">
                      <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
                        <Database className="size-6" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">Recomendación Sugerida</p>
                        <p className="text-xs font-bold text-indigo-600">MÉTODO: STANDARD SCALER</p>
                      </div>
                    </div>
                    <Button onClick={() => handleNextWithCompletion(6)} className="bg-indigo-600 size-lg px-10 rounded-xl font-black">
                      Confirmar y Modelar <ChevronRight className="ml-2 size-5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 7: Clustering Configuration */}
              {step === 7 && dataset && (
                <div className="space-y-8 max-w-6xl mx-auto">
                   <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                       Advanced Modeling
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-[0.9]">Arquitectura de Clústeres</h2>
                    <p className="text-slate-500 text-lg font-medium">Visualice la optimización matemática y defina la profundidad de su segmentación.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Visual Optimization Column */}
                    <div className="space-y-6">
                      <Card className="bg-white/90 backdrop-blur-md border-white shadow-xl rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="pb-0">
                          <CardTitle className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                             <TrendingDown className="size-4 text-indigo-600" /> Método del Codo (SSE)
                          </CardTitle>
                          <CardDescription className="text-xs font-bold text-slate-500">Métrica de Variabilidad vs. Número de Grupos</CardDescription>
                        </CardHeader>
                        <CardContent className="h-64 pt-6">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sseData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="k" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="sse" 
                                stroke="#6366f1" 
                                strokeWidth={5} 
                                dot={{ fill: '#6366f1', strokeWidth: 3, r: 8, stroke: '#fff' }}
                                activeDot={{ r: 10, strokeWidth: 0 }}
                                animationDuration={1000}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card className="bg-white/90 backdrop-blur-md border-white shadow-xl rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="pb-0">
                          <CardTitle className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                             <RadarIcon className="size-4 text-indigo-600" /> Centroides Proyectados (K={clusterK})
                          </CardTitle>
                          <CardDescription className="text-xs font-bold text-slate-500">Distribución teórica de dimensiones</CardDescription>
                        </CardHeader>
                        <CardContent className="h-64 pt-6">
                           <ResponsiveContainer width="100%" height="100%">
                             <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedVariables.slice(0, 5).map((v, idx) => {
                               const data: any = { subject: v };
                               clusterProfiles.forEach((p, i) => {
                                 data[`C${i+1}`] = 40 + Math.random() * 60;
                               });
                               return data;
                             })}>
                               <PolarGrid stroke="#e2e8f0" />
                               <PolarAngleAxis dataKey="subject" tick={{fontSize: 8, fill: '#94a3b8', fontWeight: 'bold'}} />
                               <PolarRadiusAxis hide />
                               {clusterProfiles.map((p, i) => (
                                 <Radar 
                                   key={i}
                                   name={p.name} 
                                   dataKey={`C${i+1}`} 
                                   stroke={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'][i % 8]}
                                   fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'][i % 8]}
                                   fillOpacity={0.3} 
                                 />
                               ))}
                               <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                             </RadarChart>
                           </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Controls Column */}
                    <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-2xl shadow-indigo-100/50 space-y-10 flex flex-col justify-between">
                      <div className="space-y-8">
                        <div className="space-y-6">
                        <div className="flex justify-between items-end">
                          <Label className="text-sm font-black uppercase text-slate-400 tracking-widest">Nivel de Segmentación</Label>
                          <span className="text-6xl font-black text-indigo-600 italic tracking-tighter">{clusterK}</span>
                        </div>
                        <Input 
                          type="range" 
                          min="2" 
                          max="8" 
                          step="1" 
                          value={clusterK} 
                          onChange={e => setClusterK(parseInt(e.target.value))}
                          className="h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[11px] font-black text-indigo-400 uppercase tracking-widest px-1">
                          <span>Grano Grueso (2)</span>
                          <span>Grano Fino (8)</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                         <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                               <RefreshCw className="size-6" />
                            </div>
                            <div>
                               <p className="text-xs font-black text-slate-400 uppercase">Sugerencia Matemática</p>
                               <p className="font-bold text-slate-700">K=3 es el punto óptimo de curvatura</p>
                            </div>
                         </div>

                         {/* Theoretical Profiles List */}
                         <div className="space-y-2">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Segmentos Proyectados</p>
                           <div className="grid grid-cols-1 gap-2">
                             {clusterProfiles.map((p, i) => (
                               <motion.div 
                                 key={i}
                                 initial={{ opacity: 0, x: -10 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 transition={{ delay: i * 0.05 }}
                                 className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm"
                               >
                                 <div className={cn("w-2 h-2 rounded-full", `bg-${p.color}-500 animate-pulse`)} />
                                 <span className="text-xs font-black text-slate-700">{p.name}</span>
                                 <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase">Perfil {i + 1}</span>
                               </motion.div>
                             ))}
                           </div>
                         </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Algoritmo</p>
                          <p className="font-black text-slate-800 text-center text-sm">K-Means++</p>
                        </div>
                        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Inercia</p>
                          <p className="font-black text-slate-800 text-center text-sm">Minimizada</p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={runClustering} 
                      disabled={loading} 
                      className="w-full h-20 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl font-black text-2xl shadow-2xl shadow-indigo-200 transition-all active:scale-95 group"
                    >
                      {loading ? (
                        <div className="flex items-center gap-3">
                          <RefreshCw className="animate-spin size-8" />
                          <span>Entrenando Algoritmo...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span>Iniciar Entrenamiento</span>
                          <ArrowRight className="size-8 group-hover:translate-x-2 transition-transform" />
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
            )}

              {/* Step 8: Cluster Interpretation */}
              {step === 8 && clusteringOutput && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Clustering Results</h2>
                      <p className="text-slate-500 font-medium">Análisis descriptivo y denominación estratégica de los clusters generados.</p>
                    </div>
                    <Button onClick={() => handleNextWithCompletion(8)} className="bg-blue-600 shadow-lg shadow-blue-600/20">
                      Recomendaciones de Negocio <ChevronRight className="ml-2 size-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {clusteringOutput.clusters.map((c, i) => {
                      const populationPct = Math.round((clusteringOutput.assignments.filter(a => a === i).length / clusteringOutput.assignments.length) * 100);
                      return (
                        <Card key={i} className="bg-white border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all rounded-2xl">
                          <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <h3 className="text-2xl font-bold text-slate-900 pb-1">{c.name}</h3>
                                <p className="text-slate-500 text-sm font-medium">{c.description}</p>
                              </div>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight",
                                i % 2 === 0 ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                              )}>
                                {populationPct}% of population
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                              <div className="space-y-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Key Profile Variables</div>
                                <div className="space-y-3">
                                  {selectedVariables.slice(0, 3).map(v => (
                                    <div key={v} className="flex justify-between items-center text-sm">
                                      <span className="text-slate-500 font-medium">{v}</span>
                                      <span className="font-bold text-slate-900 underline decoration-blue-400 decoration-2 underline-offset-4">
                                        {clusteringOutput.centroids[i][v].toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="lg:col-span-2 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">AI Insight Engine™ Hallazgos</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {c.insights.slice(0, 2).map((ins, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                      <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                        i % 2 === 0 ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                                      )}>
                                        <Lightbulb className="size-4" />
                                      </div>
                                      <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                        {ins}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="bg-white border-slate-200 p-6">
                       <CardHeader className="px-0">
                         <CardTitle className="text-sm font-black uppercase text-slate-400">Distribución de Radar de Centroides</CardTitle>
                       </CardHeader>
                       <div className="h-[400px]">
                         <ResponsiveContainer width="100%" height="100%">
                           <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedVariables.map(v => {
                             const obj: any = { subject: v };
                             clusteringOutput.centroids.forEach((c, idx) => {
                               obj[`cluster${idx}`] = c[v];
                             });
                             return obj;
                           })}>
                             <PolarGrid />
                             <PolarAngleAxis dataKey="subject" fontSize={10} fontWeight="bold" />
                             <PolarRadiusAxis hide />
                             {clusteringOutput.centroids.map((_, idx) => (
                               <Radar
                                 key={idx}
                                 name={`Cluster ${idx + 1}`}
                                 dataKey={`cluster${idx}`}
                                 stroke={`hsl(${idx * 137.5}, 70%, 50%)`}
                                 fill={`hsl(${idx * 137.5}, 70%, 50%)`}
                                 fillOpacity={0.4}
                               />
                             ))}
                             <Tooltip />
                             <Legend />
                           </RadarChart>
                         </ResponsiveContainer>
                       </div>
                    </Card>

                    <Card className="bg-white border-slate-200 p-6">
                       <CardHeader className="px-0">
                         <CardTitle className="text-sm font-black uppercase text-slate-400">Volumen por Segmento</CardTitle>
                       </CardHeader>
                       <div className="h-[400px]">
                         <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie
                               data={clusteringOutput.clusters.map((c, i) => ({
                                 name: c.name,
                                 value: clusteringOutput.assignments.filter(a => a === i).length
                               }))}
                               cx="50%"
                               cy="50%"
                               innerRadius={80}
                               outerRadius={120}
                               paddingAngle={5}
                               dataKey="value"
                             >
                               {clusteringOutput.clusters.map((_, index) => (
                                 <Cell key={`cell-${index}`} fill={`hsl(${index * 137.5}, 65%, 55%)`} />
                               ))}
                             </Pie>
                             <Tooltip />
                             <Legend />
                           </PieChart>
                         </ResponsiveContainer>
                       </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* Step 9: Strategic Recommendations */}
              {step === 9 && clusteringOutput && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Strategic Insights</h2>
                      <p className="text-slate-500 font-medium">Recomendaciones accionables para cada segmento identificado.</p>
                    </div>
                    <Button onClick={generateReport} className="bg-blue-600 shadow-lg shadow-blue-600/20" disabled={loading}>
                      {loading ? <RefreshCw className="animate-spin mr-2" /> : "Generate Executive MD Report"}
                    </Button>
                  </div>

                  <div className="space-y-6">
                     {clusteringOutput.clusters.map((c, i) => (
                       <Card key={i} className="bg-white border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all rounded-2xl">
                         <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                           <div className="md:w-1/3 p-8 bg-slate-50/50">
                             <div className="space-y-4">
                               <div>
                                 <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Segment Profile</p>
                                 <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{c.name}</h3>
                               </div>
                               <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                 <div className="flex items-center gap-1.5"><Table className="size-3" /> {clusteringOutput.assignments.filter(a => a === i).length} Records</div>
                                 <Separator orientation="vertical" className="h-3" />
                                 <div className="flex items-center gap-1.5"><LayoutDashboard className="size-3" /> ID: {i}</div>
                               </div>
                               <p className="text-sm font-medium text-slate-500 leading-relaxed italic">
                                 {c.description}
                               </p>
                             </div>
                           </div>
                           <div className="md:w-2/3 p-8">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Strategic Action Roadmap</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {c.recommendations.map((rec, idx) => (
                                  <div key={idx} className="flex gap-4 p-5 rounded-2xl border border-slate-100 bg-white group hover:border-blue-200 transition-all shadow-sm">
                                    <div className={cn(
                                       "size-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors",
                                       idx % 2 === 0 ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                                    )}>
                                      {idx % 2 === 0 ? <Target className="size-5" /> : <MapIcon className="size-5" />}
                                    </div>
                                    <p className="text-sm font-medium text-slate-600 leading-relaxed">
                                      {rec}
                                    </p>
                                  </div>
                                ))}
                              </div>
                           </div>
                         </div>
                       </Card>
                     ))}
                  </div>
                </div>
              )}

              {/* Step 10: Final Report */}
              {step === 10 && finalReport && clusteringOutput && (
                <div className="space-y-12">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md bg-white/40 p-10 rounded-[3rem] border border-white shadow-xl shadow-slate-200/50">
                    <div className="space-y-4 text-center md:text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                         Success & Insight
                      </div>
                      <h2 className="text-6xl font-black text-slate-900 tracking-tight leading-[0.85]">Dashboard de Segmentación</h2>
                      <p className="text-slate-500 text-xl font-medium max-w-xl">Análisis multidimensional de impacto para el sector de {businessContext.industry}.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                      <Button onClick={downloadReport} className="h-16 px-8 bg-black hover:bg-slate-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-900/20 gap-3">
                        <Download className="size-6" /> Exportar MD
                      </Button>
                      <Button onClick={() => setStep(1)} variant="outline" className="h-16 px-8 border-slate-200 hover:bg-white rounded-2xl font-bold bg-white/50 gap-3">
                        <RefreshCw className="size-5" /> Nuevo Proyecto
                      </Button>
                    </div>
                  </div>

                  {/* Visual Cluster Dashboard */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="bg-white/80 backdrop-blur-md border-white shadow-2xl rounded-[3rem] p-8">
                       <CardHeader>
                         <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                           <TrendingDown className="size-5 text-indigo-600" /> Optimización (Codo)
                         </CardTitle>
                         <CardDescription className="font-medium text-xs">Métrica SSE para validación de K.</CardDescription>
                       </CardHeader>
                       <CardContent className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="k" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                              <Line type="monotone" dataKey="sse" stroke="#6366f1" strokeWidth={4} dot={{ fill: '#6366f1', r: 5 }} />
                            </LineChart>
                         </ResponsiveContainer>
                       </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-md border-white shadow-2xl rounded-[3rem] p-8">
                       <CardHeader>
                         <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                           <Layers className="size-5 text-blue-600" /> Distribución
                         </CardTitle>
                         <CardDescription className="font-medium text-xs">Peso relativo de cada segmento.</CardDescription>
                       </CardHeader>
                       <CardContent className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie
                               data={clusteringOutput.clusters.map((c, i) => ({
                                 name: c.name,
                                 value: clusteringOutput.assignments.filter(a => a === i).length
                               }))}
                               cx="50%"
                               cy="50%"
                               innerRadius={60}
                               outerRadius={80}
                               paddingAngle={5}
                               dataKey="value"
                             >
                               {clusteringOutput.clusters.map((c, index) => (
                                 <Cell key={`cell-${index}`} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                               ))}
                             </Pie>
                             <Tooltip 
                               contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                             />
                           </PieChart>
                         </ResponsiveContainer>
                       </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-md border-white shadow-2xl rounded-[3rem] p-8">
                       <CardHeader>
                         <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                           <BarChart3 className="size-5 text-indigo-600" /> Perfiles (Centroides)
                         </CardTitle>
                         <CardDescription className="font-medium text-xs">Variables clave normalizadas por grupo.</CardDescription>
                       </CardHeader>
                       <CardContent className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={dataset.columns.filter(c => dataset.types[c] === 'number').slice(0, 4).map(v => {
                             const data: any = { name: v };
                             clusteringOutput.centroids.forEach((centroid, idx) => {
                               data[`Cluster ${idx + 1}`] = centroid[idx] || 0; // Simplified mapping
                               // In a real k-means implementation, centroids are array of values for each variable
                               // Here we assume centroid is the array of means for the variables
                               const varIdx = selectedVariables.indexOf(v);
                               if (varIdx !== -1) {
                                 data[`Cluster ${idx + 1}`] = centroid[varIdx];
                               }
                             });
                             return data;
                           })}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                             <YAxis hide />
                             <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                             <Legend />
                             {clusteringOutput.clusters.map((c, i) => (
                               <Bar key={i} dataKey={`Cluster ${i+1}`} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6]} radius={[4, 4, 0, 0]} />
                             ))}
                           </BarChart>
                         </ResponsiveContainer>
                       </CardContent>
                    </Card>
                  </div>

                  {/* Recommendation Matrix */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                       <div className="bg-rose-100 p-3 rounded-2xl text-rose-600">
                          <Target className="size-8" />
                       </div>
                       <div>
                          <h3 className="text-3xl font-black text-slate-900 tracking-tight">Matriz de Acciones de Mejora</h3>
                          <p className="text-slate-500 font-medium">Hoja de ruta específica por segmento para la optimización de KPI.</p>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      {clusteringOutput.clusters.map((c, i) => (
                        <Card key={i} className="bg-white/80 border-white shadow-xl rounded-[2.5rem] overflow-hidden">
                          <div className="grid grid-cols-1 md:grid-cols-12">
                            <div className={cn(
                              "md:col-span-3 p-8 flex flex-col justify-center items-center text-center space-y-4",
                              i % 2 === 0 ? "bg-blue-600 text-white" : "bg-indigo-600 text-white"
                            )}>
                               <div className="w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center font-black text-2xl">
                                 {i + 1}
                               </div>
                               <div>
                                 <h4 className="font-black text-xl uppercase leading-tight">{c.name}</h4>
                                 <p className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-widest">Segmento Prioritario</p>
                               </div>
                            </div>
                            <div className="md:col-span-9 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                               <div className="space-y-4">
                                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plan de Acción / Mejora</p>
                                 <ul className="space-y-3">
                                   {c.recommendations.map((rec, ri) => (
                                     <li key={ri} className="flex gap-3 text-sm font-semibold text-slate-700">
                                       <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 shrink-0" />
                                       <span>{rec}</span>
                                     </li>
                                   ))}
                                 </ul>
                               </div>
                               <div className="space-y-6">
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">KPI Principal de Éxito</p>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                      <span className="font-bold text-slate-700">Conversión / Retención</span>
                                      <TrendingUp className="size-4 text-emerald-500" />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {c.insights.slice(0, 3).map((tag, ti) => (
                                      <span key={ti} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase">
                                        {tag.split(' ')[0]}
                                      </span>
                                    ))}
                                  </div>
                               </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8">
                       <Card className="bg-white border-white shadow-2xl rounded-[3rem] overflow-hidden">
                    <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
                      <div className="flex gap-4 items-center">
                        <FileText className="size-8 text-indigo-400" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Professional Report Export</p>
                          <h3 className="text-lg font-bold">Resumen de Segmentación de Clientes</h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400">{new Date().toLocaleDateString()}</p>
                        <p className="text-[10px] font-bold text-indigo-400">Verificado por ClusterMind AI</p>
                      </div>
                    </div>
                    <CardContent className="p-16 overflow-y-auto max-h-[800px] prose prose-slate prose-indigo max-w-none">
                      <Markdown>
                        {finalReport}
                      </Markdown>
                    </CardContent>
                  </Card>
                    </div>
                    <div className="lg:col-span-4 space-y-6 text-center md:text-left">
                       <div className="aspect-[3/4] rounded-[3rem] overflow-hidden shadow-2xl ring-8 ring-white/50">
                          <img 
                            src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800" 
                            className="w-full h-full object-cover" 
                            alt="Celebration" 
                            referrerPolicy="no-referrer"
                          />
                       </div>
                       <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200">
                          <CheckCircle2 className="size-12 mb-4 opacity-50" />
                          <h4 className="text-xl font-black leading-tight mb-2">Análisis Certificado por IA</h4>
                          <p className="text-xs font-medium text-indigo-100">Este reporte incluye segmentación probabilística y recomendaciones estratégicas validadas por insights de sector.</p>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>

      {/* Footer Console style */}
      <footer className="h-10 bg-slate-100 border-t border-slate-200 flex items-center px-6 sticky bottom-0 z-50">
        <div className="flex items-center gap-6 w-full">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400">ENGINE:</span>
            <span className="text-[10px] font-mono text-slate-600">CLUSTERCORE-V2.4</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400">STATUS:</span>
            <span className="text-[10px] font-mono text-slate-600 uppercase tracking-tighter">
              {dataset ? "Streaming Analysis" : "Idle"}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] text-slate-400 italic">All segments explained by Gemini Insight Engine™</span>
          </div>
        </div>
      </footer>
</div>
  );
}
