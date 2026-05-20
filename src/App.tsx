import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  History,
  Target,
  User,
  Plus,
  Mic,
  Send,
  Pencil,
  Trash2,
  Copy,
  Repeat,
  Coffee,
  Car,
  ShoppingCart,
  Wifi,
  HeartPulse,
  GraduationCap,
  Sofa,
  Gamepad2,
  PiggyBank,
  MoreHorizontal,
  Wallet,
  TrendingUp,
  CalendarDays,
  Check,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
  CircleDollarSign,
  BadgeCheck,
  BarChart3,
  Settings,
  Download,
  ArrowLeft,
  Camera,
  Save,
  FileDown,
  Clipboard,
  PlusCircle,
  Bell,
  CalendarClock,
  RefreshCcw,
  ShieldCheck,
  WalletCards,
  Trophy,
  Edit3,
  LogOut,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";


type InputSource = "voice" | "text" | "manual" | "recurring" | "ai";
type TransactionType = "expense" | "income";
type BudgetPeriod = "week" | "biweek" | "month" | "year";
type MoreSection = "menu" | "reports" | "goals" | "recurring" | "export" | "account" | "settings";

type ParsedTransaction = {
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  date: string;
  confidence: number;
  source: InputSource;
  rawInput?: string;
  needsConfirmation: boolean;
};

type Transaction = ParsedTransaction & {
  id: string;
  categoryId?: string;
  createdAt: string;
  updatedAt?: string;
};

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  keywords: string[];
};

type BudgetConfig = {
  period: BudgetPeriod;
  totalByPeriod: Record<BudgetPeriod, number>;
  categoryLimits: Record<string, number>;
  alerts: Record<string, boolean>;
};

type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  dueDate: string;
  color: string;
};

type RecurringExpense = {
  id: string;
  note: string;
  amount: number;
  category: string;
  frequency: "weekly" | "biweekly" | "monthly";
  nextDate: string;
  active: boolean;
};

type UserProfile = {
  nickname: string;
  email: string;
  photoUrl: string;
  currency: "MXN" | "USD";
  monthlyIncomeGoal: number;
  payday: string;
  city: string;
};

const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const categories: Category[] = [
  { id: "food", name: "Comida", color: "#ff9f68", icon: "Coffee", keywords: ["taco", "tacos", "comida", "restaurante", "café", "cafe", "hamburguesa", "pizza", "starbucks"] },
  { id: "market", name: "Supermercado", color: "#42d6b5", icon: "ShoppingCart", keywords: ["súper", "super", "heb", "walmart", "soriana", "costco", "mercado", "despensa"] },
  { id: "transport", name: "Transporte", color: "#5aa9ff", icon: "Car", keywords: ["gasolina", "uber", "didi", "taxi", "camión", "camion", "metro", "estacionamiento"] },
  { id: "services", name: "Servicios", color: "#7c6df2", icon: "Wifi", keywords: ["luz", "agua", "internet", "teléfono", "telefono", "netflix", "spotify", "renta", "cfe"] },
  { id: "health", name: "Salud", color: "#ff6b6b", icon: "HeartPulse", keywords: ["doctor", "farmacia", "medicina", "consulta", "dentista"] },
  { id: "education", name: "Educación", color: "#ffc857", icon: "GraduationCap", keywords: ["escuela", "curso", "libro", "colegiatura", "universidad"] },
  { id: "home", name: "Hogar", color: "#36d399", icon: "Sofa", keywords: ["casa", "muebles", "limpieza", "ferretería", "ferreteria", "hogar"] },
  { id: "fun", name: "Entretenimiento", color: "#b794f4", icon: "Gamepad2", keywords: ["cine", "juego", "salida", "bar", "concierto", "steam"] },
  { id: "saving", name: "Ahorro", color: "#2ec4b6", icon: "PiggyBank", keywords: ["ahorro", "guardé", "guarde", "aparté", "aparte", "inversión", "inversion"] },
  { id: "payroll", name: "Nómina", color: "#36d399", icon: "CircleDollarSign", keywords: ["nómina", "nomina", "sueldo", "salario", "quincena", "me pagaron", "depositaron"] },
  { id: "other", name: "Otros", color: "#94a3b8", icon: "MoreHorizontal", keywords: [] },
];

const quickExamples = [
  "Gasté 85 en tacos",
  "Pagué 250 de gasolina ayer",
  "Compré súper por 1350",
  "Me cobraron 199 de Netflix",
  "Recibí 15000 de nómina",
  "Aparté 500 para ahorro",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function addDaysISO(days: number) {
  return addDays(days).toISOString().slice(0, 10);
}

function tx(id: string, type: TransactionType, amount: number, category: string, note: string, date: string, source: InputSource, rawInput?: string): Transaction {
  return {
    id,
    type,
    amount,
    category,
    categoryId: getCategory(category).id,
    note,
    date,
    confidence: 0.96,
    source,
    rawInput,
    needsConfirmation: false,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

const sampleTransactions: Transaction[] = [
  tx("t-1", "expense", 65, "Comida", "Café Starbucks", todayISO(), "text", "Gasté 65 en café"),
  tx("t-2", "expense", 250, "Transporte", "Gasolina", addDaysISO(-1), "voice", "Pagué 250 de gasolina ayer"),
  tx("t-3", "income", 15000, "Nómina", "Nómina", addDaysISO(-2), "manual", "Recibí 15000 de nómina"),
  tx("t-4", "expense", 1350, "Supermercado", "HEB", addDaysISO(-2), "text", "Compré súper en HEB por 1350"),
  tx("t-5", "expense", 199, "Servicios", "Netflix", addDaysISO(-4), "recurring", "Me cobraron 199 de Netflix"),
  tx("t-6", "expense", 520, "Hogar", "Ferretería", addDaysISO(-7), "manual"),
  tx("t-7", "expense", 320, "Entretenimiento", "Cine familiar", addDaysISO(-9), "manual"),
  tx("t-8", "expense", 790, "Salud", "Farmacia", addDaysISO(-14), "manual"),
  tx("t-9", "income", 15000, "Nómina", "Quincena", addDaysISO(-17), "manual"),
  tx("t-10", "expense", 1100, "Educación", "Curso online", addDaysISO(-27), "manual"),
  tx("t-11", "expense", 460, "Comida", "Restaurante", addDaysISO(-35), "manual"),
  tx("t-12", "expense", 720, "Transporte", "Servicio auto", addDaysISO(-64), "manual"),
  tx("t-13", "income", 14500, "Nómina", "Nómina marzo", addDaysISO(-74), "manual"),
  tx("t-14", "expense", 2300, "Supermercado", "Costco", addDaysISO(-115), "manual"),
  tx("t-15", "expense", 500, "Ahorro", "Fondo familiar", addDaysISO(-160), "manual"),
];

const initialBudget: BudgetConfig = {
  period: "month",
  totalByPeriod: { week: 4200, biweek: 8400, month: 16800, year: 201600 },
  categoryLimits: { Comida: 5200, Supermercado: 6500, Transporte: 3000, Servicios: 4200, Salud: 1800, Educación: 1600, Hogar: 2800, Entretenimiento: 2200, Ahorro: 3000, Otros: 1500 },
  alerts: { "50": true, "80": true, "100": true },
};

const initialGoals: Goal[] = [
  { id: "g-1", name: "Fondo de emergencia", target: 30000, saved: 12400, dueDate: addDaysISO(120), color: "#42d6b5" },
  { id: "g-2", name: "Viaje aniversario", target: 18000, saved: 7200, dueDate: addDaysISO(80), color: "#7c6df2" },
];

const initialRecurring: RecurringExpense[] = [
  { id: "r-1", note: "Netflix", amount: 199, category: "Servicios", frequency: "monthly", nextDate: addDaysISO(2), active: true },
  { id: "r-2", note: "Internet casa", amount: 599, category: "Servicios", frequency: "monthly", nextDate: addDaysISO(5), active: true },
  { id: "r-3", note: "Ahorro automático", amount: 500, category: "Ahorro", frequency: "biweekly", nextDate: addDaysISO(3), active: true },
];

const initialProfile: UserProfile = {
  nickname: "Karlos",
  email: "karlos@monia.local",
  photoUrl: "",
  currency: "MXN",
  monthlyIncomeGoal: 30000,
  payday: "Quincenal",
  city: "Monterrey, NL",
};

function cleanSpaces(value: string) {
  let next = value.trim();
  while (next.includes("  ")) next = next.split("  ").join(" ");
  return next;
}

function normalizeNumber(raw: string): number {
  const value = raw.toLowerCase().split("$").join("").split("mxn").join("").split("pesos").join("").split("peso").join("").trim();
  const normalized = value.includes(",") && value.includes(".") ? value.split(",").join("") : value.split(",").join("");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractAmount(input: string) {
  const allowed = "0123456789.,";
  let token = "";
  let started = false;
  for (const char of input) {
    if (allowed.includes(char)) {
      token += char;
      started = true;
    } else if (started) {
      break;
    }
  }
  return { token, amount: normalizeNumber(token) };
}

function getRelativeDate(input: string): string {
  const text = input.toLowerCase();
  if (text.includes("antier") || text.includes("anteayer")) return addDaysISO(-2);
  if (text.includes("ayer")) return addDaysISO(-1);
  return todayISO();
}

function titleCase(text: string) {
  const cleaned = cleanSpaces(text);
  if (!cleaned) return "Movimiento";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function inferType(input: string): TransactionType {
  const text = input.toLowerCase();
  const incomeWords = ["recibí", "recibi", "me pagaron", "nómina", "nomina", "depositaron", "depósito", "deposito", "sueldo", "salario"];
  if (incomeWords.some((word) => text.includes(word))) return "income";
  return "expense";
}

function inferCategory(input: string, type: TransactionType) {
  const text = input.toLowerCase();
  if (type === "income") return "Nómina";
  for (const category of categories) {
    if (category.name === "Nómina") continue;
    if (category.keywords.some((word) => text.includes(word))) return category.name;
  }
  return "Otros";
}

function inferNote(input: string, category: string, amountToken: string) {
  let text = amountToken ? input.toLowerCase().split(amountToken).join(" ") : input.toLowerCase();
  const words = [
    "gasté", "gaste", "pagué", "pague", "compré", "compre", 
    "me cobraron", "recibí", "recibi", "me pagaron", "depositaron", 
    "transferí", "transferi", "aparté", "aparte", "guardé", "guarde", 
    "por", "en", "de", "a", "para", "el", "la", "los", "las", 
    "ayer", "hoy", "antier", "pesos", "peso", "mxn"
  ];
  
  words.forEach((word) => {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\s|[,.;:\\(\\)])` + escapedWord + `(\\s|[,.;:\\(\\)]|$)`, "gi");
    text = text.replace(regex, "$1 $2");
  });

  text = text.replace(/[$]/g, " ");

  const cleaned = titleCase(text);
  return cleaned === "Movimiento" ? category : cleaned;
}

function parseExpenseInput(input: string, source: InputSource = "text"): ParsedTransaction {
  const rawInput = input.trim();
  const amountInfo = extractAmount(rawInput);
  const type = inferType(rawInput);
  const category = inferCategory(rawInput, type);
  const note = inferNote(rawInput, category, amountInfo.token);
  let confidence = 0.45;
  if (amountInfo.amount > 0) confidence += 0.25;
  if (category !== "Otros") confidence += 0.2;
  if (note) confidence += 0.08;
  confidence = Math.min(0.98, Number(confidence.toFixed(2)));
  return { type, amount: amountInfo.amount, category, note, date: getRelativeDate(rawInput), confidence, source, rawInput, needsConfirmation: confidence < 0.82 || !amountInfo.amount || category === "Otros" };
}

function formatSmartDate(dateISO: string) {
  if (dateISO === todayISO()) return "Hoy";
  if (dateISO === addDaysISO(-1)) return "Ayer";
  if (dateISO === addDaysISO(-2)) return "Antier";
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
}

function getCategory(name: string) {
  return categories.find((category) => category.name === name) || categories[categories.length - 1];
}

function CategoryIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const iconName = getCategory(name).icon;
  const icons: Record<string, React.ElementType> = { Coffee, Car, ShoppingCart, Wifi, HeartPulse, GraduationCap, Sofa, Gamepad2, PiggyBank, MoreHorizontal, CircleDollarSign };
  const Icon = icons[iconName] || MoreHorizontal;
  return <Icon className={className} />;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWithinPeriod(dateISO: string, period: BudgetPeriod) {
  const date = startOfDay(new Date(`${dateISO}T12:00:00`));
  const now = startOfDay();
  const diffDays = Math.floor((+now - +date) / 86400000);
  if (period === "week") return diffDays >= 0 && diffDays < 7;
  if (period === "biweek") return diffDays >= 0 && diffDays < 15;
  if (period === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  return date.getFullYear() === now.getFullYear();
}

function periodLabel(period: BudgetPeriod) {
  return { week: "semanal", biweek: "quincenal", month: "mensual", year: "anual" }[period];
}

function groupExpensesByPeriod(transactions: Transaction[], mode: "daily" | "weekly" | "monthly" | "annual") {
  const map = new Map<string, number>();
  transactions.filter((item) => item.type === "expense").forEach((item) => {
    const date = new Date(`${item.date}T12:00:00`);
    let key = item.date.slice(5);
    if (mode === "weekly") key = `Sem ${Math.ceil(date.getDate() / 7)}`;
    if (mode === "monthly") key = date.toLocaleDateString("es-MX", { month: "short" });
    if (mode === "annual") key = String(date.getFullYear());
    map.set(key, (map.get(key) || 0) + item.amount);
  });
  return Array.from(map.entries()).map(([name, gasto]) => ({ name, gasto })).slice(-12);
}

function byCategoryData(transactions: Transaction[]) {
  const map = transactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});
  return Object.entries(map).map(([name, value]) => ({ name, value, color: getCategory(name).color })).sort((a, b) => b.value - a.value);
}

function incomeVsExpenseData(transactions: Transaction[]) {
  const map = new Map<string, { name: string; ingresos: number; gastos: number }>();
  transactions.forEach((item) => {
    const key = new Date(`${item.date}T12:00:00`).toLocaleDateString("es-MX", { month: "short" });
    const current = map.get(key) || { name: key, ingresos: 0, gastos: 0 };
    if (item.type === "income") current.ingresos += item.amount;
    else current.gastos += item.amount;
    map.set(key, current);
  });
  return Array.from(map.values()).slice(-8);
}

function transactionToCSV(transactions: Transaction[]) {
  const headers = ["id", "tipo", "monto", "categoria", "nota", "fecha", "origen", "confianza"];
  const rows = transactions.map((t) => [t.id, t.type, t.amount, t.category, t.note, t.date, t.source, t.confidence]);
  return [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).split('"').join('""')}"`).join(",")).join(String.fromCharCode(10));
}

function AppShell({ children, activeTab, onTabChange, onFabClick }: { children: React.ReactNode; activeTab: string; onTabChange: (id: string) => void; onFabClick: () => void }) {
  return <main className="min-h-screen bg-[#f7f8fc] text-[#111827] antialiased"><div className="mx-auto min-h-screen w-full max-w-[460px] bg-[#f7f8fc] shadow-[0_0_80px_rgba(15,23,42,0.08)]"><div className="min-h-screen pb-28">{children}</div><FloatingAddButton onClick={onFabClick} /><BottomNavigation activeTab={activeTab} onTabChange={onTabChange} /></div></main>;
}

function BottomNavigation({ activeTab, onTabChange }: { activeTab: string; onTabChange: (id: string) => void }) {
  const tabs = [{ id: "home", label: "Inicio", icon: Home }, { id: "transactions", label: "Movimientos", icon: History }, { id: "budgets", label: "Presupuesto", icon: Target }, { id: "more", label: "Más", icon: User }];
  return <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[460px] border-t border-[#e5e7eb] bg-white/90 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl"><div className="grid grid-cols-4 gap-2">{tabs.map((tab) => { const Icon = tab.icon; const active = activeTab === tab.id; return <button key={tab.id} onClick={() => onTabChange(tab.id)} className={cx("relative flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs font-semibold transition", active ? "text-[#111827]" : "text-[#94a3b8]")}>{active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-2xl bg-[#f1f5f9]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}<Icon className="relative z-10 mb-1 h-5 w-5" /><span className="relative z-10">{tab.label}</span></button>; })}</div></nav>;
}

function FloatingAddButton({ onClick }: { onClick: () => void }) {
  return <motion.button whileTap={{ scale: 0.94 }} whileHover={{ y: -2 }} onClick={onClick} className="fixed bottom-[92px] left-1/2 z-50 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-[1.6rem] bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] text-white shadow-[0_18px_40px_rgba(66,214,181,0.40)]"><Mic className="h-7 w-7" /><span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-white text-[#2ec4b6] shadow-sm"><Plus className="h-4 w-4" /></span></motion.button>;
}

function Header({ profile, budget, onGoAccount }: { profile: UserProfile; budget: BudgetConfig; onGoAccount: () => void }) {
  return <header className="px-5 pb-2 pt-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-[#6b7280]">Hola, {profile.nickname || "Karlos"} 👋</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Tu dinero va así</h1><p className="mt-1 text-xs font-bold text-[#94a3b8]">Control {periodLabel(budget.period)} activo</p></div><button onClick={onGoAccount} className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e5e7eb]">{profile.photoUrl ? <img src={profile.photoUrl} alt="Perfil" className="h-full w-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#7c6df2_0%,#5aa9ff_100%)] text-sm font-black text-white">{profile.nickname.slice(0, 1).toUpperCase() || "K"}</span>}</button></div></header>;
}

function SmartBalanceCard({ transactions, budget }: { transactions: Transaction[]; budget: BudgetConfig }) {
  const filtered = transactions.filter((t) => isWithinPeriod(t.date, budget.period));
  const income = filtered.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const expenses = filtered.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const activeBudget = budget.totalByPeriod[budget.period];
  const available = Math.max(activeBudget + income - expenses, 0);
  const usedPercentage = Math.min(100, Math.round((expenses / Math.max(activeBudget, 1)) * 100));
  return <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] p-5 text-white shadow-[0_24px_60px_rgba(66,214,181,0.28)]"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white/80">Saldo disponible {periodLabel(budget.period)}</p><h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{pesos.format(available)}</h2><p className="mt-2 text-sm font-semibold text-white/82">Gastaste {pesos.format(expenses)} de {pesos.format(activeBudget)}</p></div><div className="rounded-2xl bg-white/18 p-3 backdrop-blur-md"><Wallet className="h-7 w-7" /></div></div><div className="mt-6"><div className="mb-2 flex items-center justify-between text-xs font-bold text-white/80"><span>Presupuesto usado</span><span>{usedPercentage}%</span></div><div className="h-3 rounded-full bg-white/22"><motion.div initial={{ width: 0 }} animate={{ width: `${usedPercentage}%` }} className="h-3 rounded-full bg-white shadow-sm" /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><MetricGlass label="Ingresos" value={pesos.format(income)} /><MetricGlass label="Gastos" value={pesos.format(expenses)} /></div></motion.section>;
}

function MetricGlass({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/16 p-3 backdrop-blur-md"><p className="text-xs font-semibold text-white/72">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}

function QuickExpenseInput({ onSave, compact = false }: { onSave: (transaction: ParsedTransaction) => void; compact?: boolean }) {
  const [mode, setMode] = useState<"voice" | "text" | "manual">("text");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [error, setError] = useState("");
  const [listeningTranscript, setListeningTranscript] = useState("");
  const parseAndPreview = (value: string, source: InputSource = "text") => { const next = parseExpenseInput(value, source); setError(""); if (!next.amount) setError("No detecté el monto. Intenta decir: Gasté 120 en comida."); setParsed(next); setText(value); };
  const saveParsed = (next: ParsedTransaction) => { if (!next.amount || next.amount <= 0) return setError("El monto debe ser mayor a 0 para guardar."); onSave({ ...next, note: next.note || next.category, needsConfirmation: false }); setParsed(null); setText(""); setError(""); setListeningTranscript(""); };
  return <section className={cx("rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]", !compact && "mx-5")}><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-black tracking-[-0.02em]">¿Qué gasto quieres registrar?</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">Voz, texto natural o manual compacto.</p></div><span className="rounded-full bg-[#effdf8] px-3 py-1 text-xs font-black text-[#2ec4b6]">IA local</span></div><div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#f7f8fc] p-1">{[{ id: "voice", label: "Voz", icon: Mic }, { id: "text", label: "Texto", icon: Send }, { id: "manual", label: "Manual", icon: Pencil }].map((item) => { const Icon = item.icon; const active = mode === item.id; return <button key={item.id} onClick={() => setMode(item.id as "voice" | "text" | "manual")} className={cx("relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-black transition", active ? "text-[#111827]" : "text-[#94a3b8]")}>{active && <motion.span layoutId="quick-mode" className="absolute inset-0 rounded-xl bg-white shadow-sm" />}<Icon className="relative z-10 h-4 w-4" /><span className="relative z-10">{item.label}</span></button>; })}</div><AnimatePresence mode="wait">{mode === "voice" && <motion.div key="voice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><VoiceExpenseButton onResult={(value) => parseAndPreview(value, "voice")} onError={setError} transcript={listeningTranscript} setTranscript={setListeningTranscript} /></motion.div>}{mode === "text" && <motion.div key="text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><div className="flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-[#f7f8fc] p-2"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && text.trim()) parseAndPreview(text, "text"); }} placeholder="Escribe: gasté 120 en comida" className="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold outline-none placeholder:text-[#94a3b8]" /><motion.button whileTap={{ scale: 0.94 }} onClick={() => text.trim() && parseAndPreview(text, "text")} className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111827] text-white shadow-sm"><Send className="h-4 w-4" /></motion.button></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{quickExamples.map((example) => <button key={example} onClick={() => parseAndPreview(example, "text")} className="shrink-0 rounded-full bg-[#f1f5f9] px-3 py-2 text-xs font-bold text-[#6b7280]">{example}</button>)}</div></motion.div>}{mode === "manual" && <motion.div key="manual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><TransactionForm onPreview={(next) => setParsed(next)} /></motion.div>}</AnimatePresence>{listeningTranscript && !parsed && <div className="mt-4 rounded-2xl bg-[#f7f8fc] p-3 text-sm font-semibold text-[#6b7280]">“{listeningTranscript}”</div>}{error && <div className="mt-4 flex gap-2 rounded-2xl bg-[#fff7ed] p-3 text-sm font-bold text-[#c2410c]"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}<AnimatePresence>{parsed && <ParsedExpensePreview parsed={parsed} onChange={setParsed} onCancel={() => setParsed(null)} onSave={saveParsed} />}</AnimatePresence></section>;
}

function VoiceExpenseButton({ onResult, onError, transcript, setTranscript }: { onResult: (value: string) => void; onError: (message: string) => void; transcript: string; setTranscript: (value: string) => void }) {
  const [status, setStatus] = useState<"idle" | "listening" | "processing">("idle");
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef("");
  useEffect(() => () => recognitionRef.current?.stop?.(), []);
  const startListening = () => { const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SpeechRecognition) return onError("No pude usar el micrófono en este navegador. Puedes escribir el gasto."); if (status === "listening") return; const recognition = new SpeechRecognition(); recognition.lang = "es-MX"; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 1; recognitionRef.current = recognition; latestTranscriptRef.current = ""; setTranscript(""); setStatus("listening"); recognition.onresult = (event: any) => { let value = ""; for (let i = 0; i < event.results.length; i++) value += event.results[i][0].transcript; latestTranscriptRef.current = value.trim(); setTranscript(value.trim()); }; recognition.onerror = (event: any) => { setStatus("idle"); const reason = event?.error === "not-allowed" ? "Permite el acceso al micrófono para dictar gastos." : "No pude usar el micrófono. Puedes escribir el gasto."; onError(reason); }; recognition.onend = () => { const spoken = latestTranscriptRef.current || transcript || ""; setStatus("processing"); window.setTimeout(() => { setStatus("idle"); if (spoken.trim()) onResult(spoken.trim()); else onError("No escuché una frase completa. Intenta: Gasté 120 en comida."); }, 450); }; recognition.start(); };
  const stopListening = () => recognitionRef.current?.stop?.();
  return <div className="rounded-[1.6rem] bg-[linear-gradient(135deg,#effdf8_0%,#edf7ff_100%)] p-4 text-center"><div className="relative mx-auto mb-4 grid h-28 w-28 place-items-center">{status === "listening" && <><motion.span className="absolute inset-1 rounded-full border border-[#42d6b5]" animate={{ scale: [1, 1.18], opacity: [0.8, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} /><motion.span className="absolute inset-3 rounded-full border border-[#5aa9ff]" animate={{ scale: [1, 1.28], opacity: [0.7, 0] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.12 }} /></>}<motion.button whileTap={{ scale: 0.94 }} onClick={status === "listening" ? stopListening : startListening} className="relative z-10 grid h-24 w-24 place-items-center rounded-full bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] text-white shadow-[0_18px_40px_rgba(66,214,181,0.32)]">{status === "processing" ? <Sparkles className="h-9 w-9 animate-pulse" /> : <Mic className="h-9 w-9" />}</motion.button></div><p className="text-sm font-black text-[#111827]">{status === "listening" ? "Escuchando... toca para terminar" : status === "processing" ? "Analizando gasto..." : "Toca y dicta tu gasto"}</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">Funciona con Web Speech API en navegadores compatibles.</p></div>;
}

function TransactionForm({ onPreview, initial }: { onPreview: (transaction: ParsedTransaction) => void; initial?: Partial<ParsedTransaction> }) {
  const [amount, setAmount] = useState(String(initial?.amount || ""));
  const [category, setCategory] = useState(initial?.category || "Comida");
  const [note, setNote] = useState(initial?.note || "");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [type, setType] = useState<TransactionType>(initial?.type || "expense");
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><button onClick={() => setType("expense")} className={cx("rounded-2xl px-4 py-3 text-sm font-black", type === "expense" ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f7f8fc] text-[#6b7280]")}>Gasto</button><button onClick={() => setType("income")} className={cx("rounded-2xl px-4 py-3 text-sm font-black", type === "income" ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f7f8fc] text-[#6b7280]")}>Ingreso</button></div><div className="grid grid-cols-2 gap-3"><EditField label="Monto" value={amount} onChange={setAmount} /><EditField label="Fecha" value={date} type="date" onChange={setDate} /></div><label className="block rounded-2xl border border-[#e5e7eb] bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-black outline-none">{categories.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><EditField label="Nota" value={note} placeholder="Ej. Tacos Don Pepe" onChange={setNote} /><button onClick={() => onPreview({ amount: normalizeNumber(amount), category, note: note || category, date, type, confidence: 1, source: initial?.source || "manual", rawInput: note, needsConfirmation: false })} className="w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-black text-white">Revisar antes de guardar</button></div>;
}

function ParsedExpensePreview({ parsed, onChange, onSave, onCancel }: { parsed: ParsedTransaction; onChange: (transaction: ParsedTransaction) => void; onSave: (transaction: ParsedTransaction) => void; onCancel: () => void }) {
  const category = getCategory(parsed.category);
  return <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="mt-4 overflow-hidden rounded-[1.6rem] border border-[#e5e7eb] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]"><div className="flex items-center justify-between border-b border-[#f1f5f9] p-4"><div><p className="text-sm font-black">Detecté este {parsed.type === "income" ? "ingreso" : "gasto"}</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">Revisa y guarda. Confianza: {Math.round(parsed.confidence * 100)}%</p></div><div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}20`, color: category.color }}><CategoryIcon name={parsed.category} /></div></div>{parsed.needsConfirmation && <div className="mx-4 mt-4 flex gap-2 rounded-2xl bg-[#fff7ed] p-3 text-xs font-bold text-[#c2410c]"><AlertTriangle className="h-4 w-4 shrink-0" /><span>Revisa antes de guardar. Hay datos con baja confianza.</span></div>}<div className="grid grid-cols-2 gap-3 p-4"><EditField label="Monto" value={String(parsed.amount || "")} onChange={(value) => onChange({ ...parsed, amount: normalizeNumber(value || "0") })} /><label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Tipo</span><select value={parsed.type} onChange={(event) => onChange({ ...parsed, type: event.target.value as TransactionType })} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label><label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Categoría</span><select value={parsed.category} onChange={(event) => onChange({ ...parsed, category: event.target.value })} className="mt-1 w-full bg-transparent text-sm font-black outline-none">{categories.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><EditField label="Fecha" value={parsed.date} type="date" onChange={(value) => onChange({ ...parsed, date: value })} /><div className="col-span-2"><EditField label="Nota" value={parsed.note} onChange={(value) => onChange({ ...parsed, note: value })} /></div></div>{parsed.rawInput && <p className="mx-4 mb-4 rounded-2xl bg-[#f7f8fc] p-3 text-xs font-semibold text-[#6b7280]">Entrada original: “{parsed.rawInput}”</p>}<div className="grid grid-cols-2 gap-3 border-t border-[#f1f5f9] p-4"><button onClick={onCancel} className="rounded-2xl bg-[#f1f5f9] px-4 py-3 text-sm font-black text-[#6b7280]">Cancelar</button><button onClick={() => onSave(parsed)} className="rounded-2xl bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(66,214,181,0.22)]">Guardar</button></div></motion.div>;
}

function EditField({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">{label}</span><input value={value} type={type} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-black outline-none placeholder:text-[#cbd5e1]" /></label>;
}

function HomeView({ profile, transactions, budget, onSave, onDelete, onDuplicate, onEdit, onGoAccount }: { profile: UserProfile; transactions: Transaction[]; budget: BudgetConfig; onSave: (transaction: ParsedTransaction) => void; onDelete: (id: string) => void; onDuplicate: (transaction: Transaction) => void; onEdit: (transaction: Transaction) => void; onGoAccount: () => void }) {
  const latest = [...transactions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const expensesThisPeriod = transactions.filter((t) => t.type === "expense" && isWithinPeriod(t.date, budget.period));
  const top = byCategoryData(expensesThisPeriod)[0];
  const todaySpent = transactions.filter((t) => t.type === "expense" && t.date === todayISO()).reduce((a, t) => a + t.amount, 0);
  return <div><Header profile={profile} budget={budget} onGoAccount={onGoAccount} /><div className="space-y-5"><SmartBalanceCard transactions={transactions} budget={budget} /><QuickExpenseInput onSave={onSave} /><section className="mx-5 grid grid-cols-2 gap-3"><InsightMiniCard icon={CalendarDays} label="Hoy gastaste" value={pesos.format(todaySpent)} tone="warm" /><InsightMiniCard icon={TrendingUp} label="Categoría alta" value={top?.name || "Sin gastos"} tone="purple" /></section><section className="mx-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black tracking-[-0.03em]">Últimos movimientos</h2></div><TransactionTimeline transactions={latest} limit={4} onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} /></section><section className="mx-5"><h2 className="mb-3 text-lg font-black tracking-[-0.03em]">Insights</h2><div className="space-y-2"><InsightCard type="success" title="Primero registra, luego analiza" description="Ya puedes guardar por voz, texto o manual y corregir antes de confirmar." /><InsightCard type="warning" title={top ? `${top.name} va fuerte` : "Sin foco de gasto"} description={top ? `Tu categoría más alta en este periodo lleva ${pesos.format(top.value)}.` : "Agrega movimientos para recibir recomendaciones reales."} /></div></section></div></div>;
}

function InsightMiniCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: "warm" | "purple" }) {
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className={cx("mb-3 grid h-10 w-10 place-items-center rounded-2xl text-white", tone === "warm" ? "bg-[linear-gradient(135deg,#ffc857_0%,#ff8a65_100%)]" : "bg-[linear-gradient(135deg,#7c6df2_0%,#b794f4_100%)]")}><Icon className="h-5 w-5" /></div><p className="text-xs font-bold text-[#6b7280]">{label}</p><p className="mt-1 truncate text-lg font-black tracking-[-0.03em]">{value}</p></motion.div>;
}

function InsightCard({ type, title, description }: { type: "warning" | "success" | "suggestion" | "info"; title: string; description: string }) {
  const config = { warning: { icon: AlertTriangle, bg: "#fff7ed", color: "#f97316" }, success: { icon: BadgeCheck, bg: "#ecfdf5", color: "#10b981" }, suggestion: { icon: Sparkles, bg: "#eef2ff", color: "#7c6df2" }, info: { icon: BarChart3, bg: "#eff6ff", color: "#3b82f6" } }[type];
  const Icon = config.icon;
  return <div className="flex gap-3 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: config.bg, color: config.color }}><Icon className="h-5 w-5" /></div><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">{description}</p></div></div>;
}

function TransactionItem({ transaction, onDuplicate, onDelete, onEdit }: { transaction: Transaction; onDuplicate?: (transaction: Transaction) => void; onDelete?: (id: string) => void; onEdit?: (transaction: Transaction) => void }) {
  const category = getCategory(transaction.category);
  const amountPrefix = transaction.type === "income" ? "+" : "-";
  return <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="group flex items-center gap-3 rounded-[1.4rem] bg-white p-3 shadow-sm ring-1 ring-[#e5e7eb]"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}18`, color: category.color }}><CategoryIcon name={transaction.category} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black tracking-[-0.02em]">{transaction.note}</p><div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#94a3b8]"><span>{transaction.category}</span><span>·</span><span>{formatSmartDate(transaction.date)}</span><span>·</span><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5">{transaction.source === "voice" ? "Voz" : transaction.source === "text" ? "Texto" : transaction.source === "recurring" ? "Recurrente" : transaction.source === "manual" ? "Manual" : "IA"}</span></div></div><div className="text-right"><p className={cx("text-sm font-black", transaction.type === "income" ? "text-[#059669]" : "text-[#111827]")}>{amountPrefix}{pesos.format(transaction.amount)}</p><div className="mt-2 flex justify-end gap-1"><button onClick={() => onEdit?.(transaction)} className="grid h-7 w-7 place-items-center rounded-full bg-[#eef2ff] text-[#7c6df2]"><Edit3 className="h-3.5 w-3.5" /></button><button onClick={() => onDuplicate?.(transaction)} className="grid h-7 w-7 place-items-center rounded-full bg-[#f1f5f9] text-[#6b7280]"><Copy className="h-3.5 w-3.5" /></button><button onClick={() => onDelete?.(transaction.id)} className="grid h-7 w-7 place-items-center rounded-full bg-[#fff1f2] text-[#e11d48]"><Trash2 className="h-3.5 w-3.5" /></button></div></div></motion.div>;
}

function TransactionTimeline({ transactions, onDuplicate, onDelete, onEdit, limit }: { transactions: Transaction[]; onDuplicate?: (transaction: Transaction) => void; onDelete?: (id: string) => void; onEdit?: (transaction: Transaction) => void; limit?: number }) {
  const visible = limit ? transactions.slice(0, limit) : transactions;
  const groups = visible.reduce<Record<string, Transaction[]>>((acc, item) => { const label = formatSmartDate(item.date); acc[label] = acc[label] || []; acc[label].push(item); return acc; }, {});
  return <div className="space-y-5"><AnimatePresence>{Object.entries(groups).map(([label, items]) => <section key={label}><h3 className="mb-2 px-1 text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">{label}</h3><div className="space-y-2">{items.map((item) => <TransactionItem key={item.id} transaction={item} onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} />)}</div></section>)}</AnimatePresence></div>;
}

function TransactionsView({ transactions, onDelete, onDuplicate, onEdit }: { transactions: Transaction[]; onDelete: (id: string) => void; onDuplicate: (transaction: Transaction) => void; onEdit: (transaction: Transaction) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [category, setCategory] = useState("Todas");
  const filtered = transactions.filter((item) => type === "all" || item.type === type).filter((item) => category === "Todas" || item.category === category).filter((item) => `${item.note} ${item.category} ${item.rawInput}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return <div className="px-5 pt-5"><SectionHeader title="Movimientos" subtitle="Edita, duplica o elimina cualquier gasto guardado." /><div className="mt-5 rounded-[1.6rem] bg-white p-3 shadow-sm ring-1 ring-[#e5e7eb]"><div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#f7f8fc] px-3 py-2"><Search className="h-4 w-4 text-[#94a3b8]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tacos, gasolina, Netflix..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[#94a3b8]" /><SlidersHorizontal className="h-4 w-4 text-[#94a3b8]" /></div><div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{[{ id: "all", label: "Todos" }, { id: "expense", label: "Gastos" }, { id: "income", label: "Ingresos" }].map((item) => <button key={item.id} onClick={() => setType(item.id as "all" | TransactionType)} className={cx("shrink-0 rounded-full px-3 py-2 text-xs font-black", type === item.id ? "bg-[#111827] text-white" : "bg-[#f1f5f9] text-[#6b7280]")}>{item.label}</button>)}<select value={category} onChange={(event) => setCategory(event.target.value)} className="shrink-0 rounded-full bg-[#f1f5f9] px-3 py-2 text-xs font-black text-[#6b7280] outline-none"><option>Todas</option>{categories.map((item) => <option key={item.id}>{item.name}</option>)}</select></div></div><div className="mt-5"><TransactionTimeline transactions={filtered} onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} /></div></div>;
}

function BudgetsView({ transactions, budget, setBudget }: { transactions: Transaction[]; budget: BudgetConfig; setBudget: React.Dispatch<React.SetStateAction<BudgetConfig>> }) {
  const filtered = transactions.filter((item) => item.type === "expense" && isWithinPeriod(item.date, budget.period));
  const spent = filtered.reduce((acc, item) => acc + item.amount, 0);
  const activeBudget = budget.totalByPeriod[budget.period];
  const progress = Math.round((spent / Math.max(activeBudget, 1)) * 100);
  const expenseByCategory = filtered.reduce<Record<string, number>>((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.amount; return acc; }, {});
  return <div className="px-5 pt-5"><SectionHeader title="Presupuesto" subtitle="Control semanal, quincenal, mensual o anual editable." /><section className="mt-5 rounded-[2rem] bg-[linear-gradient(135deg,#7c6df2_0%,#b794f4_100%)] p-5 text-white shadow-[0_24px_60px_rgba(124,109,242,0.24)]"><div className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{(["week", "biweek", "month", "year"] as BudgetPeriod[]).map((p) => <button key={p} onClick={() => setBudget((b) => ({ ...b, period: p }))} className={cx("shrink-0 rounded-full px-3 py-2 text-xs font-black", budget.period === p ? "bg-white text-[#7c6df2]" : "bg-white/16 text-white")}>{periodLabel(p)}</button>)}</div><p className="text-sm font-semibold text-white/78">Presupuesto {periodLabel(budget.period)}</p><div className="mt-2 flex items-center gap-2"><input value={budget.totalByPeriod[budget.period]} type="number" onChange={(event) => setBudget((b) => ({ ...b, totalByPeriod: { ...b.totalByPeriod, [b.period]: Number(event.target.value) || 0 } }))} className="min-w-0 flex-1 rounded-2xl bg-white/18 px-3 py-2 text-2xl font-black tracking-[-0.05em] text-white outline-none placeholder:text-white/50" /><Save className="h-5 w-5 text-white/75" /></div><p className="mt-2 text-sm font-semibold text-white/80">Has usado {pesos.format(spent)} · {progress}%</p><div className="mt-5 h-3 rounded-full bg-white/20"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }} className="h-3 rounded-full bg-white" /></div></section><section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><p className="text-sm font-black">Alertas activas</p><div className="mt-3 grid grid-cols-3 gap-2">{["50", "80", "100"].map((alert) => <button key={alert} onClick={() => setBudget((b) => ({ ...b, alerts: { ...b.alerts, [alert]: !b.alerts[alert] } }))} className={cx("rounded-2xl px-2 py-3 text-xs font-black", budget.alerts[alert] ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f1f5f9] text-[#94a3b8]")}><Bell className="mx-auto mb-1 h-4 w-4" />{alert}%</button>)}</div></section><div className="mt-5 space-y-3">{categories.filter((item) => item.name !== "Nómina").map((category) => <CategoryBudgetCard key={category.id} category={category} spent={expenseByCategory[category.name] || 0} limit={budget.categoryLimits[category.name] || 0} onLimitChange={(value) => setBudget((b) => ({ ...b, categoryLimits: { ...b.categoryLimits, [category.name]: value } }))} />)}</div></div>;
}

function CategoryBudgetCard({ category, spent, limit, onLimitChange }: { category: Category; spent: number; limit: number; onLimitChange: (value: number) => void }) {
  const progress = Math.min(140, Math.round((spent / Math.max(limit, 1)) * 100));
  const tone = progress >= 100 ? "danger" : progress >= 80 ? "careful" : "healthy";
  return <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}18`, color: category.color }}><CategoryIcon name={category.name} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-black tracking-[-0.02em]">{category.name}</p><span className={cx("rounded-full px-2.5 py-1 text-[11px] font-black", tone === "healthy" && "bg-[#ecfdf5] text-[#059669]", tone === "careful" && "bg-[#fff7ed] text-[#f97316]", tone === "danger" && "bg-[#fff1f2] text-[#e11d48]")}>{tone === "healthy" ? "Sano" : tone === "careful" ? "Cuidado" : "Excedido"}</span></div><p className="mt-1 text-xs font-bold text-[#6b7280]">{pesos.format(spent)} de {pesos.format(limit)}</p></div></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f1f5f9]"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }} className={cx("h-3 rounded-full", tone === "healthy" && "bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)]", tone === "careful" && "bg-[linear-gradient(135deg,#ffc857_0%,#ff8a65_100%)]", tone === "danger" && "bg-[#ff6b6b]")} /></div><div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-xs font-black text-[#94a3b8]">Límite</span><input value={limit} type="number" onChange={(event) => onLimitChange(Number(event.target.value) || 0)} className="min-w-0 flex-1 bg-transparent text-right text-sm font-black outline-none" /></div></motion.article>;
}

function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack?: () => void }) {
  return <header className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3">{onBack && <button onClick={onBack} className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-[#e5e7eb]"><ArrowLeft className="h-5 w-5" /></button>}<div><h1 className="text-3xl font-black tracking-[-0.05em]">{title}</h1><p className="mt-1 max-w-[330px] text-sm font-semibold leading-relaxed text-[#6b7280]">{subtitle}</p></div></div><button className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-[#e5e7eb]"><Sparkles className="h-5 w-5 text-[#7c6df2]" /></button></header>;
}

function MoreView({ section, setSection, transactions, goals, setGoals, recurring, setRecurring, profile, setProfile, budget, onSignOut }: { section: MoreSection; setSection: (section: MoreSection) => void; transactions: Transaction[]; goals: Goal[]; setGoals: React.Dispatch<React.SetStateAction<Goal[]>>; recurring: RecurringExpense[]; setRecurring: React.Dispatch<React.SetStateAction<RecurringExpense[]>>; profile: UserProfile; setProfile: React.Dispatch<React.SetStateAction<UserProfile>>; budget: BudgetConfig; onSignOut?: () => void }) {
  if (section === "reports") return <ReportsView transactions={transactions} budget={budget} onBack={() => setSection("menu")} />;
  if (section === "goals") return <GoalsView goals={goals} setGoals={setGoals} onBack={() => setSection("menu")} />;
  if (section === "recurring") return <RecurringView recurring={recurring} setRecurring={setRecurring} onBack={() => setSection("menu")} />;
  if (section === "export") return <ExportView transactions={transactions} goals={goals} recurring={recurring} profile={profile} budget={budget} onBack={() => setSection("menu")} />;
  if (section === "account" || section === "settings") return <AccountView profile={profile} setProfile={setProfile} onBack={() => setSection("menu")} onSignOut={onSignOut} />;
  const cards = [{ id: "account", title: "Mi cuenta", subtitle: "Nickname, foto, moneda y datos útiles", icon: User, gradient: "bg-[linear-gradient(135deg,#7c6df2_0%,#5aa9ff_100%)]" }, { id: "goals", title: "Metas de ahorro", subtitle: "Crea metas y suma aportaciones", icon: PiggyBank, gradient: "bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)]" }, { id: "recurring", title: "Gastos recurrentes", subtitle: "Netflix, renta, servicios y ahorro", icon: Repeat, gradient: "bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)]" }, { id: "reports", title: "Reportes avanzados", subtitle: "Gráficas diarias, semanales, mensuales y anuales", icon: BarChart3, gradient: "bg-[linear-gradient(135deg,#7c6df2_0%,#b794f4_100%)]" }, { id: "export", title: "Exportar datos", subtitle: "CSV y JSON listos para respaldo", icon: Download, gradient: "bg-[#111827]" }, { id: "settings", title: "Configuración", subtitle: "Preferencias de cuenta", icon: Settings, gradient: "bg-[linear-gradient(135deg,#ffc857_0%,#ff8a65_100%)]" }] as const;
  return <div className="px-5 pt-5"><SectionHeader title="Más" subtitle="Funciones avanzadas funcionando sin saturar la app." /><div className="mt-5 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] text-xl font-black text-white">{profile.photoUrl ? <img src={profile.photoUrl} alt="Perfil" className="h-full w-full object-cover" /> : profile.nickname.slice(0, 1).toUpperCase()}</div><div><p className="text-base font-black">{profile.nickname}</p><p className="text-xs font-bold text-[#6b7280]">{profile.city} · {profile.currency}</p></div></div></div><div className="mt-5 space-y-3">{cards.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setSection(item.id as MoreSection)} className="flex w-full items-center gap-3 rounded-[1.6rem] bg-white p-4 text-left shadow-sm ring-1 ring-[#e5e7eb] transition hover:scale-[1.01]"><span className={cx("grid h-12 w-12 place-items-center rounded-2xl text-white", item.gradient)}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black tracking-[-0.02em]">{item.title}</span><span className="mt-1 block text-xs font-semibold text-[#6b7280]">{item.subtitle}</span></span><ChevronRight className="h-5 w-5 text-[#cbd5e1]" /></button>; })}</div></div>;
}

function ReportsView({ transactions, budget, onBack }: { transactions: Transaction[]; budget: BudgetConfig; onBack: () => void }) {
  const [mode, setMode] = useState<"daily" | "weekly" | "monthly" | "annual">("daily");
  const expenseTrend = groupExpensesByPeriod(transactions, mode);
  const categoryData = byCategoryData(transactions);
  const comparison = incomeVsExpenseData(transactions);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const avgDaily = Math.round(totalExpenses / Math.max(1, new Set(transactions.map((t) => t.date)).size));
  return <div className="px-5 pt-5"><SectionHeader title="Reportes" subtitle="Indicadores y gráficas por día, semana, mes y año." onBack={onBack} /><div className="mt-5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{[{ id: "daily", label: "Diario" }, { id: "weekly", label: "Semanal" }, { id: "monthly", label: "Mensual" }, { id: "annual", label: "Anual" }].map((item) => <button key={item.id} onClick={() => setMode(item.id as any)} className={cx("shrink-0 rounded-full px-4 py-2 text-xs font-black", mode === item.id ? "bg-[#111827] text-white" : "bg-white text-[#6b7280] ring-1 ring-[#e5e7eb]")}>{item.label}</button>)}</div><div className="mt-5 grid grid-cols-2 gap-3"><InsightMiniCard icon={BarChart3} label="Gasto total" value={pesos.format(totalExpenses)} tone="purple" /><InsightMiniCard icon={CalendarDays} label="Promedio día" value={pesos.format(avgDaily)} tone="warm" /></div><ChartCard title="Gastos por periodo"><ResponsiveContainer width="100%" height={220}><AreaChart data={expenseTrend}><defs><linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5aa9ff" stopOpacity={0.55} /><stop offset="100%" stopColor="#5aa9ff" stopOpacity={0.04} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value: any) => pesos.format(Number(value))} /><Area type="monotone" dataKey="gasto" stroke="#5aa9ff" strokeWidth={3} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="Gastos por categoría"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>{categoryData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value: any) => pesos.format(Number(value))} /></PieChart></ResponsiveContainer><div className="grid grid-cols-2 gap-2">{categoryData.slice(0, 6).map((item) => <div key={item.name} className="flex items-center gap-2 text-xs font-bold text-[#6b7280]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</div>)}</div></ChartCard><ChartCard title="Ingresos vs gastos"><ResponsiveContainer width="100%" height={230}><BarChart data={comparison}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value: any) => pesos.format(Number(value))} /><Bar dataKey="ingresos" radius={[10, 10, 0, 0]} fill="#36d399" /><Bar dataKey="gastos" radius={[10, 10, 0, 0]} fill="#ff9f68" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Indicador de presupuesto"><div className="rounded-[1.5rem] bg-[#f7f8fc] p-4"><p className="text-xs font-bold text-[#6b7280]">Presupuesto {periodLabel(budget.period)}</p><p className="mt-1 text-2xl font-black">{pesos.format(budget.totalByPeriod[budget.period])}</p><p className="mt-2 text-xs font-semibold text-[#6b7280]">Referencia contra tus gastos del periodo actual.</p></div></ChartCard></div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 rounded-[1.8rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><h2 className="mb-3 text-base font-black tracking-[-0.03em]">{title}</h2>{children}</section>;
}

function GoalsView({ goals, setGoals, onBack }: { goals: Goal[]; setGoals: React.Dispatch<React.SetStateAction<Goal[]>>; onBack: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const totalSaved = goals.reduce((a, g) => a + g.saved, 0);
  return <div className="px-5 pt-5"><SectionHeader title="Metas" subtitle="Crea objetivos y registra aportaciones reales." onBack={onBack} /><section className="mt-5 rounded-[2rem] bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)] p-5 text-white"><p className="text-sm font-semibold text-white/80">Ahorro acumulado</p><p className="mt-1 text-3xl font-black">{pesos.format(totalSaved)}</p></section><div className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><p className="text-sm font-black">Nueva meta</p><div className="mt-3 grid grid-cols-2 gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="rounded-2xl bg-[#f7f8fc] px-3 py-3 text-sm font-bold outline-none" /><input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Meta $" className="rounded-2xl bg-[#f7f8fc] px-3 py-3 text-sm font-bold outline-none" /></div><button onClick={() => { if (!name || !normalizeNumber(target)) return; setGoals((g) => [{ id: `g-${Date.now()}`, name, target: normalizeNumber(target), saved: 0, dueDate: addDaysISO(90), color: "#5aa9ff" }, ...g]); setName(""); setTarget(""); }} className="mt-3 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-black text-white"><PlusCircle className="mr-2 inline h-4 w-4" />Crear meta</button></div><div className="mt-5 space-y-3">{goals.map((goal) => { const progress = Math.min(100, Math.round((goal.saved / goal.target) * 100)); return <article key={goal.id} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ backgroundColor: goal.color }}><Trophy className="h-5 w-5" /></div><div className="flex-1"><p className="font-black">{goal.name}</p><p className="text-xs font-bold text-[#6b7280]">{pesos.format(goal.saved)} de {pesos.format(goal.target)}</p></div><span className="text-sm font-black text-[#2ec4b6]">{progress}%</span></div><div className="mt-4 h-3 rounded-full bg-[#f1f5f9]"><motion.div animate={{ width: `${progress}%` }} className="h-3 rounded-full bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)]" /></div><div className="mt-3 flex gap-2"><input value={amounts[goal.id] || ""} onChange={(e) => setAmounts((a) => ({ ...a, [goal.id]: e.target.value }))} placeholder="Aportar $" className="min-w-0 flex-1 rounded-2xl bg-[#f7f8fc] px-3 py-3 text-sm font-bold outline-none" /><button onClick={() => { const value = normalizeNumber(amounts[goal.id] || "0"); if (!value) return; setGoals((current) => current.map((g) => g.id === goal.id ? { ...g, saved: Math.min(g.target, g.saved + value) } : g)); setAmounts((a) => ({ ...a, [goal.id]: "" })); }} className="rounded-2xl bg-[#ecfdf5] px-4 py-3 text-sm font-black text-[#059669]">Sumar</button></div></article>; })}</div></div>;
}

function RecurringView({ recurring, setRecurring, onBack }: { recurring: RecurringExpense[]; setRecurring: React.Dispatch<React.SetStateAction<RecurringExpense[]>>; onBack: () => void }) {
  return <div className="px-5 pt-5"><SectionHeader title="Recurrentes" subtitle="Activa, pausa y revisa próximos cargos." onBack={onBack} /><div className="mt-5 space-y-3">{recurring.map((item) => { const category = getCategory(item.category); return <article key={item.id} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}18`, color: category.color }}><CategoryIcon name={item.category} /></div><div className="min-w-0 flex-1"><p className="font-black">{item.note}</p><p className="text-xs font-bold text-[#6b7280]">{pesos.format(item.amount)} · {item.frequency === "weekly" ? "Semanal" : item.frequency === "biweekly" ? "Quincenal" : "Mensual"}</p></div><button onClick={() => setRecurring((items) => items.map((r) => r.id === item.id ? { ...r, active: !r.active } : r))} className={cx("rounded-full px-3 py-1 text-xs font-black", item.active ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f1f5f9] text-[#94a3b8]")}>{item.active ? "Activo" : "Pausado"}</button></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f7f8fc] p-3"><div className="flex items-center gap-2 text-xs font-bold text-[#6b7280]"><CalendarClock className="h-4 w-4" />Próximo: {formatSmartDate(item.nextDate)}</div><button onClick={() => setRecurring((items) => items.map((r) => r.id === item.id ? { ...r, nextDate: addDaysISO(r.frequency === "weekly" ? 7 : r.frequency === "biweekly" ? 15 : 30) } : r))} className="text-xs font-black text-[#5aa9ff]"><RefreshCcw className="mr-1 inline h-3.5 w-3.5" />Aplicar</button></div></article>; })}</div></div>;
}

function ExportView({ transactions, goals, recurring, profile, budget, onBack }: { transactions: Transaction[]; goals: Goal[]; recurring: RecurringExpense[]; profile: UserProfile; budget: BudgetConfig; onBack: () => void }) {
  const csv = transactionToCSV(transactions);
  const json = JSON.stringify({ profile, transactions, goals, recurring, budget }, null, 2);
  const download = (content: string, filename: string, type: string) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };
  return <div className="px-5 pt-5"><SectionHeader title="Exportar" subtitle="Respalda tus movimientos en CSV o JSON." onBack={onBack} /><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => download(csv, "monia-movimientos.csv", "text/csv")} className="rounded-[1.6rem] bg-white p-4 text-left shadow-sm ring-1 ring-[#e5e7eb]"><FileDown className="mb-3 h-7 w-7 text-[#5aa9ff]" /><p className="font-black">CSV</p><p className="text-xs font-bold text-[#6b7280]">Para Excel o Sheets</p></button><button onClick={() => download(json, "monia-respaldo.json", "application/json")} className="rounded-[1.6rem] bg-white p-4 text-left shadow-sm ring-1 ring-[#e5e7eb]"><Download className="mb-3 h-7 w-7 text-[#7c6df2]" /><p className="font-black">JSON</p><p className="text-xs font-bold text-[#6b7280]">Respaldo completo</p></button></div><section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-black">Vista previa CSV</p><Clipboard className="h-4 w-4 text-[#94a3b8]" /></div><pre className="max-h-72 overflow-auto rounded-2xl bg-[#111827] p-3 text-[11px] font-semibold text-white/85 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{csv}</pre></section></div>;
}

function AccountView({ profile, setProfile, onBack, onSignOut }: { profile: UserProfile; setProfile: React.Dispatch<React.SetStateAction<UserProfile>>; onBack: () => void; onSignOut?: () => void }) {
  return <div className="px-5 pt-5"><SectionHeader title="Mi cuenta" subtitle="Perfil con datos útiles para personalizar tus finanzas." onBack={onBack} /><section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-4"><div className="grid h-20 w-20 place-items-center overflow-hidden rounded-[1.6rem] bg-[linear-gradient(135deg,#7c6df2_0%,#5aa9ff_100%)] text-3xl font-black text-white">{profile.photoUrl ? <img src={profile.photoUrl} alt="Perfil" className="h-full w-full object-cover" /> : profile.nickname.slice(0, 1).toUpperCase()}</div><div className="flex-1"><p className="text-lg font-black">{profile.nickname}</p><p className="text-xs font-bold text-[#6b7280]">{profile.email}</p><p className="mt-2 inline-flex rounded-full bg-[#effdf8] px-3 py-1 text-xs font-black text-[#2ec4b6]"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Perfil en la nube seguro</p></div></div><div className="mt-5 space-y-3"><EditField label="Nickname" value={profile.nickname} onChange={(value) => setProfile((p) => ({ ...p, nickname: value }))} /><EditField label="URL foto de perfil" value={profile.photoUrl} placeholder="https://..." onChange={(value) => setProfile((p) => ({ ...p, photoUrl: value }))} /><EditField label="Ciudad" value={profile.city} onChange={(value) => setProfile((p) => ({ ...p, city: value }))} /><div className="grid grid-cols-2 gap-3"><label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Moneda</span><select value={profile.currency} onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value as "MXN" | "USD" }))} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option>MXN</option><option>USD</option></select></label><EditField label="Pago" value={profile.payday} onChange={(value) => setProfile((p) => ({ ...p, payday: value }))} /></div><EditField label="Ingreso meta mensual" value={String(profile.monthlyIncomeGoal)} onChange={(value) => setProfile((p) => ({ ...p, monthlyIncomeGoal: normalizeNumber(value) }))} /></div></section><section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><p className="font-black">Datos de valor</p><div className="mt-3 grid grid-cols-2 gap-3"><MiniValue icon={WalletCards} label="Meta ingreso" value={pesos.format(profile.monthlyIncomeGoal)} /><MiniValue icon={CalendarClock} label="Frecuencia" value={profile.payday} /><MiniValue icon={Camera} label="Foto" value={profile.photoUrl ? "Activa" : "Inicial"} /><MiniValue icon={ShieldCheck} label="Estado" value="Nube" /></div></section>
  {onSignOut && (
    <button onClick={onSignOut} className="mt-5 w-full rounded-2xl bg-[#fff1f2] hover:bg-[#ffe4e6] px-4 py-3.5 text-sm font-black text-[#e11d48] border border-[#fecdd3] active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer">
      <LogOut className="h-4 w-4" />
      Cerrar sesión
    </button>
  )}
  </div>;
}

function MiniValue({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="rounded-2xl bg-[#f7f8fc] p-3"><Icon className="mb-2 h-5 w-5 text-[#7c6df2]" /><p className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">{label}</p><p className="mt-1 truncate text-sm font-black">{value}</p></div>;
}

function QuickExpenseModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (transaction: ParsedTransaction) => void }) {
  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[80] mx-auto max-w-[460px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button className="absolute inset-0 bg-[#111827]/36 backdrop-blur-[2px]" onClick={onClose} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 330, damping: 34 }} className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-auto rounded-t-[2.2rem] bg-[#f7f8fc] p-5 pb-[calc(env(safe-area-inset-bottom)+22px)] shadow-[0_-30px_80px_rgba(15,23,42,0.28)]"><div className="mb-4 flex items-center justify-between"><div><p className="text-lg font-black tracking-[-0.03em]">Agregar movimiento</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">Habla → entiende → confirmas → se guarda</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#6b7280] shadow-sm ring-1 ring-[#e5e7eb]"><X className="h-5 w-5" /></button></div><QuickExpenseInput compact onSave={(transaction) => { onSave(transaction); onClose(); }} /></motion.div></motion.div>}</AnimatePresence>;
}

function EditTransactionModal({ transaction, onClose, onSave }: { transaction: Transaction | null; onClose: () => void; onSave: (transaction: Transaction) => void }) {
  const [draft, setDraft] = useState<Transaction | null>(transaction);
  useEffect(() => setDraft(transaction), [transaction]);
  if (!transaction || !draft) return null;
  return <AnimatePresence><motion.div className="fixed inset-0 z-[90] mx-auto max-w-[460px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button className="absolute inset-0 bg-[#111827]/36 backdrop-blur-[2px]" onClick={onClose} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-x-0 bottom-0 rounded-t-[2.2rem] bg-white p-5 pb-8 shadow-[0_-30px_80px_rgba(15,23,42,0.28)]"><div className="mb-4 flex items-center justify-between"><div><p className="text-lg font-black">Editar movimiento</p><p className="text-xs font-bold text-[#6b7280]">Corrige monto, categoría, nota o fecha.</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f8fc]"><X className="h-5 w-5" /></button></div><div className="space-y-3"><div className="grid grid-cols-2 gap-2"><button onClick={() => setDraft({ ...draft, type: "expense" })} className={cx("rounded-2xl px-4 py-3 text-sm font-black", draft.type === "expense" ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f7f8fc] text-[#6b7280]")}>Gasto</button><button onClick={() => setDraft({ ...draft, type: "income" })} className={cx("rounded-2xl px-4 py-3 text-sm font-black", draft.type === "income" ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f7f8fc] text-[#6b7280]")}>Ingreso</button></div><div className="grid grid-cols-2 gap-3"><EditField label="Monto" value={String(draft.amount)} onChange={(v) => setDraft({ ...draft, amount: normalizeNumber(v) })} /><EditField label="Fecha" type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} /></div><label className="block rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Categoría</span><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, categoryId: getCategory(e.target.value).id })} className="mt-1 w-full bg-transparent text-sm font-black outline-none">{categories.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><EditField label="Nota" value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} /><button onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })} className="w-full rounded-2xl bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] px-4 py-3 text-sm font-black text-white">Guardar cambios</button></div></motion.div></motion.div></AnimatePresence>;
}

function Toast({ message }: { message: string }) {
  return <AnimatePresence>{message && <motion.div initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.96 }} className="fixed left-1/2 top-4 z-[100] flex w-[min(420px,calc(100%-32px))] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#111827] p-3 text-sm font-black text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#36d399]"><Check className="h-4 w-4" /></span><span>{message}</span></motion.div>}</AnimatePresence>;
}

function FeatureRow({ icon: Icon, title, description, color }: { icon: React.ElementType; title: string; description: string; color: string }) {
  return (
    <div className="flex gap-3.5">
      <div 
        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-black text-[#111827]">{title}</h3>
        <p className="mt-0.5 text-[11px] font-semibold leading-normal text-[#6b7280]">
          {description}
        </p>
      </div>
    </div>
  );
}

function LandingView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-[#111827] antialiased">
      <div className="mx-auto min-h-screen w-full max-w-[460px] bg-[#f7f8fc] p-6 flex flex-col justify-between shadow-[0_0_80px_rgba(15,23,42,0.08)] relative overflow-hidden">
        {/* Glow decorative bubbles */}
        <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] rounded-full bg-[#42d6b5]/10 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] rounded-full bg-[#7c6df2]/10 blur-[80px] pointer-events-none" />
        
        {/* Header / Logo */}
        <div className="pt-8 flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-20 h-20 rounded-[2rem] bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] flex items-center justify-center shadow-[0_20px_45px_rgba(66,214,181,0.35)] relative"
          >
            <Sparkles className="w-10 h-10 text-white" />
            <motion.span 
              animate={{ scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#2ec4b6] shadow-md border border-[#eefdf8]"
            >
              <PiggyBank className="w-3.5 h-3.5" />
            </motion.span>
          </motion.div>
          
          <motion.h1 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-6 text-4xl font-black tracking-[-0.05em] bg-[linear-gradient(135deg,#111827_0%,#4b5563_100%)] bg-clip-text text-transparent"
          >
            App MonIA
          </motion.h1>
          <motion.p 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-2 text-sm font-semibold text-[#6b7280] text-center"
          >
            Tu asistente financiero inteligente con IA local
          </motion.p>
        </div>

        {/* Feature Highlights Grid */}
        <motion.div 
          initial={{ y: 25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="my-auto py-8 space-y-4"
        >
          <div className="rounded-[2rem] border border-[#e5e7eb] bg-white/70 backdrop-blur-md p-5 shadow-sm space-y-4">
            <FeatureRow 
              icon={Mic} 
              title="Dictado por Voz Natural" 
              description='Di "Gasté 500 pesos en cena con amigos" y MonIA categoriza e ingresa el gasto en un segundo.'
              color="#42d6b5"
            />
            <FeatureRow 
              icon={Target} 
              title="Presupuestos y Metas" 
              description="Define tus límites semanales, quincenales o mensuales y recibe alertas automáticas de consumo."
              color="#5aa9ff"
            />
            <FeatureRow 
              icon={Repeat} 
              title="Gastos Recurrentes" 
              description="Sigue tus suscripciones como Netflix o internet de forma sencilla sin perder de vista los próximos cobros."
              color="#7c6df2"
            />
            <FeatureRow 
              icon={ShieldCheck} 
              title="Sincronización en la Nube" 
              description="Tus datos respaldados en tiempo real de forma segura. Accede desde cualquier lugar con tu cuenta de Google."
              color="#36d399"
            />
          </div>
        </motion.div>

        {/* Bottom Call to Action */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="pb-8 space-y-4 flex flex-col items-center"
        >
          <button 
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#111827] hover:bg-[#1f2937] text-white px-4 py-4 text-sm font-black shadow-[0_12px_30px_rgba(17,24,39,0.22)] active:scale-[0.98] transition duration-150 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#FFF"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#FFF"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FFF"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#FFF"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Iniciar sesión con Google</span>
          </button>
          
          <p className="text-[11px] font-black text-[#94a3b8] uppercase tracking-wider text-center">
            Tu información financiera está encriptada y protegida.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function MonIAGastosPreview() {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<BudgetConfig>(initialBudget);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [moreSection, setMoreSection] = useState<MoreSection>("menu");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.transactions) setTransactions(data.transactions);
            if (data.budget) setBudget(data.budget);
            if (data.goals) setGoals(data.goals);
            if (data.recurring) setRecurring(data.recurring);
            if (data.profile) {
              setProfile(data.profile);
            } else {
              setProfile({
                nickname: currentUser.displayName || "Usuario",
                email: currentUser.email || "",
                photoUrl: currentUser.photoURL || "",
                currency: "MXN",
                monthlyIncomeGoal: 30000,
                payday: "Quincenal",
                city: "México",
              });
            }
          } else {
            // El documento no existe, inicializar con datos de ejemplo
            const defaultProfile: UserProfile = {
              nickname: currentUser.displayName || "Karlos",
              email: currentUser.email || "",
              photoUrl: currentUser.photoURL || "",
              currency: "MXN",
              monthlyIncomeGoal: 30000,
              payday: "Quincenal",
              city: "Monterrey, NL",
            };
            await setDoc(docRef, {
              transactions: sampleTransactions,
              budget: initialBudget,
              goals: initialGoals,
              recurring: initialRecurring,
              profile: defaultProfile,
            });
            setTransactions(sampleTransactions);
            setBudget(initialBudget);
            setGoals(initialGoals);
            setRecurring(initialRecurring);
            setProfile(defaultProfile);
          }
        } catch (error) {
          console.error("Error al cargar datos desde Firestore:", error);
          showToast("Error al cargar tus datos. Usando datos locales.");
        }
      } else {
        setTransactions([]);
        setBudget(initialBudget);
        setGoals([]);
        setRecurring([]);
        setProfile(initialProfile);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync back to Firestore (debounced Autosave)
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (!loading && user) {
      isLoadedRef.current = true;
    } else {
      isLoadedRef.current = false;
    }
  }, [loading, user]);

  useEffect(() => {
    if (!user || !isLoadedRef.current) return;

    const saveData = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, {
          transactions,
          budget,
          goals,
          recurring,
          profile,
        }, { merge: true });
      } catch (error) {
        console.error("Error al sincronizar con Firestore:", error);
      }
    };

    const timeout = setTimeout(() => {
      saveData();
    }, 1000); // 1s debounce

    return () => clearTimeout(timeout);
  }, [transactions, budget, goals, recurring, profile, user]);

  const addTransaction = (parsed: ParsedTransaction) => { const transaction: Transaction = { ...parsed, id: globalThis.crypto?.randomUUID?.() || `t-${Date.now()}`, amount: Number(parsed.amount), note: parsed.note || parsed.category, categoryId: getCategory(parsed.category).id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; setTransactions((current) => [transaction, ...current]); showToast(`${transaction.type === "income" ? "Ingreso" : "Gasto"} agregado en ${transaction.category} por ${pesos.format(transaction.amount)}`); };
  const duplicateTransaction = (transaction: Transaction) => addTransaction({ ...transaction, source: "manual", rawInput: `Duplicado de ${transaction.note}`, needsConfirmation: false });
  const deleteTransaction = (id: string) => { setTransactions((current) => current.filter((item) => item.id !== id)); showToast("Movimiento eliminado"); };
  const saveEditedTransaction = (transaction: Transaction) => { setTransactions((current) => current.map((item) => item.id === transaction.id ? transaction : item)); setEditing(null); showToast("Movimiento actualizado"); };
  const goAccount = () => { setActiveTab("more"); setMoreSection("account"); };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] text-[#111827] flex flex-col items-center justify-center antialiased">
        <div className="mx-auto w-full max-w-[460px] min-h-screen flex flex-col items-center justify-center p-6 bg-[#f7f8fc] shadow-[0_0_80px_rgba(15,23,42,0.08)]">
          <div className="relative flex flex-col items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              className="relative w-20 h-20 rounded-[1.8rem] bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] flex items-center justify-center shadow-[0_15px_35px_rgba(66,214,181,0.3)]"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="mt-6 text-sm font-black text-[#94a3b8] uppercase tracking-[0.2em]"
            >
              Cargando MonIA...
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingView onLogin={async () => {
        try {
          await signInWithPopup(auth, googleProvider);
          showToast("¡Sesión iniciada con éxito!");
        } catch (error: any) {
          console.error("Error al iniciar sesión:", error);
          if (error.code === "auth/popup-closed-by-user") {
            showToast("Inicio de sesión cancelado.");
          } else {
            showToast("Error al conectar con Google.");
          }
        }
      }} />
    );
  }

  return <AppShell activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); if (tab !== "more") setMoreSection("menu"); }} onFabClick={() => setModalOpen(true)}><Toast message={toast} /><AnimatePresence mode="wait">{activeTab === "home" && <motion.div key="home" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}><HomeView profile={profile} transactions={transactions} budget={budget} onSave={addTransaction} onDelete={deleteTransaction} onDuplicate={duplicateTransaction} onEdit={setEditing} onGoAccount={goAccount} /></motion.div>}{activeTab === "transactions" && <motion.div key="transactions" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}><TransactionsView transactions={transactions} onDelete={deleteTransaction} onDuplicate={duplicateTransaction} onEdit={setEditing} /></motion.div>}{activeTab === "budgets" && <motion.div key="budgets" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}><BudgetsView transactions={transactions} budget={budget} setBudget={setBudget} /></motion.div>}{activeTab === "more" && <motion.div key="more" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}><MoreView section={moreSection} setSection={setMoreSection} transactions={transactions} goals={goals} setGoals={setGoals} recurring={recurring} setRecurring={setRecurring} profile={profile} setProfile={setProfile} budget={budget} onSignOut={async () => { try { await signOut(auth); showToast("Sesión cerrada con éxito."); } catch (error) { console.error("Error al cerrar sesión:", error); showToast("Error al cerrar sesión."); } }} /></motion.div>}</AnimatePresence><QuickExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={addTransaction} /><EditTransactionModal transaction={editing} onClose={() => setEditing(null)} onSave={saveEditedTransaction} /></AppShell>;
}
