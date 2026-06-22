import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Upload, LogOut, BarChart3,
  LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown,
  Clock, User, Tag, TrendingUp, Package,
  FileSpreadsheet, Eye, Loader2, ImageOff
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc,
  doc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FIREBASE CONFIG ---
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
const storage = getStorage(app);

// --- CONSTANTS ---
const STATUSES = ['Cold', 'Warm', 'Hot', 'Closing', 'Fechado', 'Perdido'];

const STATUS_CONFIG = {
  Cold:    { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300',   dot: 'bg-slate-400',    header: 'bg-slate-200',   headerText: 'text-slate-800'  },
  Warm:    { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-400',    header: 'bg-amber-100',   headerText: 'text-amber-900'  },
  Hot:     { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300',  dot: 'bg-orange-500',   header: 'bg-orange-100',  headerText: 'text-orange-900' },
  Closing: { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500',  header: 'bg-emerald-100', headerText: 'text-emerald-900'},
  Fechado: { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500',     header: 'bg-blue-100',    headerText: 'text-blue-900'   },
  Perdido: { bg: 'bg-gray-100',    text: 'text-gray-500',    border: 'border-gray-300',    dot: 'bg-gray-400',     header: 'bg-gray-200',    headerText: 'text-gray-700'   },
};

const SEGMENTS = [
  'Financial','Construction','Paints','Entertainment','Food & Beverages','Health',
  'Mobility','Hospitality','Capitalization','Pharmaceuticals','Real Estate','Electronics',
  'Home Appliances','Cosmetics','Sports','Training','Cryptocurrency','Essential Oils',
  'Restaurant','Clothing Store','Infrastructure/Energy','Delivery','E-Commerce',
  'Automotives','Media','Tourism','Technology','Marketing','Industrial','Oil and gas',
  'Airline','Bioeconomy','Nutrients','Artificial Intelligence','Commercial Refrigeration',
  'Sporting Goods','Outro'
];

const ASSETS = [
  'Others','Barter Deal','Upper Back','Lower Back','Naming','Naming CT','Number Back',
  'Punctual','Sector Rights','Short','Shoulder','Sleeves','Sternum','Tax Incentive',
  'Training Center Naming'
];

const PROPERTY_GROUPS = ['Profissional','Categorias de Base','Futebol Feminino','Estádio','Botafogo TV'];
const BARTER_TYPES = ['Não','Parcial','Total'];

const CREDENTIALS = {
  admin: { password: 'admin123', role: 'admin' },
  user:  { password: 'user123',  role: 'user'  },
};

// --- HELPERS ---
const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(parseFloat(v) || 0);

const fmtCompact = (v) => {
  const n = parseFloat(v) || 0;
  if (n === 0) return '—';
  if (Math.abs(n) >= 1000000) return `R$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000)    return `R$${(n / 1000).toFixed(0)}k`;
  return fmtBRL(n);
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch { return iso; }
};

const initials = (name) =>
  (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const BRAND_COLORS = ['bg-indigo-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-violet-500','bg-pink-500','bg-orange-500'];
const brandColor = (name) => BRAND_COLORS[(name || '').charCodeAt(0) % BRAND_COLORS.length];

// --- LOGO AVATAR ---
const LogoAvatar = ({ url, brand, size = 'md' }) => {
  const [err, setErr] = useState(false);
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  if (url && !err) {
    return <img src={url} alt={brand} onError={() => setErr(true)} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sz} rounded-full ${brandColor(brand)} flex items-center justify-center flex-shrink-0 font-bold text-white`}>
      {initials(brand)}
    </div>
  );
};

// --- STATUS BADGE ---
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Cold;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
};

// =============================================
// LOGIN SCREEN
// =============================================
const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cred = CREDENTIALS[username];
    if (cred && cred.password === password) {
      onLogin({ username, role: cred.role });
    } else {
      setError('Usuário ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-black rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Comercial</h1>
          <p className="text-gray-500 text-sm mt-1">SAF Botafogo</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="admin ou user" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="••••••••" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-700 transition-colors">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

// =============================================
// NEGOTIATION FORM MODAL
// =============================================
const NegotiationFormModal = ({ negotiation, onSave, onClose, currentUser }) => {
  const isEdit = !!negotiation?.id;
  const [form, setForm] = useState({
    brand: negotiation?.brand || '',
    logoUrl: negotiation?.logoUrl || '',
    segment: negotiation?.segment || '',
    status: negotiation?.status || 'Cold',
    statusNote: '',
    asset: negotiation?.asset || '',
    propertyGroups: negotiation?.propertyGroups || [],
    annualInvestment: negotiation?.annualInvestment || '',
    contractLength: negotiation?.contractLength || '',
    barterType: negotiation?.barterType || 'Não',
    responsible: negotiation?.responsible || '',
    notes: negotiation?.notes || '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(negotiation?.logoUrl || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const totalInvestment = useMemo(
    () => (parseFloat(form.annualInvestment) || 0) * (parseFloat(form.contractLength) || 0),
    [form.annualInvestment, form.contractLength]
  );

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const togglePropGroup = (g) =>
    setForm(f => ({
      ...f,
      propertyGroups: f.propertyGroups.includes(g) ? f.propertyGroups.filter(x => x !== g) : [...f.propertyGroups, g]
    }));

  const handleSave = async () => {
    const errs = {};
    if (!form.brand.trim()) errs.brand = 'Obrigatório';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      let logoUrl = form.logoUrl;
      if (logoFile) {
        const path = `logos/${Date.now()}-${logoFile.name}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, logoFile);
        logoUrl = await getDownloadURL(sRef);
      }
      const now = new Date().toISOString();
      const data = {
        brand: form.brand.trim(), logoUrl,
        segment: form.segment, status: form.status, asset: form.asset,
        propertyGroups: form.propertyGroups,
        annualInvestment: parseFloat(form.annualInvestment) || 0,
        contractLength: parseFloat(form.contractLength) || 0,
        totalInvestment,
        barterType: form.barterType, responsible: form.responsible.trim(),
        notes: form.notes.trim(), updatedAt: now,
      };
      if (isEdit) {
        const history = [...(negotiation.statusHistory || [])];
        if (negotiation.status !== form.status || form.statusNote) {
          history.push({ from: negotiation.status, to: form.status, date: now, changedBy: currentUser.username, note: form.statusNote });
        }
        data.statusHistory = history;
        await updateDoc(doc(db, 'negotiations', negotiation.id), data);
      } else {
        data.createdAt = now;
        data.statusHistory = [{ from: null, to: form.status, date: now, changedBy: currentUser.username, note: form.statusNote }];
        await addDoc(collection(db, 'negotiations'), data);
      }
      onSave();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Editar Negociação' : 'Nova Negociação'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Marca / Empresa *</label>
              <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={inp} placeholder="Nome da empresa" />
              {errors.brand && <p className="text-red-500 text-xs mt-1">{errors.brand}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Logo</label>
              <div className="flex items-center gap-3">
                {logoPreview
                  ? <img src={logoPreview} className="w-10 h-10 rounded-full object-cover border" alt="logo" />
                  : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><ImageOff size={14} className="text-gray-400" /></div>
                }
                <label className="cursor-pointer flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                  <Upload size={13} /> Enviar logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Segmento</label>
              <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} className={inp}>
                <option value="">Selecionar...</option>
                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nota do Status <span className="font-normal text-gray-400">(opcional — salva no histórico)</span>
            </label>
            <input value={form.statusNote} onChange={e => setForm(f => ({ ...f, statusNote: e.target.value }))} className={inp} placeholder="Ex: Reunião agendada para próxima semana" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Ativo / Propriedade Específica</label>
            <select value={form.asset} onChange={e => setForm(f => ({ ...f, asset: e.target.value }))} className={inp}>
              <option value="">Selecionar...</option>
              {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Grupos de Propriedade</label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_GROUPS.map(g => (
                <button key={g} type="button" onClick={() => togglePropGroup(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    form.propertyGroups.includes(g) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Investimento Anual (R$)</label>
              <input type="number" min="0" value={form.annualInvestment} onChange={e => setForm(f => ({ ...f, annualInvestment: e.target.value }))} className={inp} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duração Contrato (anos)</label>
              <input type="number" min="0" value={form.contractLength} onChange={e => setForm(f => ({ ...f, contractLength: e.target.value }))} className={inp} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Total Contrato</label>
              <div className="flex items-center h-[38px] px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">
                {fmtBRL(totalInvestment)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Permuta</label>
              <select value={form.barterType} onChange={e => setForm(f => ({ ...f, barterType: e.target.value }))} className={inp}>
                {BARTER_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Responsável</label>
              <input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} className={inp} placeholder="Nome do responsável" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={inp} placeholder="Notas, detalhes, próximos passos..." />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Salvar Alterações' : 'Criar Negociação'}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================
// DETAIL MODAL
// =============================================
const NegotiationDetailModal = ({ negotiation, onClose, onEdit, isAdmin }) => {
  if (!negotiation) return null;
  const history = [...(negotiation.statusHistory || [])].reverse();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <LogoAvatar url={negotiation.logoUrl} brand={negotiation.brand} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">{negotiation.brand}</h2>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={negotiation.status} />
                {negotiation.segment && <span className="text-xs text-gray-500">{negotiation.segment}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => { onClose(); onEdit(negotiation); }}
                className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100">
                <Edit2 size={14} /> Editar
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Inv. Anual', value: fmtCompact(negotiation.annualInvestment) },
              { label: 'Duração', value: negotiation.contractLength ? `${negotiation.contractLength} ano(s)` : '—' },
              { label: 'Total Contrato', value: fmtCompact(negotiation.totalInvestment) },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                <p className="font-bold text-gray-900 text-sm">{k.value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3 mb-6">
            {negotiation.asset && (
              <div className="flex items-start gap-3">
                <Package size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-gray-500">Ativo</p><p className="text-sm text-gray-900">{negotiation.asset}</p></div>
              </div>
            )}
            {negotiation.propertyGroups?.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Grupos de Propriedade</p>
                  <div className="flex flex-wrap gap-1">
                    {negotiation.propertyGroups.map(g => (
                      <span key={g} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">{g}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {negotiation.barterType && negotiation.barterType !== 'Não' && (
              <div className="flex items-start gap-3">
                <TrendingUp size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-gray-500">Permuta</p><p className="text-sm text-gray-900">{negotiation.barterType}</p></div>
              </div>
            )}
            {negotiation.responsible && (
              <div className="flex items-start gap-3">
                <User size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-gray-500">Responsável</p><p className="text-sm text-gray-900">{negotiation.responsible}</p></div>
              </div>
            )}
            {negotiation.notes && (
              <div className="flex items-start gap-3">
                <Eye size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-gray-500">Observações</p><p className="text-sm text-gray-900 whitespace-pre-line">{negotiation.notes}</p></div>
              </div>
            )}
          </div>
          {history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={14} /> Histórico de Status</h3>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {h.from && <><StatusBadge status={h.from} /><span className="text-gray-400">→</span></>}
                        <StatusBadge status={h.to} />
                        <span className="text-gray-400">por {h.changedBy}</span>
                      </div>
                      <div className="text-gray-400 mt-0.5">{fmtDate(h.date)}</div>
                      {h.note && <div className="text-gray-600 mt-0.5 italic">"{h.note}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================
// KANBAN VIEW
// =============================================
const KanbanView = ({ negotiations, isAdmin, onCardClick, onStatusChange }) => {
  const dragId = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const byStatus = useMemo(() => {
    const map = {};
    STATUSES.forEach(s => { map[s] = { items: [], total: 0 }; });
    negotiations.forEach(n => {
      const key = STATUSES.includes(n.status) ? n.status : 'Cold';
      map[key].items.push(n);
      map[key].total += n.annualInvestment || 0;
    });
    return map;
  }, [negotiations]);

  const handleDrop = (e, status) => {
    e.preventDefault();
    setDragOver(null);
    const id = dragId.current;
    if (!id) return;
    const neg = negotiations.find(n => n.id === id);
    if (neg && neg.status !== status) onStatusChange(neg, status);
    dragId.current = null;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
      {STATUSES.map(status => {
        const cfg = STATUS_CONFIG[status];
        const col = byStatus[status];
        const isDragTarget = dragOver === status;
        return (
          <div key={status}
            className={`flex-shrink-0 w-64 flex flex-col rounded-xl border transition-colors ${isDragTarget ? 'border-gray-400 ring-2 ring-gray-300' : 'border-gray-200'} bg-gray-50/80`}
            onDragOver={e => { e.preventDefault(); setDragOver(status); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => handleDrop(e, status)}
          >
            <div className={`px-3 py-2.5 rounded-t-xl ${cfg.header}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-sm font-bold ${cfg.headerText}`}>{status}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full bg-white/60 font-semibold ${cfg.headerText}`}>{col.items.length}</span>
                </div>
                <span className={`text-xs font-semibold ${cfg.headerText}`}>{fmtCompact(col.total)}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              {col.items.map(neg => (
                <div key={neg.id}
                  draggable={isAdmin}
                  onDragStart={() => { dragId.current = neg.id; }}
                  onClick={() => onCardClick(neg)}
                  className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow hover:border-gray-300 active:opacity-80 select-none"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <LogoAvatar url={neg.logoUrl} brand={neg.brand} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-gray-900 truncate">{neg.brand}</p>
                      {neg.segment && <p className="text-xs text-gray-400 truncate">{neg.segment}</p>}
                    </div>
                  </div>
                  {neg.asset && <p className="text-xs text-gray-500 mb-1.5 truncate">{neg.asset}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">{fmtCompact(neg.annualInvestment)}<span className="text-gray-400 font-normal">/ano</span></span>
                    {neg.responsible && <span className="text-xs text-gray-400 truncate ml-2">{neg.responsible}</span>}
                  </div>
                </div>
              ))}
              {col.items.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  Nenhuma negociação
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================
// CARDS VIEW
// =============================================
const CardsView = ({ negotiations, onCardClick }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {negotiations.map(neg => (
      <div key={neg.id} onClick={() => onCardClick(neg)}
        className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg transition-all hover:border-gray-300"
      >
        <div className="flex items-start justify-between mb-3">
          <LogoAvatar url={neg.logoUrl} brand={neg.brand} size="lg" />
          <StatusBadge status={neg.status} />
        </div>
        <h3 className="font-bold text-gray-900 text-lg mb-0.5">{neg.brand}</h3>
        {neg.segment && <p className="text-sm text-gray-500 mb-3">{neg.segment}</p>}
        {neg.asset && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
            <Package size={12} className="text-gray-400" />{neg.asset}
          </div>
        )}
        {neg.propertyGroups?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {neg.propertyGroups.map(g => <span key={g} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{g}</span>)}
          </div>
        )}
        <div className="border-t border-gray-100 pt-3 mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
          <div><p className="text-gray-400">Inv. Anual</p><p className="font-bold text-gray-900">{fmtCompact(neg.annualInvestment)}</p></div>
          <div><p className="text-gray-400">Duração</p><p className="font-bold text-gray-900">{neg.contractLength ? `${neg.contractLength}a` : '—'}</p></div>
          <div><p className="text-gray-400">Total</p><p className="font-bold text-gray-900">{fmtCompact(neg.totalInvestment)}</p></div>
          <div>
            <p className="text-gray-400">Permuta</p>
            <p className={`font-semibold ${neg.barterType && neg.barterType !== 'Não' ? 'text-amber-600' : 'text-gray-900'}`}>{neg.barterType || 'Não'}</p>
          </div>
        </div>
        {neg.responsible && <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500"><User size={11} />{neg.responsible}</div>}
        {neg.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{neg.notes}</p>}
      </div>
    ))}
    {negotiations.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400">Nenhuma negociação encontrada.</div>}
  </div>
);

// =============================================
// TABLE VIEW
// =============================================
const TableView = ({ negotiations, isAdmin, onRowClick, onEdit, onDelete }) => {
  const [sort, setSort] = useState({ col: 'brand', dir: 'asc' });
  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });

  const sorted = useMemo(() => [...negotiations].sort((a, b) => {
    const va = a[sort.col], vb = b[sort.col];
    if (typeof va === 'number') return sort.dir === 'asc' ? va - vb : vb - va;
    return sort.dir === 'asc' ? String(va||'').localeCompare(String(vb||'')) : String(vb||'').localeCompare(String(va||''));
  }), [negotiations, sort]);

  const totals = useMemo(() => ({
    annualInvestment: negotiations.reduce((s, n) => s + (n.annualInvestment || 0), 0),
    totalInvestment: negotiations.reduce((s, n) => s + (n.totalInvestment || 0), 0),
  }), [negotiations]);

  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };
  const Th = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="px-3 py-3 text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap select-none text-left">
      <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 w-10" />
              <Th col="brand" label="Marca" />
              <Th col="segment" label="Segmento" />
              <Th col="status" label="Status" />
              <Th col="asset" label="Ativo" />
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Grupos</th>
              <Th col="annualInvestment" label="Inv. Anual" />
              <Th col="contractLength" label="Duração" />
              <Th col="totalInvestment" label="Total" />
              <Th col="barterType" label="Permuta" />
              <Th col="responsible" label="Responsável" />
              {isAdmin && <th className="px-3 py-3 w-20" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(neg => (
              <tr key={neg.id} onClick={() => onRowClick(neg)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-3 py-2.5"><LogoAvatar url={neg.logoUrl} brand={neg.brand} size="sm" /></td>
                <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{neg.brand}</td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{neg.segment || '—'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><StatusBadge status={neg.status} /></td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{neg.asset || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(neg.propertyGroups||[]).map(g => <span key={g} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{g}</span>)}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{fmtCompact(neg.annualInvestment)}</td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{neg.contractLength ? `${neg.contractLength}a` : '—'}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{fmtCompact(neg.totalInvestment)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {neg.barterType && neg.barterType !== 'Não'
                    ? <span className="text-xs font-semibold text-amber-600">{neg.barterType}</span>
                    : <span className="text-xs text-gray-400">Não</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{neg.responsible || '—'}</td>
                {isAdmin && (
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEdit(neg)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit2 size={13} /></button>
                      <button onClick={() => onDelete(neg)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td colSpan={6} className="px-3 py-3 text-xs text-gray-500 font-semibold">TOTAL ({negotiations.length} negociações)</td>
              <td className="px-3 py-3 text-sm font-bold text-gray-900">{fmtBRL(totals.annualInvestment)}</td>
              <td />
              <td className="px-3 py-3 text-sm font-bold text-gray-900">{fmtBRL(totals.totalInvestment)}</td>
              <td colSpan={isAdmin ? 3 : 2} />
            </tr>
          </tfoot>
        </table>
      </div>
      {negotiations.length === 0 && <div className="text-center py-16 text-gray-400">Nenhuma negociação encontrada.</div>}
    </div>
  );
};

// =============================================
// CHART COMPONENTS
// =============================================
const SimpleBarChart = ({ data, valueFormatter }) => {
  if (!data || data.length === 0) return <p className="text-xs text-gray-400 py-4 text-center">Sem dados</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.slice(0, 8).map(d => (
        <div key={d.label} className="flex items-center gap-3 text-xs">
          <div className="w-28 text-right text-gray-600 truncate flex-shrink-0">{d.label}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div className="h-full bg-gray-800 rounded-full flex items-center px-2 transition-all"
              style={{ width: `${Math.max((d.value / max) * 100, 2)}%` }}>
              {(d.value / max) > 0.2 && <span className="text-white text-xs font-semibold truncate">{valueFormatter ? valueFormatter(d.value) : d.value}</span>}
            </div>
          </div>
          <div className="w-20 text-left text-gray-700 font-semibold flex-shrink-0">{valueFormatter ? valueFormatter(d.value) : d.value}</div>
        </div>
      ))}
    </div>
  );
};

const SimplePieChart = ({ data }) => {
  if (!data || data.length === 0) return <p className="text-xs text-gray-400 text-center">Sem dados</p>;
  const total = data.reduce((s, d) => s + d.value, 0);
  const COLORS = ['#1f2937','#374151','#6b7280','#9ca3af','#d1d5db'];
  const toRad = deg => (deg - 90) * (Math.PI / 180);
  const cx = 50, cy = 50, r = 40;
  let cum = 0;
  const segments = data.map((d, i) => {
    const pct = total > 0 ? d.value / total : 0;
    const start = cum * 360;
    cum += pct;
    const end = cum * 360;
    const large = end - start > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos(toRad(start)), y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end)), y2 = cy + r * Math.sin(toRad(end));
    return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: COLORS[i % COLORS.length], pct };
  });
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32 flex-shrink-0">
        {segments.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity="0.85" />)}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-gray-700">{s.label}</span>
            <span className="text-gray-500 font-semibold ml-2">{Math.round(s.pct * 100)}%</span>
            <span className="text-gray-400">({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================
// DASHBOARD VIEW
// =============================================
const DashboardView = ({ negotiations }) => {
  const active = useMemo(() => negotiations.filter(n => n.status !== 'Perdido'), [negotiations]);
  const kpis = useMemo(() => ({
    totalPipeline: active.reduce((s, n) => s + (n.annualInvestment || 0), 0),
    totalContract: active.reduce((s, n) => s + (n.totalInvestment || 0), 0),
    byStatus: STATUSES.reduce((acc, s) => { acc[s] = negotiations.filter(n => n.status === s).length; return acc; }, {}),
  }), [negotiations, active]);

  const funnelStatuses = ['Cold','Warm','Hot','Closing','Fechado'];
  const funnelData = useMemo(() => funnelStatuses.map(s => ({
    status: s,
    count: negotiations.filter(n => n.status === s).length,
    value: negotiations.filter(n => n.status === s).reduce((sum, n) => sum + (n.annualInvestment || 0), 0),
  })), [negotiations]);
  const maxFunnelCount = Math.max(...funnelData.map(f => f.count), 1);

  const segmentData = useMemo(() => {
    const map = {};
    active.forEach(n => { if (n.segment) map[n.segment] = (map[n.segment]||0) + (n.annualInvestment||0); });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [active]);

  const assetData = useMemo(() => {
    const map = {};
    negotiations.forEach(n => { if (n.asset) map[n.asset] = (map[n.asset]||0) + 1; });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [negotiations]);

  const propGroupData = useMemo(() => {
    const map = {};
    negotiations.forEach(n => (n.propertyGroups||[]).forEach(g => { map[g] = (map[g]||0) + (n.annualInvestment||0); }));
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [negotiations]);

  const barterData = useMemo(() => {
    const map = { 'Não': 0, 'Parcial': 0, 'Total': 0 };
    negotiations.forEach(n => { map[n.barterType||'Não'] = (map[n.barterType||'Não']||0) + 1; });
    return Object.entries(map).filter(([,v]) => v > 0).map(([label, value]) => ({ label, value }));
  }, [negotiations]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Pipeline Ativo (Anual)</p>
          <p className="text-2xl font-bold text-gray-900">{fmtCompact(kpis.totalPipeline)}</p>
          <p className="text-xs text-gray-400 mt-1">{active.length} negociações ativas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Valor Total dos Contratos</p>
          <p className="text-2xl font-bold text-gray-900">{fmtCompact(kpis.totalContract)}</p>
          <p className="text-xs text-gray-400 mt-1">Soma de todos os totais</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Contratos Fechados</p>
          <p className="text-2xl font-bold text-blue-700">{kpis.byStatus.Fechado || 0}</p>
          <p className="text-xs text-gray-400 mt-1">negociações fechadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Negociações Perdidas</p>
          <p className="text-2xl font-bold text-gray-500">{kpis.byStatus.Perdido || 0}</p>
          <p className="text-xs text-gray-400 mt-1">negociações perdidas</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Status</h3>
        <div className="flex flex-wrap gap-3">
          {STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <div key={s} className={`px-4 py-2 rounded-xl border ${cfg.bg} ${cfg.border} flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-sm font-semibold ${cfg.text}`}>{s}</span>
                <span className={`text-lg font-bold ${cfg.text}`}>{kpis.byStatus[s] || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Funil de Conversão</h3>
        <div className="flex items-end gap-1 h-36">
          {funnelData.map(f => {
            const cfg = STATUS_CONFIG[f.status];
            const pct = (f.count / maxFunnelCount) * 100;
            return (
              <div key={f.status} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs font-bold text-gray-700">{f.count}</div>
                <div className="w-full flex items-end" style={{ height: '88px' }}>
                  <div className={`w-full rounded-t transition-all ${cfg.dot} opacity-80`}
                    style={{ height: `${Math.max(pct, f.count > 0 ? 5 : 0)}%` }} />
                </div>
                <div className={`text-xs font-semibold ${cfg.text}`}>{f.status}</div>
                <div className="text-xs text-gray-400">{fmtCompact(f.value)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Segmentos por Pipeline</h3>
          <SimpleBarChart data={segmentData} valueFormatter={fmtCompact} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Ativo</h3>
          <SimpleBarChart data={assetData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline por Grupo de Propriedade</h3>
          <SimpleBarChart data={propGroupData} valueFormatter={fmtCompact} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Permuta vs Não-Permuta</h3>
          <SimplePieChart data={barterData} />
        </div>
      </div>
    </div>
  );
};

// =============================================
// MAIN APP
// =============================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [negotiations, setNegotiations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editingNeg, setEditingNeg] = useState(null);
  const [detailNeg, setDetailNeg] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterSegment, setFilterSegment] = useState('');
  const [filterPropGroup, setFilterPropGroup] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterBarter, setFilterBarter] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'negotiations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setNegotiations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return unsub;
  }, [currentUser]);

  const filtered = useMemo(() => negotiations.filter(n => {
    if (search && !n.brand?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus.length && !filterStatus.includes(n.status)) return false;
    if (filterSegment && n.segment !== filterSegment) return false;
    if (filterPropGroup && !(n.propertyGroups||[]).includes(filterPropGroup)) return false;
    if (filterResponsible && n.responsible !== filterResponsible) return false;
    if (filterBarter && n.barterType !== filterBarter) return false;
    return true;
  }), [negotiations, search, filterStatus, filterSegment, filterPropGroup, filterResponsible, filterBarter]);

  const responsibles = useMemo(() =>
    [...new Set(negotiations.map(n => n.responsible).filter(Boolean))].sort(), [negotiations]);

  const handleStatusChange = useCallback(async (neg, newStatus) => {
    const now = new Date().toISOString();
    const history = [...(neg.statusHistory||[]), { from: neg.status, to: newStatus, date: now, changedBy: currentUser?.username||'system', note: '' }];
    await updateDoc(doc(db, 'negotiations', neg.id), { status: newStatus, statusHistory: history, updatedAt: now });
  }, [currentUser]);

  const handleDelete = async (neg) => {
    if (!window.confirm(`Excluir "${neg.brand}"? Esta ação não pode ser desfeita.`)) return;
    await deleteDoc(doc(db, 'negotiations', neg.id));
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const mod = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
      const XLSX = mod.default || mod;
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const findVal = (row, keys) => { for (const k of keys) { const v = String(row[k]||'').trim(); if (v) return v; } return ''; };
      const now = new Date().toISOString();
      let count = 0;
      for (const row of rows) {
        const brand = findVal(row, ['BRAND','MARCA','Brand','Marca']);
        if (!brand) continue;
        const annual = parseFloat(findVal(row, ['ANNUAL INVESTMENT','INVESTIMENTO ANUAL','Annual Investment'])) || 0;
        const length = parseFloat(findVal(row, ['CONTRACT LENGTH (YEAR)','CONTRACT LENGTH','ContractLength'])) || 0;
        const rawStatus = findVal(row, ['STATUS','Status']);
        const status = STATUSES.includes(rawStatus) ? rawStatus : 'Cold';
        await addDoc(collection(db, 'negotiations'), {
          brand, logoUrl: '',
          segment: findVal(row, ['SEGMENT','SEGMENTO','Segment']),
          status, asset: findVal(row, ['ASSET','ATIVO','Asset']),
          propertyGroups: [],
          annualInvestment: annual, contractLength: length, totalInvestment: annual * length,
          barterType: findVal(row, ['BARTER','PERMUTA','Barter']) || 'Não',
          responsible: findVal(row, ['RESPONSIBLE','RESPONSAVEL','Responsible']),
          notes: findVal(row, ['DETAILS','OBSERVACOES','NOTES','Notes']),
          statusHistory: [{ from: null, to: status, date: now, changedBy: currentUser?.username||'import', note: 'Importado via Excel' }],
          createdAt: now, updatedAt: now,
        });
        count++;
      }
      alert(`${count} negociações importadas com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao importar: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearFilters = () => { setSearch(''); setFilterStatus([]); setFilterSegment(''); setFilterPropGroup(''); setFilterResponsible(''); setFilterBarter(''); };
  const hasFilters = search || filterStatus.length || filterSegment || filterPropGroup || filterResponsible || filterBarter;

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;

  const VIEWS = [
    { key: 'kanban', label: 'Kanban', icon: LayoutGrid },
    { key: 'cards',  label: 'Cards',  icon: Package  },
    { key: 'table',  label: 'Tabela', icon: List     },
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-black text-sm">B</span>
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight">Pipeline Comercial</h1>
                <p className="text-gray-400 text-xs">SAF Botafogo</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center bg-gray-800 rounded-lg p-1 gap-0.5">
              {VIEWS.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setView(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                    <span className="hidden md:inline">Importar XLS</span>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} disabled={importing} />
                  </label>
                  <button onClick={() => { setEditingNeg(null); setShowForm(true); }}
                    className="flex items-center gap-1.5 bg-white text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap">
                    <Plus size={13} /> Nova
                  </button>
                </>
              )}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 pl-2 border-l border-gray-700">
                <User size={13} />
                <span className="hidden sm:inline">{currentUser.username}</span>
                <button onClick={() => setCurrentUser(null)} className="ml-1 text-gray-500 hover:text-white p-1 rounded transition-colors" title="Sair">
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex sm:hidden items-center bg-gray-800 rounded-lg p-1 gap-0.5 mt-2">
            {VIEWS.map(({ key, icon: Icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-colors ${view === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 sticky top-[65px] z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar marca..."
                className="pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-800 w-36" />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {STATUSES.map(s => {
                const active = filterStatus.includes(s);
                const cfg = STATUS_CONFIG[s];
                return (
                  <button key={s}
                    onClick={() => setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className={`px-2 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                    {s}
                  </button>
                );
              })}
            </div>
            <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800">
              <option value="">Segmento</option>
              {SEGMENTS.filter(s => s !== 'Outro').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterPropGroup} onChange={e => setFilterPropGroup(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800">
              <option value="">Grupo</option>
              {PROPERTY_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800">
              <option value="">Responsável</option>
              {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filterBarter} onChange={e => setFilterBarter(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800">
              <option value="">Permuta</option>
              {BARTER_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200">
                <X size={11} /> Limpar
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={20} /> Carregando negociações...
          </div>
        ) : (
          <>
            {view === 'kanban' && <KanbanView negotiations={filtered} isAdmin={isAdmin} onCardClick={setDetailNeg} onStatusChange={handleStatusChange} />}
            {view === 'cards' && <CardsView negotiations={filtered} onCardClick={setDetailNeg} />}
            {view === 'table' && <TableView negotiations={filtered} isAdmin={isAdmin} onRowClick={setDetailNeg} onEdit={neg => { setEditingNeg(neg); setShowForm(true); }} onDelete={handleDelete} />}
            {view === 'dashboard' && <DashboardView negotiations={filtered} />}
          </>
        )}
      </main>

      {showForm && (
        <NegotiationFormModal
          negotiation={editingNeg}
          onSave={() => { setShowForm(false); setEditingNeg(null); }}
          onClose={() => { setShowForm(false); setEditingNeg(null); }}
          currentUser={currentUser}
        />
      )}
      {detailNeg && (
        <NegotiationDetailModal
          negotiation={detailNeg}
          onClose={() => setDetailNeg(null)}
          onEdit={neg => { setDetailNeg(null); setEditingNeg(neg); setShowForm(true); }}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
