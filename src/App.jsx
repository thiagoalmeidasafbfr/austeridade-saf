import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Filter, Calendar, User, Briefcase, DollarSign, CheckSquare, 
  ChevronDown, ChevronUp, AlertCircle, Search, LayoutGrid, 
  List, Upload, BarChart3, PieChart, TrendingUp, Target, 
  Download, Loader2, Edit2, Save, X, Plus, Trash2, Clock, 
  Table as TableIcon, CheckCircle2, MessageSquare, AlertTriangle, Info,
  ArrowUp, ArrowDown, ArrowUpDown, FileText, Users, Package, CalendarCheck, Presentation,
  GripVertical
} from 'lucide-react';

// --- ATENÇÃO: Para usar Excel localmente ---
// 1. Rode no terminal: npm install xlsx
// 2. Descomente a linha abaixo (remova as duas barras //):
 import * as XLSX from 'xlsx'; 

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, updateDoc, 
  doc, writeBatch, query, orderBy, deleteDoc, getDocs 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBPozaBViqe6wI5hGhMWjAGPheXudTTc84",
  authDomain: "austeridade-safbotafogo.firebaseapp.com",
  databaseURL: "https://austeridade-safbotafogo-default-rtdb.firebaseio.com",
  projectId: "austeridade-safbotafogo",
  storageBucket: "austeridade-safbotafogo.firebasestorage.app",
  messagingSenderId: "313012869550",
  appId: "1:313012869550:web:e6926f4fe8c41b903c503f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- COMPONENTES AUXILIARES ---

const StatusBadge = ({ status }) => {
  const safeStatus = String(status || "Não Iniciado").trim();
  const colors = {
    "Em Andamento": "bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-100",
    "Não Iniciado": "bg-slate-50 text-slate-600 border-slate-200 ring-1 ring-slate-100",
    "Concluído": "bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-100"
  };
  // Fallback para status com casing diferente
  let matchedColor = colors["Não Iniciado"];
  Object.keys(colors).forEach(key => {
    if (key.toLowerCase() === safeStatus.toLowerCase()) matchedColor = colors[key];
  });

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${matchedColor}`}>
      {safeStatus}
    </span>
  );
};

const ApprovalBadge = () => (
  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-100" title="Esta ação requer aprovação da diretoria">
    <AlertTriangle size={10} strokeWidth={3} />
    Requer Aprovação
  </span>
);

const MoneyDisplay = ({ label, value, highlight = false, size = "sm" }) => {
  let displayValue = value;
  let isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
  
  if (isNumeric) {
     displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(parseFloat(value));
  } else {
     displayValue = String(value || "R$ 0,00");
  }

  // Hierarquia de tamanho
  const sizeClasses = { 
    xs: "text-xs",
    sm: "text-sm", 
    md: "text-base", 
    lg: "text-lg", 
    xl: "text-2xl" 
  };
  
  return (
    <div className="flex flex-col h-full justify-center">
      {label && <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 leading-none text-center">{label}</span>}
      <span className={`font-bold tracking-tight text-center ${sizeClasses[size] || 'text-sm'} ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>
        {displayValue}
      </span>
    </div>
  );
};

// --- GRÁFICO DE BARRAS SIMPLES ---
const SimpleBarChart = ({ data }) => {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) return <div className="text-[10px] text-slate-400 italic text-center">Sem dados</div>;

  return (
    <div className="flex h-4 w-full rounded-full overflow-hidden">
      {data.map((item, index) => {
        if (item.value === 0) return null;
        const width = (item.value / total) * 100;
        return (
          <div 
            key={index} 
            style={{ width: `${width}%` }} 
            className={`${item.color} h-full first:rounded-l-full last:rounded-r-full`}
            title={`${item.label}: ${item.value}`}
          />
        );
      })}
    </div>
  );
};

// --- NOVA VISÃO: APRESENTAÇÃO DO COMITÊ (ATUALIZADA) ---
const CommitteePresentation = ({ plans }) => {
  // --- Cálculos de Agregação ---
  
  // 1. Por Pacote
  const plansByPackage = useMemo(() => {
    const grouped = plans.reduce((acc, plan) => {
      const pkg = plan.package || "Outros";
      acc[pkg] = (acc[pkg] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [plans]);

  // 2. Por Fase (Contagem e Status DETALHADO)
  const statsByPhase = useMemo(() => {
    // Inicializa estrutura
    const stats = { 
      1: { total: 0, completed: 0, inProgress: 0, notStarted: 0 }, 
      2: { total: 0, completed: 0, inProgress: 0, notStarted: 0 }, 
      3: { total: 0, completed: 0, inProgress: 0, notStarted: 0 } 
    };
    
    plans.forEach(plan => {
      // Normaliza fase
      let phase = parseInt(plan.phase);
      if (![1, 2, 3].includes(phase)) phase = 3; // Default

      // Normaliza Status
      const status = (plan.status || "").toLowerCase().trim();

      stats[phase].total += 1;
      
      if (status === 'concluído' || status === 'concluido') {
        stats[phase].completed += 1;
      } else if (status === 'em andamento') {
        stats[phase].inProgress += 1;
      } else {
        stats[phase].notStarted += 1;
      }
    });
    return stats;
  }, [plans]);

  // 3. Economia Total
  const totalSavings = useMemo(() => {
    return plans.reduce((acc, p) => acc + (parseFloat(p.savings) || 0), 0);
  }, [plans]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* 1. O Plano */}
      <section className="w-full">
        <div className="bg-white p-8 rounded-xl shadow-sm border-l-4 border-blue-600">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <FileText size={24} />
            </div>
            <h2 className="font-bold text-2xl text-slate-800">O Plano: Estrada dos Louros</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col justify-center">
              <p className="text-sm text-slate-600 leading-relaxed text-justify">
                O Plano de Austeridade Financeira define estratégias para otimizar as despesas da SAF Botafogo. Após um ciclo de intenso crescimento e investimentos estruturais, iniciamos agora um novo estágio focado na eficiência operacional, com um olhar atento para a redução de custos e maximização dos recursos, garantindo a sustentabilidade do projeto a longo prazo.
              </p>
            </div>

            <div className="lg:col-span-2 lg:border-l border-slate-100 lg:pl-8 pt-6 lg:pt-0 border-t lg:border-t-0 flex flex-col justify-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                  <h4 className="text-xs font-bold text-blue-600 uppercase mb-2 tracking-wide">Levantamento (Dez/24)</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Em dezembro de 2024, foram realizadas diversas reuniões estratégicas com diferentes áreas da SAF Botafogo. Durante este período, iniciativas foram amplamente discutidas e ações de eficiência foram submetidas pelos departamentos.
                  </p>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                  <h4 className="text-xs font-bold text-indigo-600 uppercase mb-2 tracking-wide">Análise e Validação</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    As propostas foram analisadas pela comissão designada para acompanhamento. Agora, as ações validadas estão sendo oficialmente integradas a este plano para início da execução e monitoramento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Comissão */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800">
          <Users className="text-slate-700" /> Comissão de Acompanhamento
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Grupo 1: Suprimentos */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50">
            <div className="text-xs text-slate-400 font-bold uppercase mb-3 text-center">Liderança & Suprimentos</div>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                <img src="https://ui-avatars.com/api/?name=Flavia+Merheb&background=2563eb&color=fff&size=128" alt="Flávia" className="w-10 h-10 rounded-full object-cover border border-blue-100" />
                <div>
                  <p className="text-[10px] text-blue-600 uppercase font-bold">Líder do Projeto</p>
                  <h3 className="font-bold text-slate-800 text-sm">Flávia Merheb</h3>
                  <p className="text-[10px] text-slate-500">Dir. Suprimentos & Hosp.</p>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                <img src="https://ui-avatars.com/api/?name=Renan+Vieira&background=94a3b8&color=fff&size=128" alt="Renan" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Membro do Projeto</p>
                  <h3 className="font-bold text-slate-800 text-sm">Renan Vieira</h3>
                  <p className="text-[10px] text-slate-500">Esp. Suprimentos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Grupo 2: Financeiro */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50">
            <div className="text-xs text-slate-400 font-bold uppercase mb-3 text-center">Financeiro & Controladoria</div>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                <img src="https://ui-avatars.com/api/?name=Anderson+Santos&background=475569&color=fff&size=128" alt="Anderson" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                <div>
                  <p className="text-[10px] text-slate-600 uppercase font-bold">Sponsor</p>
                  <h3 className="font-bold text-slate-800 text-sm">Anderson Santos</h3>
                  <p className="text-[10px] text-slate-500">CFO</p>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 border border-slate-100"><User size={20}/></div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Membro do Projeto</p>
                  <h3 className="font-bold text-slate-800 text-sm">A Definir</h3>
                  <p className="text-[10px] text-slate-500">Coord. Controladoria</p>
                </div>
              </div>
            </div>
          </div>

          {/* Grupo 3: Acompanhamento */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50">
            <div className="text-xs text-slate-400 font-bold uppercase mb-3 text-center">Acompanhamento (PMO)</div>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                <img src="https://ui-avatars.com/api/?name=Alexandre+Vodopives&background=64748b&color=fff&size=128" alt="Alexandre" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">PMO</p>
                  <h3 className="font-bold text-slate-800 text-sm">Alexandre Vodopives</h3>
                  <p className="text-[10px] text-slate-500">Ger. Performance & Proj.</p>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                <img src="https://ui-avatars.com/api/?name=Nathalia+Bretas&background=64748b&color=fff&size=128" alt="Nathalia" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">PMO</p>
                  <h3 className="font-bold text-slate-800 text-sm">Nathalia Bretas</h3>
                  <p className="text-[10px] text-slate-500">Proj. Management</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-600 pl-2 border-l-4 border-slate-300">
            Representantes de Áreas Chave
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
              <img src="https://ui-avatars.com/api/?name=Leonardo+Coelho&background=94a3b8&color=fff&size=128" alt="Leonardo" className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shadow-sm" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Futebol</p>
                <h3 className="font-bold text-slate-800 text-sm">Leonardo Coelho</h3>
                <p className="text-[10px] text-slate-500">Dir. Coord. Futebol</p>
              </div>
           </div>
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
              <img src="https://ui-avatars.com/api/?name=Pedro+Tardin&background=94a3b8&color=fff&size=128" alt="Pedro" className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shadow-sm" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Operações</p>
                <h3 className="font-bold text-slate-800 text-sm">Pedro Tardin</h3>
                <p className="text-[10px] text-slate-500">Diretor de Operações</p>
              </div>
           </div>
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
              <img src="https://ui-avatars.com/api/?name=Lucas+Pires&background=94a3b8&color=fff&size=128" alt="Lucas" className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shadow-sm" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Matchday</p>
                <h3 className="font-bold text-slate-800 text-sm">Lucas Pires</h3>
                <p className="text-[10px] text-slate-500">Ger. Plan. Arena</p>
              </div>
           </div>
        </div>
      </section>

      {/* 3. Pacotes de Ações (DADOS VIVOS) */}
      <section>
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                <Package className="text-slate-700" /> Pacotes de Ações
            </h2>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-600 mb-6 text-sm">
                Foram mapeadas e estruturadas <strong>{plans.length} ações</strong> estratégicas de austeridade, divididas em <strong>{plansByPackage.length} pacotes</strong> temáticos para facilitar a gestão e implementação.
            </p>

            <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full bg-white">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Pacote / Área</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Qtd. Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {plansByPackage.map(([pkg, count]) => (
                            <tr key={pkg} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4 text-slate-700 font-medium">{pkg}</td>
                                <td className="py-3 px-4 text-center font-bold text-blue-600">{count}</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                            <td className="py-3 px-4 text-slate-800 text-right uppercase text-xs tracking-wider">Total Geral</td>
                            <td className="py-3 px-4 text-center text-slate-800 text-lg">{plans.length}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      </section>

      {/* 4. Visão Temporal (DADOS VIVOS) */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <Clock className="text-slate-700" /> Visão Temporal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-lg overflow-hidden border border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              
              {/* Fase 1 */}
              <div className="bg-emerald-50/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                      <span className="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">1</span>
                      <div>
                          <h3 className="font-bold text-emerald-900">Fase 1</h3>
                          <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Jan - Abr 2026</p>
                      </div>
                  </div>
                  <div className="mb-4">
                      <span className="text-3xl font-bold text-emerald-700">{statsByPhase[1].total}</span>
                      <span className="text-xs text-emerald-600 font-medium ml-1">ações no total</span>
                  </div>
                  
                  {/* Gráfico de Barras Fase 1 */}
                  <div className="mb-4">
                    <SimpleBarChart data={[
                        { label: 'Concluído', value: statsByPhase[1].completed, color: 'bg-emerald-500' },
                        { label: 'Em Andamento', value: statsByPhase[1].inProgress, color: 'bg-emerald-300' },
                        { label: 'Não Iniciado', value: statsByPhase[1].notStarted, color: 'bg-slate-200' }
                    ]} />
                  </div>

                  <ul className="space-y-2 text-xs text-emerald-800 bg-white/50 p-3 rounded-lg border border-emerald-100">
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-600"/> Concluídos</span> <strong>{statsByPhase[1].completed}</strong></li>
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><Loader2 size={12} className="text-emerald-500"/> Em andamento</span> <strong>{statsByPhase[1].inProgress}</strong></li>
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-slate-300 bg-white"></div> A iniciar</span> <strong>{statsByPhase[1].notStarted}</strong></li>
                  </ul>
              </div>

              {/* Fase 2 */}
              <div className="bg-amber-50/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                      <span className="bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">2</span>
                      <div>
                          <h3 className="font-bold text-amber-900">Fase 2</h3>
                          <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Mai - Ago 2026</p>
                      </div>
                  </div>
                  <div className="mb-4">
                      <span className="text-3xl font-bold text-amber-700">{statsByPhase[2].total}</span>
                      <span className="text-xs text-amber-600 font-medium ml-1">ações no total</span>
                  </div>

                   {/* Gráfico de Barras Fase 2 */}
                   <div className="mb-4">
                    <SimpleBarChart data={[
                        { label: 'Concluído', value: statsByPhase[2].completed, color: 'bg-emerald-500' },
                        { label: 'Em Andamento', value: statsByPhase[2].inProgress, color: 'bg-amber-400' },
                        { label: 'Não Iniciado', value: statsByPhase[2].notStarted, color: 'bg-slate-200' }
                    ]} />
                  </div>

                  <ul className="space-y-2 text-xs text-amber-800 bg-white/50 p-3 rounded-lg border border-amber-100">
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-600"/> Concluídos</span> <strong>{statsByPhase[2].completed}</strong></li>
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><Loader2 size={12} className="text-amber-500"/> Em andamento</span> <strong>{statsByPhase[2].inProgress}</strong></li>
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-slate-300 bg-white"></div> A iniciar</span> <strong>{statsByPhase[2].notStarted}</strong></li>
                  </ul>
              </div>

              {/* Fase 3 */}
              <div className="bg-red-50/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                      <span className="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">3</span>
                      <div>
                          <h3 className="font-bold text-red-900">Fase 3</h3>
                          <p className="text-[10px] text-red-600 font-medium uppercase tracking-wide">Set - Dez 2026</p>
                      </div>
                  </div>
                  <div className="mb-4">
                      <span className="text-3xl font-bold text-red-700">{statsByPhase[3].total}</span>
                      <span className="text-xs text-red-600 font-medium ml-1">ações no total</span>
                  </div>

                   {/* Gráfico de Barras Fase 3 */}
                   <div className="mb-4">
                    <SimpleBarChart data={[
                        { label: 'Concluído', value: statsByPhase[3].completed, color: 'bg-emerald-500' },
                        { label: 'Em Andamento', value: statsByPhase[3].inProgress, color: 'bg-red-400' },
                        { label: 'Não Iniciado', value: statsByPhase[3].notStarted, color: 'bg-slate-200' }
                    ]} />
                  </div>

                  <ul className="space-y-2 text-xs text-red-800 bg-white/50 p-3 rounded-lg border border-red-100">
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-600"/> Concluídos</span> <strong>{statsByPhase[3].completed}</strong></li>
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><Loader2 size={12} className="text-red-500"/> Em andamento</span> <strong>{statsByPhase[3].inProgress}</strong></li>
                      <li className="flex items-center justify-between"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-slate-300 bg-white"></div> A iniciar</span> <strong>{statsByPhase[3].notStarted}</strong></li>
                  </ul>
              </div>
          </div>
      </section>

      {/* 5. Governança (DADOS VIVOS) */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="text-slate-500 text-[10px] font-bold uppercase mb-2">Economia Estimada 2026</div>
              <div className="text-2xl font-bold text-blue-600 mb-1">
                 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalSavings)}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{width: '100%'}}></div>
              </div>
          </div>

          <div className="md:col-span-3 bg-slate-800 text-slate-300 p-8 rounded-xl shadow-md flex flex-col justify-center">
              <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2"><CalendarCheck className="text-blue-400"/> Acompanhamento</h3>
              <p className="text-base text-slate-200 leading-relaxed font-light">
                  Será realizada reunião mensal com os 16 líderes de iniciativas para acompanhamento da implementação de cada ação, a ser reportado na Reunião Geral de Resultados.
              </p>
          </div>
      </section>

      <footer className="text-center text-slate-400 text-[10px] py-8">
          <p>Estrada dos Louros - Plano de Ação de Austeridade Financeira © 2026</p>
      </footer>
    </div>
  );
};

// --- VISÃO EM TABELA ---
const TableView = ({ plans, onEdit, onDelete, onFilter, sortConfig, onSort }) => {
  const getSortIcon = (key) => {
    const currentSort = sortConfig[0];
    if (!currentSort || currentSort.key !== key) return <ArrowUpDown size={12} className="opacity-30" />;
    
    return (
      <div className="flex items-center">
        {currentSort.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />}
      </div>
    );
  };

  // Cálculos de soma para a linha de resumo fixa
  const totalInvestment = plans.reduce((acc, plan) => acc + (parseFloat(plan.investment) || 0), 0);
  const totalCost2025 = plans.reduce((acc, plan) => acc + (parseFloat(plan.cost2025) || 0), 0);
  const totalSavings = plans.reduce((acc, plan) => acc + (parseFloat(plan.savings) || 0), 0);

  const SortableHeader = ({ label, sortKey, align = "left", width }) => (
    <th 
      className={`px-4 py-4 text-${align} text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none ${width}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {label}
        {getSortIcon(sortKey)}
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 w-full overflow-hidden flex flex-col max-h-[80vh]">
      <div className="overflow-auto flex-grow">
        <table className="w-full min-w-[1300px] divide-y divide-slate-200 border-separate border-spacing-0">
          <thead className="bg-slate-50/95 sticky top-0 z-10 shadow-sm backdrop-blur">
            <tr>
              <SortableHeader label="Ação" sortKey="title" width="w-[20%]" />
              <SortableHeader label="Pacote" sortKey="package" width="w-[12%]" />
              <SortableHeader label="Responsáveis" sortKey="leader" width="w-[14%]" />
              <SortableHeader label="Status" sortKey="status" width="w-[10%]" />
              <SortableHeader label="Inv. Nec. Estimado" sortKey="investment" align="right" width="w-[12%]" />
              <SortableHeader label="Custo 2025" sortKey="cost2025" align="right" width="w-[10%]" />
              <SortableHeader label="Economia Esperada" sortKey="savings" align="right" width="w-[12%]" />
              <SortableHeader label="Progresso" sortKey="progress" align="center" width="w-[6%]" />
              <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider w-[4%] bg-slate-50"></th>
            </tr>
            {/* LINHA DE SOMA STICKY LOGO ABAIXO DO HEADER */}
            <tr className="bg-blue-50/80 font-bold text-slate-700 shadow-sm">
                <td className="px-4 py-2 text-xs uppercase text-slate-500 text-right" colSpan={4}>Totais da Seleção:</td>
                <td className="px-4 py-2 text-right"><MoneyDisplay value={totalInvestment} size="sm" /></td>
                <td className="px-4 py-2 text-right"><MoneyDisplay value={totalCost2025} size="sm" /></td>
                <td className="px-4 py-2 text-right text-emerald-700"><MoneyDisplay value={totalSavings} size="sm" highlight /></td>
                <td className="px-4 py-2" colSpan={2}></td>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-4 align-top">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-semibold text-slate-800 leading-snug block">{plan.title}</span>
                    {plan.description && (
                        <div className="group/tooltip relative">
                            <Info size={14} className="text-slate-300 hover:text-blue-500 cursor-help mt-0.5" />
                            <div className="absolute left-full top-0 ml-2 w-64 p-3 bg-slate-800 text-white text-xs rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none z-50 transition-opacity">
                                {plan.description}
                            </div>
                        </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <button onClick={(e) => { e.stopPropagation(); onFilter('package', plan.package); }} className="text-xs font-bold text-blue-600 uppercase tracking-wide text-left hover:underline w-fit">
                    {plan.package}
                  </button>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-col text-sm text-slate-600 gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); onFilter('leader', plan.leader); }} className="flex items-center gap-1.5 truncate hover:text-blue-600 w-fit"><User size={14} className="text-slate-400"/> {plan.leader}</button>
                    <button onClick={(e) => { e.stopPropagation(); onFilter('area', plan.area); }} className="flex items-center gap-1.5 truncate hover:text-blue-600 w-fit"><Briefcase size={14} className="text-slate-400"/> {plan.area}</button>
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={plan.status} />
                      {plan.requiresApproval && <ApprovalBadge />}
                    </div>
                    <span className="text-xs text-slate-500 font-medium px-1">Fase {plan.phase}</span>
                  </div>
                </td>
                <td className="px-4 py-4 align-middle text-right">
                  <MoneyDisplay value={plan.investment} size="sm" />
                </td>
                <td className="px-4 py-4 align-middle text-right">
                  <MoneyDisplay value={plan.cost2025} size="sm" />
                </td>
                <td className="px-4 py-4 align-middle text-right">
                  <div className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 text-center">
                    <MoneyDisplay value={plan.savings} highlight size="sm" />
                  </div>
                </td>
                <td className="px-4 py-4 align-middle">
                  <div className="w-full bg-slate-100 rounded-full h-2 mx-auto max-w-[60px]">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${plan.progress || 0}%` }}></div>
                  </div>
                  <div className="text-xs text-center text-slate-500 mt-1 font-medium">{plan.progress || 0}%</div>
                </td>
                <td className="px-4 py-4 align-middle text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(plan)} className="text-slate-400 hover:text-blue-600 p-2 rounded hover:bg-blue-50 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => onDelete(plan.id)} className="text-slate-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- VISÃO DASHBOARD ---
const Dashboard = ({ plans }) => {
  const sumSafe = (items, field) => items.reduce((acc, item) => {
    const val = parseFloat(item[field]);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const totalSavings = sumSafe(plans, 'savings');
  const totalCost = sumSafe(plans, 'cost2025');
  const totalInvestment = sumSafe(plans, 'investment');
  const roi = totalInvestment > 0 ? ((totalSavings - totalInvestment) / totalInvestment) * 100 : 0;
  
  const statusCount = plans.reduce((acc, p) => {
    // Normalização de status
    let st = (p.status || "Não Iniciado").trim();
    // Capitalize first letter logic simplificada para agrupamento
    if(st.toLowerCase() === "em andamento") st = "Em Andamento";
    if(st.toLowerCase() === "concluído" || st.toLowerCase() === "concluido") st = "Concluído";
    if(st.toLowerCase() === "não iniciado") st = "Não Iniciado";

    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const savingsByArea = Object.entries(plans.reduce((acc, p) => {
    const val = parseFloat(p.savings);
    const safeVal = isNaN(val) ? 0 : val;
    acc[p.area] = (acc[p.area] || 0) + safeVal;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const maxSaving = Math.max(...savingsByArea.map(i => i[1]), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-36">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Economia Projetada</span>
            <div className="p-2 bg-emerald-50 rounded text-emerald-600"><TrendingUp size={20} /></div>
          </div>
          <div>
            <MoneyDisplay value={totalSavings} size="xl" highlight />
            <p className="text-xs text-slate-400 mt-2 font-medium">
               ROI Estimado: <span className="text-emerald-600">{roi.toFixed(1)}%</span>
            </p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-36">
            <div className="flex items-start justify-between">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Custo Base 2025</span>
               <div className="p-2 bg-blue-50 rounded text-blue-600"><DollarSign size={20} /></div>
            </div>
            <div>
               <MoneyDisplay value={totalCost} size="xl" />
               <p className="text-xs text-slate-400 mt-2">Impacto orçamentário total</p>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-36">
            <div className="flex items-start justify-between">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Investimento Nec.</span>
               <div className="p-2 bg-amber-50 rounded text-amber-600"><Target size={20} /></div>
            </div>
            <div>
               <MoneyDisplay value={totalInvestment} size="xl" />
               <p className="text-xs text-slate-400 mt-2">CAPEX/OPEX inicial</p>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-36">
            <div className="flex items-start justify-between">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total de Ações</span>
               <div className="p-2 bg-purple-50 rounded text-purple-600"><List size={20} /></div>
            </div>
            <div>
                <div className="font-bold text-4xl text-slate-800 tracking-tight">{plans.length}</div>
                <p className="text-xs text-slate-400 mt-2">Iniciativas cadastradas</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
             <BarChart3 size={18} className="text-slate-400"/> Top Economia por Área
           </h3>
           <div className="space-y-5">
             {savingsByArea.map(([area, value]) => (
               <div key={area}>
                 <div className="flex justify-between text-sm text-slate-600 mb-2 font-medium">
                   <span>{area}</span>
                   <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)}</span>
                 </div>
                 <div className="w-full bg-slate-50 rounded-full h-3">
                    <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${(value / maxSaving) * 100}%` }}></div>
                 </div>
               </div>
             ))}
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
             <PieChart size={18} className="text-slate-400"/> Status de Implementação
           </h3>
           <div className="space-y-4">
              {[
                { label: "Concluído", color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", count: statusCount["Concluído"] || 0 },
                { label: "Em Andamento", color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", count: statusCount["Em Andamento"] || 0 },
                { label: "Não Iniciado", color: "bg-slate-400", text: "text-slate-700", bg: "bg-slate-50", count: statusCount["Não Iniciado"] || 0 }
              ].map(item => (
                <div key={item.label} className={`flex items-center p-4 border border-transparent ${item.bg} rounded-lg`}>
                   <div className={`w-3 h-3 rounded-full ${item.color} mr-3`} />
                   <span className={`text-sm font-medium ${item.text} flex-grow`}>{item.label}</span>
                   <span className="text-base font-bold text-slate-900">{item.count}</span>
                   <span className="text-xs text-slate-400 ml-1 uppercase font-semibold">ações</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- VISÃO CARD ---
const PlanCard = ({ plan, onSave, onDelete, startEditing = false, onCloseEdit, onFilter }) => {
  const [isEditing, setIsEditing] = useState(startEditing);
  const [showChecklist, setShowChecklist] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [formData, setFormData] = useState(plan);

  useEffect(() => { 
    if (!isEditing) setFormData(plan); 
    if (startEditing) setIsEditing(true);
  }, [plan, startEditing]);

  // Recalcula progresso automaticamente se houver checklist
  useEffect(() => {
    if (formData.checklist && formData.checklist.length > 0) {
        const completed = formData.checklist.filter(i => i.checked).length;
        const total = formData.checklist.length;
        const calcProgress = Math.round((completed / total) * 100);
        if (calcProgress !== formData.progress) {
            setFormData(prev => ({ ...prev, progress: calcProgress }));
        }
    }
  }, [formData.checklist]);

  const handleSave = () => { onSave(plan.id, formData); setIsEditing(false); if(onCloseEdit) onCloseEdit(); };
  const handleCancel = () => { setFormData(plan); setIsEditing(false); if(onCloseEdit) onCloseEdit(); };
  const handleInputChange = (e) => { 
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); 
  };

  // Checklist Handlers
  const addStep = () => setFormData(prev => ({ ...prev, checklist: [...(prev.checklist || []), { id: `step_${Date.now()}`, text: "", startDate: "", endDate: "", checked: false }] }));
  const removeStep = (id) => setFormData(prev => ({ ...prev, checklist: prev.checklist.filter(s => s.id !== id) }));
  const updateStep = (id, field, val) => setFormData(prev => ({ ...prev, checklist: prev.checklist.map(s => s.id === id ? { ...s, [field]: val } : s) }));
  
  // Reordenação do Checklist (Drag and Drop Simples com botões)
  const moveStep = (index, direction) => {
    const newChecklist = [...(formData.checklist || [])];
    if (direction === 'up' && index > 0) {
        [newChecklist[index], newChecklist[index - 1]] = [newChecklist[index - 1], newChecklist[index]];
    } else if (direction === 'down' && index < newChecklist.length - 1) {
        [newChecklist[index], newChecklist[index + 1]] = [newChecklist[index + 1], newChecklist[index]];
    }
    setFormData(prev => ({ ...prev, checklist: newChecklist }));
  }

  // Atualização direta do checklist na view (sem modo edição)
  const toggleStepCheck = (stepId, currentStatus) => {
    const newChecklist = plan.checklist.map(s => s.id === stepId ? { ...s, checked: !currentStatus } : s);
    // Recalcula progresso antes de salvar
    const completed = newChecklist.filter(i => i.checked).length;
    const progress = Math.round((completed / newChecklist.length) * 100);
    onSave(plan.id, { checklist: newChecklist, progress });
  };

  const updateStepDate = (stepId, field, newDate) => {
    const newChecklist = plan.checklist.map(s => s.id === stepId ? { ...s, [field]: newDate } : s);
    onSave(plan.id, { checklist: newChecklist });
  }

  const progress = parseInt(formData.progress) || 0;
  const progressColor = progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-600' : 'bg-slate-300';
  const hasNotes = Boolean(plan.notes && plan.notes.trim().length > 0);

  if (isEditing) {
    return (
      <div className={`bg-white rounded-xl shadow-2xl border-2 border-blue-500 flex flex-col h-full relative z-50 ${startEditing ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl max-h-[90vh]' : ''}`}>
        <div className="p-5 bg-blue-50 border-b border-blue-100 flex flex-col gap-4">
           <div className="flex justify-between items-center">
             <input name="package" value={formData.package} onChange={handleInputChange} className="text-sm font-bold text-blue-600 uppercase bg-transparent border-b border-blue-300 w-1/3 focus:border-blue-600 focus:outline-none" placeholder="PACOTE" />
             <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
           </div>
           <input name="title" value={formData.title} onChange={handleInputChange} className="font-bold text-xl text-slate-800 bg-transparent border-b border-blue-300 w-full focus:border-blue-600 focus:outline-none" placeholder="Título da Ação" />
           <div className="flex gap-3">
             <div className="flex flex-col flex-grow">
               <label className="text-[10px] uppercase font-bold text-blue-400 mb-1">Status da Ação</label>
               <select name="status" value={formData.status} onChange={handleInputChange} className="text-sm border border-blue-200 rounded px-3 py-1.5 bg-white text-slate-600 focus:ring-1 focus:ring-blue-500 w-full">
                  <option value="Não Iniciado">Não Iniciado</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Concluído">Concluído</option>
               </select>
             </div>
             <div className="flex flex-col">
               <label className="text-[10px] uppercase font-bold text-blue-400 mb-1">Fase (1-3)</label>
               <input name="phase" type="number" min="1" max="3" value={formData.phase} onChange={handleInputChange} className="text-sm border border-blue-200 rounded px-3 py-1.5 w-24" placeholder="1" />
             </div>
           </div>
        </div>
        <div className="p-5 space-y-6 overflow-y-auto flex-grow bg-slate-50/50">
           <div className="flex items-center gap-2 mb-2">
             <input 
               type="checkbox" 
               id="requiresApproval"
               name="requiresApproval" 
               checked={formData.requiresApproval || false} 
               onChange={handleInputChange}
               className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
             />
             <label htmlFor="requiresApproval" className="text-xs font-bold text-orange-700 flex items-center gap-1 cursor-pointer select-none">
                <AlertTriangle size={12}/> Requer Aprovação da Diretoria?
             </label>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col">
               <label className="text-xs uppercase font-bold text-slate-400 mb-1.5">Líder</label>
               <input name="leader" value={formData.leader} onChange={handleInputChange} className="text-sm border border-slate-300 rounded p-2" />
             </div>
             <div className="flex flex-col">
               <label className="text-xs uppercase font-bold text-slate-400 mb-1.5">Área</label>
               <input name="area" value={formData.area} onChange={handleInputChange} className="text-sm border border-slate-300 rounded p-2" />
             </div>
           </div>
           
           <div className="flex flex-col">
             <label className="text-xs uppercase font-bold text-slate-400 mb-1.5">Descrição</label>
             <textarea name="description" value={formData.description} onChange={handleInputChange} className="w-full text-sm border border-slate-300 rounded p-2 min-h-[80px]" />
           </div>

           <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-3 gap-4">
                 <div className="col-span-1">
                   <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Data Início</label>
                   <input name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full text-sm border border-slate-200 rounded p-2" placeholder="DD/MM/AAAA" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Data Fim Estimada</label>
                   <input name="endDate" value={formData.endDate} onChange={handleInputChange} className="w-full text-sm border border-slate-200 rounded p-2" placeholder="DD/MM/AAAA" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Fornecedor Atual</label>
                   <input name="supplier" value={formData.supplier} onChange={handleInputChange} className="w-full text-sm border border-slate-200 rounded p-2" />
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                  <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Investimento Nec.</label>
                      <input name="investment" value={formData.investment} onChange={handleInputChange} className="w-full text-sm border border-slate-200 rounded p-2 bg-slate-50" />
                  </div>
                  <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Custo 2025</label>
                      <input name="cost2025" value={formData.cost2025} onChange={handleInputChange} className="w-full text-sm border border-slate-200 rounded p-2 bg-slate-50" />
                  </div>
                  <div>
                      <label className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1 block">Economia Estimada</label>
                      <input name="savings" value={formData.savings} onChange={handleInputChange} className="w-full text-sm font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded p-2" />
                  </div>
              </div>
           </div>

           {/* Progresso Manual com Slider (Desabilitado se houver checklist) */}
           <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                 <label className="text-[10px] uppercase font-bold text-slate-500">
                    Progresso {formData.checklist?.length > 0 ? "(Automático via Checklist)" : "(Manual)"}
                 </label>
                 <div className="flex items-center bg-white border border-slate-200 rounded px-2 py-1 shadow-sm">
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      name="progress"
                      value={progress} 
                      onChange={handleInputChange} 
                      disabled={formData.checklist?.length > 0}
                      className="w-10 text-right text-xs font-bold text-blue-600 outline-none border-none p-0 disabled:text-slate-400"
                    />
                    <span className="text-[10px] font-bold text-slate-400 ml-1">%</span>
                 </div>
              </div>
              <div className="relative h-6 flex items-center">
                 <input 
                   type="range" 
                   min="0" 
                   max="100" 
                   step="1" 
                   value={progress} 
                   name="progress" 
                   onChange={handleInputChange} 
                   disabled={formData.checklist?.length > 0}
                   className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:accent-slate-400"
                 />
              </div>
           </div>

           {/* Notas */}
           <div className="flex flex-col">
             <label className="text-xs uppercase font-bold text-slate-400 mb-1.5">Notas / Observações</label>
             <textarea name="notes" value={formData.notes || ""} onChange={handleInputChange} className="w-full text-sm border border-slate-300 rounded p-2 min-h-[60px]" placeholder="Observações internas..." />
           </div>

           <div className="border-t border-slate-200 pt-5">
              <div className="flex justify-between items-center mb-4">
                 <span className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2"><CheckSquare size={16}/> Checklist de Etapas</span>
                 <button onClick={addStep} className="text-blue-600 text-xs font-bold uppercase flex items-center hover:bg-blue-50 px-3 py-1.5 rounded transition-colors"><Plus size={12} className="mr-1"/> Adicionar</button>
              </div>
              <div className="space-y-3">
                 {(formData.checklist || []).map((step, index) => (
                    <div key={step.id} className="flex flex-col gap-2 bg-white border border-slate-200 p-3 rounded shadow-sm group/step">
                       <div className="flex gap-3 items-center">
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="text-slate-300 hover:text-blue-500 disabled:opacity-30"><ChevronUp size={12} /></button>
                            <button onClick={() => moveStep(index, 'down')} disabled={index === (formData.checklist.length - 1)} className="text-slate-300 hover:text-blue-500 disabled:opacity-30"><ChevronDown size={12} /></button>
                          </div>
                          <input type="checkbox" checked={step.checked} onChange={(e) => updateStep(step.id, 'checked', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                          <input value={step.text} onChange={(e) => updateStep(step.id, 'text', e.target.value)} className="flex-grow text-sm border-none focus:ring-0 p-0 text-slate-700" placeholder="Descreva a etapa..." />
                          <button onClick={() => removeStep(step.id)} className="text-slate-300 hover:text-red-500 transition-colors ml-2"><Trash2 size={16}/></button>
                       </div>
                       <div className="flex gap-3 ml-7">
                          <div className="flex flex-col w-1/2">
                             <label className="text-[9px] uppercase text-slate-400 font-bold">Início</label>
                             <input type="date" value={step.startDate || ""} onChange={(e) => updateStep(step.id, 'startDate', e.target.value)} className="text-xs text-slate-500 border border-slate-200 rounded p-1" />
                          </div>
                          <div className="flex flex-col w-1/2">
                             <label className="text-[9px] uppercase text-slate-400 font-bold">Fim</label>
                             <input type="date" value={step.endDate || ""} onChange={(e) => updateStep(step.id, 'endDate', e.target.value)} className="text-xs text-slate-500 border border-slate-200 rounded p-1" />
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
        <div className="p-5 bg-white border-t border-slate-200 flex justify-between items-center mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           <button onClick={() => onDelete(plan.id)} className="text-red-500 hover:bg-red-50 p-2.5 rounded transition-colors"><Trash2 size={20}/></button>
           <div className="flex gap-4">
             <button onClick={handleCancel} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors">Cancelar</button>
             <button onClick={handleSave} className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors flex items-center gap-2"><Save size={16}/> Salvar Alterações</button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 flex flex-col group relative overflow-visible ${isDescriptionExpanded ? 'row-span-2' : ''}`}>
      <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button onClick={() => setIsEditing(true)} className="p-2 bg-white text-slate-400 hover:text-blue-600 border border-slate-200 rounded-lg shadow-sm hover:shadow">
          <Edit2 size={14} />
        </button>
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
         {plan.requiresApproval && <ApprovalBadge />}
         <StatusBadge status={plan.status} />
      </div>
      <div className="p-6 flex flex-col h-full">
        <div className="mb-4 min-h-[5rem] flex flex-col justify-start border-b border-slate-100 pb-2">
           <button onClick={() => onFilter('package', plan.package)} className="text-xs font-bold text-blue-600 uppercase tracking-wider hover:underline w-fit mb-1.5">
             {plan.package}
           </button>
           <h3 className="font-bold text-lg text-slate-900 leading-tight line-clamp-2" title={plan.title}>
             {plan.title}
           </h3>
        </div>
        <div className="flex flex-col justify-center min-h-[3rem] mb-4 space-y-1">
           <button onClick={() => onFilter('leader', plan.leader)} className="flex items-center gap-2 text-xs text-slate-600 hover:text-blue-600 transition-colors w-fit">
             <User size={14} className="text-slate-400"/> <span className="truncate max-w-[200px]">{plan.leader}</span>
           </button>
           <button onClick={() => onFilter('area', plan.area)} className="flex items-center gap-2 text-xs text-slate-600 hover:text-blue-600 transition-colors w-fit">
             <Briefcase size={14} className="text-slate-400"/> <span className="truncate max-w-[200px]">{plan.area}</span>
           </button>
        </div>
        <div className="grid grid-cols-3 gap-0 bg-slate-50 rounded-lg border border-slate-200 min-h-[5rem] mb-5 overflow-hidden">
           <div className="col-span-1 border-r border-slate-200 flex items-center justify-center text-center p-2 hover:bg-slate-100 transition-colors">
              <MoneyDisplay label="INVESTIMENTO NECESSÁRIO" value={plan.investment} />
           </div>
           <div className="col-span-1 border-r border-slate-200 flex items-center justify-center text-center p-2 hover:bg-slate-100 transition-colors">
              <MoneyDisplay label="CUSTO EM 2025" value={plan.cost2025} />
           </div>
           <div className="col-span-1 flex items-center justify-center text-center p-2 bg-emerald-50/30 hover:bg-emerald-100/50 transition-colors">
              <MoneyDisplay label="ECONOMIA ESTIMADA" value={plan.savings} highlight />
           </div>
        </div>
        <div className={`mb-4 relative ${isDescriptionExpanded ? '' : 'max-h-[4rem] overflow-hidden'}`}>
          <p className="text-sm text-slate-600 leading-relaxed">
            {plan.description || "Sem descrição definida para esta ação."}
          </p>
          {!isDescriptionExpanded && (
             <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"></div>
          )}
        </div>
        <button 
          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} 
          className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide self-start mb-4 flex items-center gap-1"
        >
          {isDescriptionExpanded ? "Recolher Descrição" : "Ver Mais Descrição"} {isDescriptionExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </button>
        
        <div className="mt-auto pt-4 relative">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progresso Global</span>
            <span className="text-xs font-bold text-slate-700">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-700 ease-out ${progressColor}`} style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex items-center justify-between h-8">
             {(plan.checklist || []).length > 0 ? (
                <button 
                  onClick={() => setShowChecklist(!showChecklist)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline bg-blue-50 px-2 py-1 rounded transition-colors"
                >
                  {showChecklist ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  {showChecklist ? "Ocultar Etapas" : `Mostrar ${plan.checklist.length} Etapas`}
                </button>
             ) : <div className="text-[10px] text-slate-300 italic">Sem checklist</div>}
             
             {/* Note Icon Tooltip */}
             {hasNotes && (
               <div className="relative group/note z-50">
                  <div className={`cursor-help flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase transition-transform hover:scale-105 shadow-sm bg-amber-50 text-amber-800 border-amber-200`}>
                    <MessageSquare size={12} strokeWidth={2.5} />
                    <span>Nota</span>
                  </div>
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-slate-900/95 backdrop-blur text-white text-xs rounded-xl shadow-2xl opacity-0 group-hover/note:opacity-100 transition-all duration-200 pointer-events-none translate-y-2 group-hover/note:translate-y-0 z-50">
                    <p className="leading-relaxed font-light">{plan.notes}</p>
                    <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-slate-900/95"></div>
                  </div>
               </div>
             )}
          </div>
          
          {showChecklist && (
            <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 animate-in fade-in slide-in-from-top-2">
               {(plan.checklist || []).map((step) => (
                   <div key={step.id} className="flex flex-col gap-1 p-2 border border-slate-100 rounded hover:border-blue-200 transition-colors bg-white">
                     <div className="flex items-start gap-3">
                       <button 
                          onClick={() => toggleStepCheck(step.id, step.checked)}
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${step.checked ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-white border-slate-300 hover:border-blue-400'}`}
                       >
                         {step.checked && <CheckSquare size={10} className="text-white" strokeWidth={4} />}
                       </button>
                       <span className={`text-sm leading-snug block flex-grow ${step.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>{step.text}</span>
                     </div>
                     <div className="flex gap-2 ml-7 mt-1">
                        <div className="flex items-center gap-1">
                           <span className="text-[9px] text-slate-400 uppercase font-bold">Início:</span>
                           <input 
                             type="date" 
                             value={step.startDate || ""} 
                             onChange={(e) => updateStepDate(step.id, 'startDate', e.target.value)}
                             className="text-[10px] text-slate-500 border-none p-0 focus:ring-0 bg-transparent h-auto w-20"
                           />
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="text-[9px] text-slate-400 uppercase font-bold">Fim:</span>
                           <input 
                             type="date" 
                             value={step.endDate || ""} 
                             onChange={(e) => updateStepDate(step.id, 'endDate', e.target.value)}
                             className="text-[10px] text-slate-500 border-none p-0 focus:ring-0 bg-transparent h-auto w-20"
                           />
                        </div>
                     </div>
                   </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function AusterityApp() {
  const [plans, setPlans] = useState([]);
  const [currentView, setCurrentView] = useState('list'); 
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [sortConfig, setSortConfig] = useState([]);

  // Filtros
  const [filters, setFilters] = useState({
    package: '', area: '', leader: '', search: '', status: '', approval: ''
  });

  useEffect(() => {
    const initAuth = async () => {
        try { await signInAnonymously(auth); } catch (error) { console.error("Erro auth:", error); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const plansRef = collection(db, 'plans');
    const q = query(plansRef, orderBy('title')); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Função helper para setar filtros vindo dos cards
  const handleFilterFromCard = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeFilter = (field) => {
    setFilters(prev => ({ ...prev, [field]: '' }));
  };

  // Funções de Ordenação (Simplificada)
  const handleSort = (key) => {
    setSortConfig(prevConfig => {
      const currentSort = prevConfig[0];
      if (currentSort && currentSort.key === key) {
         if (currentSort.direction === 'asc') return [{ key, direction: 'desc' }];
         return [{ key, direction: 'asc' }];
      }
      return [{ key, direction: 'asc' }];
    });
  };

  // Funcao para formatar data do Excel
  const formatExcelDate = (value) => {
    if (!value) return "";
    if (typeof value === 'number' && value > 20000) {
       const date = new Date(Math.round((value - 25569) * 86400 * 1000));
       date.setSeconds(date.getSeconds() + 10); 
       return date.toLocaleDateString('pt-BR'); 
    }
    return value;
  };

  // EXPORTAÇÃO EXCEL ATUALIZADA
  const handleExportData = () => {
    if (typeof XLSX === 'undefined') {
      alert("A biblioteca 'xlsx' não está ativa. No modo preview, baixando CSV simples.");
      return; 
    }

    const dataToExport = [];
    (plans.length > 0 ? plans : []).forEach(p => {
        const baseData = {
          "Título": p.title,
          "Pacote": p.package,
          "Área": p.area,
          "Líder do Projeto": p.leader,
          "Descrição": p.description,
          "Fornecedor": p.supplier,
          "Data Início": p.startDate,
          "Data Fim": p.endDate,
          "Fase": p.phase,
          "Investimento Necessário": p.investment,
          "Custo em 2025": p.cost2025,
          "Economia Esperada": p.savings,
          "Status": p.status,
          "Notas": p.notes,
          "Requer Aprovação?": p.requiresApproval ? "Sim" : "Não",
          "Progresso (%)": p.progress
        };

        if (p.checklist && p.checklist.length > 0) {
            p.checklist.forEach(step => {
                dataToExport.push({
                    ...baseData,
                    "Etapa - Descrição": step.text,
                    "Etapa - Data Início": step.startDate,
                    "Etapa - Data Fim": step.endDate,
                    "Etapa - Concluída?": step.checked ? "Sim" : "Não"
                });
            });
        } else {
            dataToExport.push({
                ...baseData,
                "Etapa - Descrição": "",
                "Etapa - Data Início": "",
                "Etapa - Data Fim": "",
                "Etapa - Concluída?": ""
            });
        }
    });

    if (dataToExport.length === 0) {
        dataToExport.push({ "Título": "Exemplo" });
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados_Normalizados");
    XLSX.writeFile(wb, "plano_austeridade_completo.xlsx");
  };

  const handleSavePlan = async (id, updatedData) => {
     try { await updateDoc(doc(db, 'plans', id), updatedData); } 
     catch (e) { alert("Erro ao salvar: " + e.message); }
  };

  const handleDeletePlan = async (id) => {
      if (confirm("Tem certeza que deseja excluir esta ação?")) {
          await deleteDoc(doc(db, 'plans', id));
      }
  };

  const handleCreatePlan = async () => {
    try {
      setFilters({ package: '', area: '', leader: '', search: '', status: '', approval: '' });
      const newPlan = {
        title: "Nova Ação de Austeridade",
        package: "Geral",
        area: "A definir",
        leader: "A definir",
        description: "Descreva a iniciativa aqui...",
        status: "Não Iniciado",
        progress: 0,
        checklist: [],
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'plans'), newPlan);
      if(currentView === 'dashboard') setCurrentView('list');
    } catch (e) {
      console.error(e);
      alert("Erro ao criar ação: " + e.message);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm("⚠️ PERIGO: Apagar TUDO?")) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'plans'));
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      alert("Base limpa!");
    } catch (error) { alert("Erro ao limpar."); } 
    finally { setLoading(false); }
  };

  // IMPORTAÇÃO EXCEL ATUALIZADA
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      alert("A biblioteca 'xlsx' não foi carregada. No ambiente de preview, esta função está desabilitada. Localmente, certifique-se de ter descomentado a importação.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) { alert("Planilha vazia."); return; }

        const batch = writeBatch(db);
        let count = 0;
        const groupedPlans = {};

        data.forEach(row => {
          const title = row['Título'] || row['Title'] || "Sem Título";
          
          if (!groupedPlans[title]) {
             groupedPlans[title] = {
                title: title,
                package: row['Pacote'] || row['Package'] || "Geral",
                area: row['Área'] || row['Area'] || "Geral",
                leader: row['Líder do Projeto'] || row['Leader'] || "A definir",
                description: row['Descrição'] || row['Description'] || "",
                supplier: row['Fornecedor'] || row['Supplier'] || "",
                startDate: formatExcelDate(row['Data Início'] || row['Start Date']),
                endDate: formatExcelDate(row['Data Fim'] || row['End Date']),
                phase: row['Fase'] || row['Phase'] || 1,
                investment: row['Investimento Necessário'] || row['Investment'] || 0,
                cost2025: row['Custo em 2025'] || row['Cost 2025'] || 0,
                savings: row['Economia Esperada'] || row['Expected Savings'] || 0,
                status: row['Status'] || "Não Iniciado",
                notes: row['Notas'] || row['Notes'] || "",
                requiresApproval: (row['Requer Aprovação?'] === 'Sim'),
                progress: row['Progresso (%)'] || row['Progresso'] || 0,
                checklist: []
             };
          }
          const stepDesc = row['Etapa - Descrição'] || row['Etapa Descrição'];
          if (stepDesc) {
             groupedPlans[title].checklist.push({
                id: `step_${Date.now()}_${Math.random()}`,
                text: stepDesc,
                startDate: formatExcelDate(row['Etapa - Data Início'] || row['Etapa Início']),
                endDate: formatExcelDate(row['Etapa - Data Fim'] || row['Etapa Fim']),
                checked: (row['Etapa - Concluída?'] || row['Etapa Concluída']) === 'Sim'
             });
          }
        });

        Object.values(groupedPlans).forEach(planData => {
           const newDocRef = doc(collection(db, "plans"));
           batch.set(newDocRef, planData);
           count++;
        });

        await batch.commit();
        alert(`${count} ações importadas com sucesso!`);
      } catch (err) {
        console.error(err);
        alert("Erro ao processar Excel.");
      }
      e.target.value = null; 
    };
    reader.readAsBinaryString(file);
  };

  const uniquePackages = useMemo(() => [...new Set(plans.map(p => p.package).filter(Boolean))], [plans]);
  const uniqueAreas = useMemo(() => [...new Set(plans.map(p => p.area).filter(Boolean))], [plans]);
  const uniqueLeaders = useMemo(() => [...new Set(plans.map(p => p.leader).filter(Boolean))], [plans]);

  // Filtering Logic (Corrigida para evitar erros de espaço/case)
  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      const pStatus = (plan.status || "").toLowerCase().trim();
      const fStatus = filters.status.toLowerCase().trim();
      
      const matchesPackage = filters.package ? plan.package === filters.package : true;
      const matchesArea = filters.area ? plan.area === filters.area : true;
      const matchesLeader = filters.leader ? plan.leader === filters.leader : true;
      
      const matchesStatus = !fStatus ? true : pStatus === fStatus;

      const matchesApproval = filters.approval === '' 
          ? true 
          : filters.approval === 'yes' 
              ? plan.requiresApproval 
              : !plan.requiresApproval;

      const matchesSearch = (plan.title || '').toLowerCase().includes(filters.search.toLowerCase()) || 
                            (plan.description || '').toLowerCase().includes(filters.search.toLowerCase());
      return matchesPackage && matchesArea && matchesLeader && matchesSearch && matchesStatus && matchesApproval;
    });
  }, [plans, filters]);

  // Sorting Logic
  const sortedPlans = useMemo(() => {
    if (sortConfig.length === 0) return filteredPlans;

    return [...filteredPlans].sort((a, b) => {
      const { key, direction } = sortConfig[0];
      let valA = a[key];
      let valB = b[key];

      if (key === 'cost2025' || key === 'savings' || key === 'progress' || key === 'investment') {
          valA = parseFloat(valA) || 0;
          valB = parseFloat(valB) || 0;
      } else {
          valA = (valA || '').toString().toLowerCase();
          valB = (valB || '').toString().toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredPlans, sortConfig]);

  const activeFilters = Object.entries(filters).filter(([key, value]) => value && key !== 'search');

  const totalSavings = sortedPlans.reduce((acc, p) => {
      const val = parseFloat(p.savings);
      return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const groupedPlans = useMemo(() => {
    if (currentView !== 'list') return null;
    const groups = sortedPlans.reduce((acc, plan) => {
      const pkg = plan.package || 'Outros';
      if (!acc[pkg]) acc[pkg] = [];
      acc[pkg].push(plan);
      return acc;
    }, {});
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedPlans, currentView]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-10">
      
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl h-[90vh]">
            <PlanCard 
              plan={editingPlan} 
              startEditing={true} 
              onSave={handleSavePlan} 
              onDelete={(id) => { handleDeletePlan(id); setEditingPlan(null); }}
              onCloseEdit={() => setEditingPlan(null)}
            />
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 text-white p-1.5 rounded"><LayoutGrid size={20} /></div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">
                Plano de Austeridade <span className="text-slate-400 font-normal">| 2026</span>
              </h1>
              <div className="flex bg-slate-100 rounded-lg p-1 ml-4 border border-slate-200">
                <button onClick={() => setCurrentView('list')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all ${currentView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={14}/> Cards</button>
                <button onClick={() => setCurrentView('table')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all ${currentView === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon size={14}/> Tabela</button>
                <button onClick={() => setCurrentView('dashboard')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all ${currentView === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><BarChart3 size={14}/> Dashboard</button>
                <button onClick={() => setCurrentView('presentation')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all ${currentView === 'presentation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Presentation size={14}/> Apresentação</button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
               <div className="hidden lg:block font-serif italic font-bold text-slate-500 text-lg border-b-2 border-slate-200 px-2 pb-0.5 mr-4">
                  Estrada dos Louros
               </div>

               <div className="hidden md:flex items-center gap-2">
                 
                 <input type="file" id="excel-input" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                 <button onClick={() => document.getElementById('excel-input').click()} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                   <Upload size={14} /> Importar Excel
                 </button>

                 <div className="h-4 w-px bg-slate-300 mx-1"></div>
                 <button onClick={handleExportData} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors">
                   <Download size={14} /> Exportar Dados
                 </button>
                 <div className="h-4 w-px bg-slate-300 mx-1"></div>
                 <button onClick={handleClearDatabase} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded hover:bg-red-100 transition-colors">
                   <Trash2 size={14} /> Limpar Base
                 </button>
               </div>
               <div className="hidden md:block text-right border-r border-slate-200 pr-4 mr-1">
                 <p className="text-slate-500 text-[10px] uppercase font-bold">Economia Filtrada</p>
                 <p className="text-emerald-600 font-bold text-base">
                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalSavings)}
                 </p>
               </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 border-b border-slate-200 py-3">
          <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-grow md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Buscar ação..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} />
              </div>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={filters.package} onChange={(e) => setFilters({...filters, package: e.target.value})}>
                <option value="">Todos Pacotes</option>
                {uniquePackages.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={filters.area} onChange={(e) => setFilters({...filters, area: e.target.value})}>
                <option value="">Todas Áreas</option>
                {uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={filters.leader} onChange={(e) => setFilters({...filters, leader: e.target.value})}>
                <option value="">Todos Líderes</option>
                {uniqueLeaders.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
               <select className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
                <option value="">Status (Todos)</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Não Iniciado">Não Iniciado</option>
                <option value="Concluído">Concluído</option>
              </select>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={filters.approval} onChange={(e) => setFilters({...filters, approval: e.target.value})}>
                <option value="">Aprovação (Todos)</option>
                <option value="yes">Requer Aprovação</option>
                <option value="no">Não Requer</option>
              </select>
              <button onClick={() => setFilters({ package: '', area: '', leader: '', search: '', status: '', approval: '' })} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 underline decoration-dotted whitespace-nowrap">Limpar Filtros</button>
            </div>
            
            {/* Visualização de Filtros Ativos */}
            {activeFilters.length > 0 && (
              <div className="flex gap-2 items-center flex-wrap pt-1 animate-in fade-in slide-in-from-top-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Filtrando por:</span>
                {activeFilters.map(([key, value]) => (
                  <button 
                    key={key} 
                    onClick={() => removeFilter(key)}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-medium border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    <span className="capitalize">
                      {key === 'leader' ? 'Líder' : key === 'area' ? 'Área' : key === 'package' ? 'Pacote' : key === 'approval' ? 'Aprovação' : 'Status'}:
                    </span> 
                    <strong>{key === 'approval' ? (value === 'yes' ? 'Sim' : 'Não') : value}</strong>
                    <X size={12} className="ml-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex gap-2 text-sm text-slate-500 items-center justify-between">
           <div className="flex gap-2 items-center">
             {currentView === 'list' ? <List size={16} /> : currentView === 'table' ? <TableIcon size={16} /> : currentView === 'presentation' ? <Presentation size={16} /> : <BarChart3 size={16} />}
             <span>
               {loading 
                ? "Carregando dados..." 
                : currentView === 'presentation' ? <span>Apresentação do Comitê</span> : <span>Mostrando <strong>{sortedPlans.length}</strong> ações</span>
               }
             </span>
           </div>
           
           {!loading && (currentView === 'list' || currentView === 'table') && (
              <button 
                onClick={handleCreatePlan}
                className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded shadow-sm"
              >
                <Plus size={14}/> Nova Ação
              </button>
           )}
        </div>

        {loading ? (
           <div className="flex justify-center items-center py-20">
             <Loader2 className="animate-spin text-blue-600" size={40} />
           </div>
        ) : (
          <>
            {currentView === 'list' && (
              <div className="space-y-8">
                {groupedPlans && groupedPlans.map(([pkgName, pkgPlans]) => (
                  <div key={pkgName}>
                    <h3 className="text-lg font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2 pl-1 flex items-center gap-2">
                      <span className="uppercase tracking-wider">{pkgName}</span>
                      <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{pkgPlans.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pkgPlans.map(plan => (
                        <PlanCard 
                          key={plan.id} 
                          plan={plan} 
                          onSave={handleSavePlan} 
                          onDelete={handleDeletePlan} 
                          onFilter={handleFilterFromCard} 
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {sortedPlans.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3"><Search size={24} /></div>
                    <h3 className="text-lg font-medium text-slate-900">Nenhuma ação encontrada</h3>
                    <p className="text-slate-500 mb-4">Seu banco de dados parece vazio ou o filtro não retornou resultados.</p>
                    <button onClick={() => document.getElementById('excel-input').click()} className="text-blue-600 font-medium hover:underline">Importar Excel</button>
                  </div>
                )}
              </div>
            )}

            {currentView === 'table' && (
               sortedPlans.length > 0 ? (
                 <TableView 
                   plans={sortedPlans} 
                   onEdit={(plan) => setEditingPlan(plan)} 
                   onDelete={handleDeletePlan} 
                   onFilter={handleFilterFromCard}
                   sortConfig={sortConfig}
                   onSort={handleSort}
                 />
               ) : (
                 <div className="text-center py-20 text-slate-500">Nenhum dado para exibir na tabela.</div>
               )
            )}

            {currentView === 'dashboard' && (
              <Dashboard plans={sortedPlans} />
            )}

            {currentView === 'presentation' && (
              <CommitteePresentation plans={sortedPlans} />
            )}
          </>
        )}
      </main>
    </div>
  );
}