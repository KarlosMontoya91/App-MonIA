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
  Upload,
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
  paymentMethod?: "card" | "cash";
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
  startDayOfWeek?: number;
  startDayOfMonth?: number;
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

const initialCategories: Category[] = [
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
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function addDaysISO(days: number) {
  const d = addDays(days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function inferCategory(input: string, type: TransactionType, customCategories?: Category[]) {
  const text = input.toLowerCase();
  if (type === "income") return "Nómina";
  const list = customCategories || initialCategories;
  for (const category of list) {
    if (category.name === "Nómina") continue;
    if (category.keywords && category.keywords.some((word) => text.includes(word))) return category.name;
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

function inferPaymentMethod(input: string): "card" | "cash" {
  const text = input.toLowerCase();
  if (
    text.includes("tarjeta") ||
    text.includes("debito") ||
    text.includes("débito") ||
    text.includes("credito") ||
    text.includes("crédito") ||
    text.includes("tc") ||
    text.includes("transferencia") ||
    text.includes("transferi")
  ) {
    return "card";
  }
  return "cash";
}

function parseExpenseInput(input: string, source: InputSource = "text", customCategories?: Category[]): ParsedTransaction {
  const rawInput = input.trim();
  const amountInfo = extractAmount(rawInput);
  const type = inferType(rawInput);
  const category = inferCategory(rawInput, type, customCategories);
  const note = inferNote(rawInput, category, amountInfo.token);
  let confidence = 0.45;
  if (amountInfo.amount > 0) confidence += 0.25;
  if (category !== "Otros") confidence += 0.2;
  if (note) confidence += 0.08;
  confidence = Math.min(0.98, Number(confidence.toFixed(2)));
  return { 
    type, 
    amount: amountInfo.amount, 
    category, 
    note, 
    date: getRelativeDate(rawInput), 
    confidence, 
    source, 
    rawInput, 
    needsConfirmation: confidence < 0.82 || !amountInfo.amount || category === "Otros",
    paymentMethod: inferPaymentMethod(rawInput)
  };
}

function formatSmartDate(dateISO: string) {
  if (dateISO === todayISO()) return "Hoy";
  if (dateISO === addDaysISO(-1)) return "Ayer";
  if (dateISO === addDaysISO(-2)) return "Antier";
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
}

function getCategory(name: string, customCategories?: Category[]) {
  const list = customCategories || initialCategories;
  return list.find((category) => category.name.toLowerCase() === name.toLowerCase()) || list[list.length - 1];
}

function CategoryIcon({ name, className = "h-5 w-5", customCategories }: { name: string; className?: string; customCategories?: Category[] }) {
  const iconName = getCategory(name, customCategories).icon;
  const icons: Record<string, React.ElementType> = { Coffee, Car, ShoppingCart, Wifi, HeartPulse, GraduationCap, Sofa, Gamepad2, PiggyBank, MoreHorizontal, CircleDollarSign };
  const Icon = icons[iconName] || MoreHorizontal;
  return <Icon className={className} />;
}

function UserAvatar({ photoUrl, nickname, size = "md" }: { photoUrl: string; nickname: string; size?: "sm" | "md" | "lg" }) {
  const isEmoji = photoUrl && photoUrl.length <= 2;
  const sizeClasses = {
    sm: "h-9 w-9 text-base rounded-xl",
    md: "h-12 w-12 text-xl rounded-2xl",
    lg: "h-20 w-20 text-3xl rounded-[1.6rem]",
  }[size] || "h-12 w-12 text-xl rounded-2xl";

  const firstLetter = (nickname || "U").slice(0, 1).toUpperCase();

  if (photoUrl && !isEmoji) {
    return (
      <div className={cx("overflow-hidden bg-[#f1f5f9] grid place-items-center shadow-sm ring-1 ring-[#e5e7eb]", sizeClasses)}>
        <img src={photoUrl} alt="Perfil" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={cx("grid place-items-center font-black text-white shadow-sm bg-[linear-gradient(135deg,#7c6df2_0%,#5aa9ff_100%)]", sizeClasses)}>
      {isEmoji ? photoUrl : firstLetter}
    </div>
  );
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWithinPeriod(dateISO: string, budget: BudgetConfig) {
  const date = startOfDay(new Date(`${dateISO}T12:00:00`));
  const now = startOfDay();
  const period = budget.period;

  if (period === "week") {
    const startDay = budget.startDayOfWeek !== undefined ? budget.startDayOfWeek : 1; // Default Monday
    let diff = now.getDay() - startDay;
    if (diff < 0) {
      diff += 7;
    }
    const startOfCurrentPeriod = new Date(now.getTime() - diff * 86400000);
    const endOfCurrentPeriod = new Date(startOfCurrentPeriod.getTime() + 6 * 86400000);
    return date >= startOfCurrentPeriod && date <= endOfCurrentPeriod;
  }

  if (period === "biweek") {
    let startOfCurrentPeriod: Date;
    let endOfCurrentPeriod: Date;
    if (now.getDate() <= 15) {
      startOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
      endOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth(), 15);
    } else {
      startOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth(), 16);
      endOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
    }
    return date >= startOfCurrentPeriod && date <= endOfCurrentPeriod;
  }

  if (period === "month") {
    const startDay = budget.startDayOfMonth !== undefined ? budget.startDayOfMonth : 1; // Default 1
    if (startDay === 1) {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } else {
      const getClippedDay = (year: number, month: number, targetDay: number) => {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return Math.min(targetDay, lastDay);
      };
      let startOfCurrentPeriod: Date;
      let endOfCurrentPeriod: Date;
      const currentStartDayClipped = getClippedDay(now.getFullYear(), now.getMonth(), startDay);

      if (now.getDate() >= currentStartDayClipped) {
        startOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth(), currentStartDayClipped);
        const nextMonthLastDay = getClippedDay(now.getFullYear(), now.getMonth() + 1, startDay);
        endOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth() + 1, nextMonthLastDay - 1);
      } else {
        const prevMonthLastDay = getClippedDay(now.getFullYear(), now.getMonth() - 1, startDay);
        startOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth() - 1, prevMonthLastDay);
        endOfCurrentPeriod = new Date(now.getFullYear(), now.getMonth(), currentStartDayClipped - 1);
      }
      return date >= startOfCurrentPeriod && date <= endOfCurrentPeriod;
    }
  }

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

function byCategoryData(transactions: Transaction[], customCategories?: Category[]) {
  const map = transactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});
  return Object.entries(map).map(([name, value]) => ({ name, value, color: getCategory(name, customCategories).color })).sort((a, b) => b.value - a.value);
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

function getGreeting(nickname: string) {
  const hour = new Date().getHours();
  const name = nickname || "Usuario";
  if (hour < 12) return `¡Buenos días, ${name}! ☀️`;
  if (hour < 19) return `¡Buenas tardes, ${name}! ⛅`;
  return `¡Buenas noches, ${name}! 🌙`;
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
  return <header className="px-5 pb-2 pt-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-[#6b7280]">{getGreeting(profile.nickname)}</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Tu dinero va así</h1><p className="mt-1 text-xs font-bold text-[#94a3b8]">Control {periodLabel(budget.period)} activo</p></div><button onClick={onGoAccount} className="focus:outline-none transition hover:scale-105 active:scale-95"><UserAvatar photoUrl={profile.photoUrl} nickname={profile.nickname} size="md" /></button></div></header>;
}

function SmartBalanceCard({ transactions, budget }: { transactions: Transaction[]; budget: BudgetConfig }) {
  const filtered = transactions.filter((t) => isWithinPeriod(t.date, budget));
  const income = filtered.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const expenses = filtered.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const activeBudget = budget.totalByPeriod[budget.period];
  const available = activeBudget + income - expenses;
  const isOverspent = available < 0;
  const usedPercentage = Math.round((expenses / Math.max(activeBudget, 1)) * 100);

  const cardGradient = isOverspent 
    ? "bg-[linear-gradient(135deg,#ff6b6b_0%,#ff8a65_100%)]" 
    : "bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)]";
  const cardShadow = isOverspent
    ? "shadow-[0_24px_60px_rgba(255,107,107,0.32)]"
    : "shadow-[0_24px_60px_rgba(66,214,181,0.28)]";

  return <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={cx("mx-5 overflow-hidden rounded-[2rem] p-5 text-white transition-all duration-300", cardGradient, cardShadow)}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white/80 flex items-center">Saldo disponible {periodLabel(budget.period)}{isOverspent && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider animate-pulse ml-1.5 inline-flex items-center gap-0.5">⚠️ Sobregirado</span>}</p><h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{pesos.format(available)}</h2><p className="mt-2 text-sm font-semibold text-white/82">Gastaste {pesos.format(expenses)} de {pesos.format(activeBudget)}</p></div><div className="rounded-2xl bg-white/18 p-3 backdrop-blur-md"><Wallet className="h-7 w-7" /></div></div><div className="mt-6"><div className="mb-2 flex items-center justify-between text-xs font-bold text-white/80"><span>Presupuesto usado</span><span>{usedPercentage}%</span></div><div className="h-3 rounded-full bg-white/22"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, usedPercentage)}%` }} className="h-3 rounded-full bg-white shadow-sm" /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><MetricGlass label="Ingresos" value={pesos.format(income)} /><MetricGlass label="Gastos" value={pesos.format(expenses)} /></div></motion.section>;
}

function MetricGlass({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/16 p-3 backdrop-blur-md"><p className="text-xs font-semibold text-white/72">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}

function QuickExpenseInput({ onSave, compact = false, customCategories, onOpenCreateCategory }: { onSave: (transaction: ParsedTransaction) => void; compact?: boolean; customCategories: Category[]; onOpenCreateCategory: (callback: (name: string) => void) => void }) {
  const [mode, setMode] = useState<"voice" | "text" | "manual">("text");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [error, setError] = useState("");
  const [listeningTranscript, setListeningTranscript] = useState("");
  const parseAndPreview = (value: string, source: InputSource = "text") => { const next = parseExpenseInput(value, source, customCategories); setError(""); if (!next.amount) setError("No detecté el monto. Intenta decir: Gasté 120 en comida."); setParsed(next); setText(value); };
  const saveParsed = (next: ParsedTransaction) => { if (!next.amount || next.amount <= 0) return setError("El monto debe ser mayor a 0 para guardar."); onSave({ ...next, note: next.note || next.category, needsConfirmation: false }); setParsed(null); setText(""); setError(""); setListeningTranscript(""); };
  return <section className={cx("rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]", !compact && "mx-5")}><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-black tracking-[-0.02em]">¿Qué gasto quieres registrar?</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">Voz, texto natural o manual compacto.</p></div><span className="rounded-full bg-[#effdf8] px-3 py-1 text-xs font-black text-[#2ec4b6]">IA local</span></div><div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#f7f8fc] p-1">{[{ id: "voice", label: "Voz", icon: Mic }, { id: "text", label: "Texto", icon: Send }, { id: "manual", label: "Manual", icon: Pencil }].map((item) => { const Icon = item.icon; const active = mode === item.id; return <button key={item.id} onClick={() => setMode(item.id as "voice" | "text" | "manual")} className={cx("relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-black transition", active ? "text-[#111827]" : "text-[#94a3b8]")}>{active && <motion.span layoutId="quick-mode" className="absolute inset-0 rounded-xl bg-white shadow-sm" />}<Icon className="relative z-10 h-4 w-4" /><span className="relative z-10">{item.label}</span></button>; })}</div><AnimatePresence mode="wait">{mode === "voice" && <motion.div key="voice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><VoiceExpenseButton onResult={(value) => parseAndPreview(value, "voice")} onError={setError} transcript={listeningTranscript} setTranscript={setListeningTranscript} /></motion.div>}{mode === "text" && <motion.div key="text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><div className="flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-[#f7f8fc] p-2"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && text.trim()) parseAndPreview(text, "text"); }} placeholder="Escribe: gasté 120 en comida" className="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold outline-none placeholder:text-[#94a3b8]" /><motion.button whileTap={{ scale: 0.94 }} onClick={() => text.trim() && parseAndPreview(text, "text")} className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111827] text-white shadow-sm"><Send className="h-4 w-4" /></motion.button></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{quickExamples.map((example) => <button key={example} onClick={() => parseAndPreview(example, "text")} className="shrink-0 rounded-full bg-[#f1f5f9] px-3 py-2 text-xs font-bold text-[#6b7280]">{example}</button>)}</div></motion.div>}{mode === "manual" && <motion.div key="manual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><TransactionForm onPreview={(next) => setParsed(next)} customCategories={customCategories} onOpenCreateCategory={onOpenCreateCategory} /></motion.div>}</AnimatePresence>{listeningTranscript && !parsed && <div className="mt-4 rounded-2xl bg-[#f7f8fc] p-3 text-sm font-semibold text-[#6b7280]">“{listeningTranscript}”</div>}{error && <div className="mt-4 flex gap-2 rounded-2xl bg-[#fff7ed] p-3 text-sm font-bold text-[#c2410c]"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}<AnimatePresence>{parsed && <ParsedExpensePreview parsed={parsed} onChange={setParsed} onCancel={() => setParsed(null)} onSave={saveParsed} customCategories={customCategories} onOpenCreateCategory={onOpenCreateCategory} />}</AnimatePresence></section>;
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

function TransactionForm({ onPreview, initial, customCategories, onOpenCreateCategory }: { onPreview: (transaction: ParsedTransaction) => void; initial?: Partial<ParsedTransaction>; customCategories: Category[]; onOpenCreateCategory: (callback: (name: string) => void) => void }) {
  const [amount, setAmount] = useState(String(initial?.amount || ""));
  const [category, setCategory] = useState(initial?.category || "Comida");
  const [note, setNote] = useState(initial?.note || "");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [type, setType] = useState<TransactionType>(initial?.type || "expense");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">(initial?.paymentMethod || "cash");
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><button onClick={() => setType("expense")} className={cx("rounded-2xl px-4 py-3 text-sm font-black", type === "expense" ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f7f8fc] text-[#6b7280]")}>Gasto</button><button onClick={() => setType("income")} className={cx("rounded-2xl px-4 py-3 text-sm font-black", type === "income" ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f7f8fc] text-[#6b7280]")}>Ingreso</button></div><div className="grid grid-cols-2 gap-3"><EditField label="Monto" value={amount} onChange={setAmount} /><EditField label="Fecha" value={date} type="date" onChange={setDate} /></div><div className="grid grid-cols-2 gap-3"><label className="block rounded-2xl border border-[#e5e7eb] bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Categoría</span><select value={category} onChange={(event) => { if (event.target.value === "__new__") { onOpenCreateCategory((newName) => setCategory(newName)); } else { setCategory(event.target.value); } }} className="mt-1 w-full bg-transparent text-sm font-black outline-none">{customCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}<option value="__new__">+ Crear nueva...</option></select></label><label className="block rounded-2xl border border-[#e5e7eb] bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Método de pago</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "card" | "cash")} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option value="cash">💵 Efectivo</option><option value="card">💳 Tarjeta</option></select></label></div><EditField label="Nota" value={note} placeholder="Ej. Tacos Don Pepe" onChange={setNote} /><button onClick={() => onPreview({ amount: normalizeNumber(amount), category, note: note || category, date, type, confidence: 1, source: initial?.source || "manual", rawInput: note, needsConfirmation: false, paymentMethod })} className="w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-black text-white">Revisar antes de guardar</button></div>;
}

function ParsedExpensePreview({ parsed, onChange, onSave, onCancel, customCategories, onOpenCreateCategory }: { parsed: ParsedTransaction; onChange: (transaction: ParsedTransaction) => void; onSave: (transaction: ParsedTransaction) => void; onCancel: () => void; customCategories: Category[]; onOpenCreateCategory: (callback: (name: string) => void) => void }) {
  const category = getCategory(parsed.category, customCategories);
  return <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="mt-4 overflow-hidden rounded-[1.6rem] border border-[#e5e7eb] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]"><div className="flex items-center justify-between border-b border-[#f1f5f9] p-4"><div><p className="text-sm font-black">Detecté este {parsed.type === "income" ? "ingreso" : "gasto"}</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">Revisa y guarda. Confianza: {Math.round(parsed.confidence * 100)}%</p></div><div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}20`, color: category.color }}><CategoryIcon name={parsed.category} customCategories={customCategories} /></div></div>{parsed.needsConfirmation && <div className="mx-4 mt-4 flex gap-2 rounded-2xl bg-[#fff7ed] p-3 text-xs font-bold text-[#c2410c]"><AlertTriangle className="h-4 w-4 shrink-0" /><span>Revisa antes de guardar. Hay datos con baja confianza.</span></div>}<div className="grid grid-cols-2 gap-3 p-4"><EditField label="Monto" value={String(parsed.amount || "")} onChange={(value) => onChange({ ...parsed, amount: normalizeNumber(value || "0") })} /><label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Tipo</span><select value={parsed.type} onChange={(event) => onChange({ ...parsed, type: event.target.value as TransactionType })} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label><label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Categoría</span><select value={parsed.category} onChange={(event) => { if (event.target.value === "__new__") { onOpenCreateCategory((newName) => onChange({ ...parsed, category: newName })); } else { onChange({ ...parsed, category: event.target.value }); } }} className="mt-1 w-full bg-transparent text-sm font-black outline-none">{customCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}<option value="__new__">+ Crear nueva...</option></select></label><label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Método de pago</span><select value={parsed.paymentMethod || "cash"} onChange={(event) => onChange({ ...parsed, paymentMethod: event.target.value as "card" | "cash" })} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option value="cash">💵 Efectivo</option><option value="card">💳 Tarjeta</option></select></label><div className="col-span-2"><EditField label="Fecha" value={parsed.date} type="date" onChange={(value) => onChange({ ...parsed, date: value })} /></div><div className="col-span-2"><EditField label="Nota" value={parsed.note} onChange={(value) => onChange({ ...parsed, note: value })} /></div></div>{parsed.rawInput && <p className="mx-4 mb-4 rounded-2xl bg-[#f7f8fc] p-3 text-xs font-semibold text-[#6b7280]">Entrada original: “{parsed.rawInput}”</p>}<div className="grid grid-cols-2 gap-3 border-t border-[#f1f5f9] p-4"><button onClick={onCancel} className="rounded-2xl bg-[#f1f5f9] px-4 py-3 text-sm font-black text-[#6b7280]">Cancelar</button><button onClick={() => onSave(parsed)} className="rounded-2xl bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(66,214,181,0.22)]">Guardar</button></div></motion.div>;
}

function EditField({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">{label}</span><input value={value} type={type} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-black outline-none placeholder:text-[#cbd5e1]" /></label>;
}

function HomeView({
  profile,
  transactions,
  budget,
  goals,
  onSave,
  onDelete,
  onDuplicate,
  onEdit,
  onGoAccount,
  onGoToBudgets,
  onGoToGoals,
  customCategories,
  onOpenCreateCategory,
}: {
  profile: UserProfile;
  transactions: Transaction[];
  budget: BudgetConfig;
  goals: Goal[];
  onSave: (transaction: ParsedTransaction) => void;
  onDelete: (id: string) => void;
  onDuplicate: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  onGoAccount: () => void;
  onGoToBudgets: () => void;
  onGoToGoals: () => void;
  customCategories: Category[];
  onOpenCreateCategory: (callback: (name: string) => void) => void;
}) {
  const latest = [...transactions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const expensesThisPeriod = transactions.filter((t) => t.type === "expense" && isWithinPeriod(t.date, budget));
  const top = byCategoryData(expensesThisPeriod, customCategories)[0];
  const todaySpent = transactions.filter((t) => t.type === "expense" && t.date === todayISO()).reduce((a, t) => a + t.amount, 0);
  return <div><Header profile={profile} budget={budget} onGoAccount={onGoAccount} /><div className="space-y-5">
    
    {/* Budget Onboarding Banner */}
    {budget.totalByPeriod[budget.period] === 0 && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-5 p-5 rounded-[2rem] bg-[linear-gradient(135deg,#ff9f68_0%,#ff6b6b_100%)] text-white shadow-[0_20px_45px_rgba(255,107,107,0.25)] relative overflow-hidden"
      >
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shrink-0">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-black">¡Comienza a presupuestar! 🎯</h3>
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-white/90">
              Tu presupuesto actual está en <span className="font-extrabold">$0</span>. Configura tu límite de gasto (semanal, quincenal o mensual) para que MonIA te ayude a optimizar tus finanzas en tiempo real.
            </p>
            <button
              onClick={onGoToBudgets}
              className="mt-3.5 px-4 py-2 bg-white text-[#ff6b6b] text-xs font-black rounded-xl shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              Configurar Presupuesto
            </button>
          </div>
        </div>
      </motion.div>
    )}

    {/* Goals Onboarding Banner */}
    {goals.length === 0 && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-5 p-5 rounded-[2rem] bg-[linear-gradient(135deg,#7c6df2_0%,#b794f4_100%)] text-white shadow-[0_20px_45px_rgba(124,109,242,0.25)] relative overflow-hidden"
      >
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shrink-0">
            <PiggyBank className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-black">¿Cuál es tu próximo sueño? 🏆</h3>
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-white/90">
              No tienes ninguna meta de ahorro activa. Define un objetivo claro (ej. fondo de emergencia, viaje) y haz aportaciones para ver tu progreso.
            </p>
            <button
              onClick={onGoToGoals}
              className="mt-3.5 px-4 py-2 bg-white text-[#7c6df2] text-xs font-black rounded-xl shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              Crear mi primera Meta
            </button>
          </div>
        </div>
      </motion.div>
    )}

    <SmartBalanceCard transactions={transactions} budget={budget} /><QuickExpenseInput onSave={onSave} customCategories={customCategories} onOpenCreateCategory={onOpenCreateCategory} /><section className="mx-5 grid grid-cols-2 gap-3"><InsightMiniCard icon={CalendarDays} label="Hoy gastaste" value={pesos.format(todaySpent)} tone="warm" /><InsightMiniCard icon={TrendingUp} label="Categoría alta" value={top?.name || "Sin gastos"} tone="purple" /></section><section className="mx-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black tracking-[-0.03em]">Últimos movimientos</h2></div><TransactionTimeline transactions={latest} limit={4} onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} customCategories={customCategories} /></section><section className="mx-5"><h2 className="mb-3 text-lg font-black tracking-[-0.03em]">Insights</h2><div className="space-y-2"><InsightCard type="success" title="Primero registra, luego analiza" description="Ya puedes guardar por voz, texto o manual y corregir antes de confirmar." /><InsightCard type="warning" title={top ? `${top.name} va fuerte` : "Sin foco de gasto"} description={top ? `Tu categoría más alta en este periodo lleva ${pesos.format(top.value)}.` : "Agrega movimientos para recibir recomendaciones reales."} /></div></section></div></div>;
}

function InsightMiniCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: "warm" | "purple" }) {
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className={cx("mb-3 grid h-10 w-10 place-items-center rounded-2xl text-white", tone === "warm" ? "bg-[linear-gradient(135deg,#ffc857_0%,#ff8a65_100%)]" : "bg-[linear-gradient(135deg,#7c6df2_0%,#b794f4_100%)]")}><Icon className="h-5 w-5" /></div><p className="text-xs font-bold text-[#6b7280]">{label}</p><p className="mt-1 truncate text-lg font-black tracking-[-0.03em]">{value}</p></motion.div>;
}

function InsightCard({ type, title, description }: { type: "warning" | "success" | "suggestion" | "info"; title: string; description: string }) {
  const config = { warning: { icon: AlertTriangle, bg: "#fff7ed", color: "#f97316" }, success: { icon: BadgeCheck, bg: "#ecfdf5", color: "#10b981" }, suggestion: { icon: Sparkles, bg: "#eef2ff", color: "#7c6df2" }, info: { icon: BarChart3, bg: "#eff6ff", color: "#3b82f6" } }[type];
  const Icon = config.icon;
  return <div className="flex gap-3 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: config.bg, color: config.color }}><Icon className="h-5 w-5" /></div><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">{description}</p></div></div>;
}

function TransactionItem({ transaction, onDuplicate, onDelete, onEdit, customCategories }: { transaction: Transaction; onDuplicate?: (transaction: Transaction) => void; onDelete?: (id: string) => void; onEdit?: (transaction: Transaction) => void; customCategories?: Category[] }) {
  const category = getCategory(transaction.category, customCategories);
  const amountPrefix = transaction.type === "income" ? "+" : "-";
  return <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="group flex items-center gap-3 rounded-[1.4rem] bg-white p-3 shadow-sm ring-1 ring-[#e5e7eb]"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}18`, color: category.color }}><CategoryIcon name={transaction.category} customCategories={customCategories} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black tracking-[-0.02em]">{transaction.note}</p><div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#94a3b8]"><span>{transaction.category}</span><span>·</span><span>{formatSmartDate(transaction.date)}</span><span>·</span><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5">{transaction.source === "voice" ? "Voz" : transaction.source === "text" ? "Texto" : transaction.source === "recurring" ? "Recurrente" : transaction.source === "manual" ? "Manual" : "IA"}</span><span>·</span><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5">{transaction.paymentMethod === "card" ? "💳 Tarjeta" : "💵 Efectivo"}</span></div></div><div className="text-right"><p className={cx("text-sm font-black", transaction.type === "income" ? "text-[#059669]" : "text-[#111827]")}>{amountPrefix}{pesos.format(transaction.amount)}</p><div className="mt-2 flex justify-end gap-1"><button onClick={() => onEdit?.(transaction)} className="grid h-7 w-7 place-items-center rounded-full bg-[#eef2ff] text-[#7c6df2] transition active:scale-90"><Edit3 className="h-3.5 w-3.5" /></button><button onClick={() => onDuplicate?.(transaction)} className="grid h-7 w-7 place-items-center rounded-full bg-[#f1f5f9] text-[#6b7280] transition active:scale-90"><Copy className="h-3.5 w-3.5" /></button><button onClick={() => onDelete?.(transaction.id)} className="grid h-7 w-7 place-items-center rounded-full bg-[#fff1f2] text-[#e11d48] transition active:scale-90"><Trash2 className="h-3.5 w-3.5" /></button></div></div></motion.div>;
}

function TransactionTimeline({ transactions, onDuplicate, onDelete, onEdit, limit, customCategories }: { transactions: Transaction[]; onDuplicate?: (transaction: Transaction) => void; onDelete?: (id: string) => void; onEdit?: (transaction: Transaction) => void; limit?: number; customCategories?: Category[] }) {
  const visible = limit ? transactions.slice(0, limit) : transactions;
  const groups = visible.reduce<Record<string, Transaction[]>>((acc, item) => { const label = formatSmartDate(item.date); acc[label] = acc[label] || []; acc[label].push(item); return acc; }, {});
  return <div className="space-y-5"><AnimatePresence>{Object.entries(groups).map(([label, items]) => <section key={label}><h3 className="mb-2 px-1 text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">{label}</h3><div className="space-y-2">{items.map((item) => <TransactionItem key={item.id} transaction={item} onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} customCategories={customCategories} />)}</div></section>)}</AnimatePresence></div>;
}

function TransactionsView({ transactions, onDelete, onDuplicate, onEdit, customCategories }: { transactions: Transaction[]; onDelete: (id: string) => void; onDuplicate: (transaction: Transaction) => void; onEdit: (transaction: Transaction) => void; customCategories: Category[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [category, setCategory] = useState("Todas");
  const filtered = transactions.filter((item) => type === "all" || item.type === type).filter((item) => category === "Todas" || item.category === category).filter((item) => `${item.note} ${item.category} ${item.rawInput}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return <div className="px-5 pt-5"><SectionHeader title="Movimientos" subtitle="Edita, duplica o elimina cualquier gasto guardado." /><div className="mt-5 rounded-[1.6rem] bg-white p-3 shadow-sm ring-1 ring-[#e5e7eb]"><div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#f7f8fc] px-3 py-2"><Search className="h-4 w-4 text-[#94a3b8]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tacos, gasolina, Netflix..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[#94a3b8]" /><SlidersHorizontal className="h-4 w-4 text-[#94a3b8]" /></div><div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{[{ id: "all", label: "Todos" }, { id: "expense", label: "Gastos" }, { id: "income", label: "Ingresos" }].map((item) => <button key={item.id} onClick={() => setType(item.id as "all" | TransactionType)} className={cx("shrink-0 rounded-full px-3 py-2 text-xs font-black", type === item.id ? "bg-[#111827] text-white" : "bg-[#f1f5f9] text-[#6b7280]")}>{item.label}</button>)}<select value={category} onChange={(event) => setCategory(event.target.value)} className="shrink-0 rounded-full bg-[#f1f5f9] px-3 py-2 text-xs font-black text-[#6b7280] outline-none"><option>Todas</option>{customCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div></div><div className="mt-5"><TransactionTimeline transactions={filtered} onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} customCategories={customCategories} /></div></div>;
}

function BudgetsView({ transactions, budget, setBudget, customCategories }: { transactions: Transaction[]; budget: BudgetConfig; setBudget: React.Dispatch<React.SetStateAction<BudgetConfig>>; customCategories: Category[] }) {
  const filtered = transactions.filter((item) => item.type === "expense" && isWithinPeriod(item.date, budget));
  const spent = filtered.reduce((acc, item) => acc + item.amount, 0);
  const activeBudget = budget.totalByPeriod[budget.period];
  const progress = Math.round((spent / Math.max(activeBudget, 1)) * 100);
  const expenseByCategory = filtered.reduce<Record<string, number>>((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.amount; return acc; }, {});

  const isBudgetExceeded = spent > activeBudget && activeBudget > 0;
  const budgetCardBg = isBudgetExceeded
    ? "bg-[linear-gradient(135deg,#ff6b6b_0%,#ff8a65_100%)] shadow-[0_24px_60px_rgba(255,107,107,0.24)]"
    : "bg-[linear-gradient(135deg,#7c6df2_0%,#b794f4_100%)] shadow-[0_24px_60px_rgba(124,109,242,0.24)]";

  return <div className="px-5 pt-5"><SectionHeader title="Presupuesto" subtitle="Control semanal, quincenal, mensual o anual editable." /><section className={cx("mt-5 rounded-[2rem] p-5 text-white transition-all duration-300", budgetCardBg)}><div className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{(["week", "biweek", "month", "year"] as BudgetPeriod[]).map((p) => <button key={p} onClick={() => setBudget((b) => ({ ...b, period: p }))} className={cx("shrink-0 rounded-full px-3 py-2 text-xs font-black", budget.period === p ? "bg-white text-[#7c6df2]" : "bg-white/16 text-white")}>{periodLabel(p)}</button>)}</div><p className="text-sm font-semibold text-white/78 flex items-center">Presupuesto {periodLabel(budget.period)}{isBudgetExceeded && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider animate-pulse ml-1.5 inline-flex items-center gap-0.5">⚠️ Superado</span>}</p><div className="mt-2 flex items-center gap-2"><input value={budget.totalByPeriod[budget.period]} type="number" onChange={(event) => setBudget((b) => ({ ...b, totalByPeriod: { ...b.totalByPeriod, [b.period]: Number(event.target.value) || 0 } }))} className="min-w-0 flex-1 rounded-2xl bg-white/18 px-3 py-2 text-2xl font-black tracking-[-0.05em] text-white outline-none placeholder:text-white/50" /><Save className="h-5 w-5 text-white/75" /></div><p className="mt-2 text-sm font-semibold text-white/80">Has usado {pesos.format(spent)} · {progress}%</p><div className="mt-5 h-3 rounded-full bg-white/20"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }} className="h-3 rounded-full bg-white" /></div></section>

      {/* Configuración de reinicio del periodo */}
      {(budget.period === "week" || budget.period === "month") && (
        <section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb] space-y-3">
          <p className="text-sm font-black flex items-center gap-1.5 text-[#111827]">
            <CalendarDays className="h-4 w-4 text-[#7c6df2]" />
            Reiniciar periodo presupuesto
          </p>
          {budget.period === "week" && (
            <label className="block rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Día de reinicio semanal</span>
              <select
                value={budget.startDayOfWeek !== undefined ? budget.startDayOfWeek : 1}
                onChange={(e) => setBudget((b) => ({ ...b, startDayOfWeek: Number(e.target.value) }))}
                className="mt-1 w-full bg-transparent text-sm font-black outline-none font-bold text-[#111827]"
              >
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
                <option value={0}>Domingo</option>
              </select>
            </label>
          )}
          {budget.period === "month" && (
            <label className="block rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Día de reinicio mensual</span>
              <select
                value={budget.startDayOfMonth !== undefined ? budget.startDayOfMonth : 1}
                onChange={(e) => setBudget((b) => ({ ...b, startDayOfMonth: Number(e.target.value) }))}
                className="mt-1 w-full bg-transparent text-sm font-black outline-none font-bold text-[#111827]"
              >
                <option value={1}>Día 1 (Inicio de mes)</option>
                <option value={5}>Día 5</option>
                <option value={10}>Día 10</option>
                <option value={15}>Día 15</option>
                <option value={20}>Día 20</option>
                <option value={25}>Día 25</option>
                <option value={31}>Último día del mes</option>
              </select>
            </label>
          )}
        </section>
      )}

      {budget.period === "biweek" && (
        <section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]">
          <p className="text-xs font-bold text-[#6b7280] leading-relaxed flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#36d399] shrink-0" />
            <span>El presupuesto quincenal se reinicia automáticamente los días 15 y el último día de cada mes (28/29 en Febrero, 30 o 31).</span>
          </p>
        </section>
      )}

      <section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><p className="text-sm font-black">Alertas activas</p><div className="mt-3 grid grid-cols-3 gap-2">{["50", "80", "100"].map((alert) => <button key={alert} onClick={() => setBudget((b) => ({ ...b, alerts: { ...b.alerts, [alert]: !b.alerts[alert] } }))} className={cx("rounded-2xl px-2 py-3 text-xs font-black", budget.alerts[alert] ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f1f5f9] text-[#94a3b8]")}><Bell className="mx-auto mb-1 h-4 w-4" />{alert}%</button>)}</div></section><div className="mt-5 space-y-3">{customCategories.filter((item) => item.name !== "Nómina").map((category) => <CategoryBudgetCard key={category.id} category={category} spent={expenseByCategory[category.name] || 0} limit={budget.categoryLimits[category.name] || 0} onLimitChange={(value) => setBudget((b) => ({ ...b, categoryLimits: { ...b.categoryLimits, [category.name]: value } }))} customCategories={customCategories} />)}</div></div>;
}

function CategoryBudgetCard({ category, spent, limit, onLimitChange, customCategories }: { category: Category; spent: number; limit: number; onLimitChange: (value: number) => void; customCategories: Category[] }) {
  const progress = Math.min(140, Math.round((spent / Math.max(limit, 1)) * 100));
  const tone = progress >= 100 ? "danger" : progress >= 80 ? "careful" : "healthy";
  return <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}18`, color: category.color }}><CategoryIcon name={category.name} customCategories={customCategories} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-black tracking-[-0.02em]">{category.name}</p><span className={cx("rounded-full px-2.5 py-1 text-[11px] font-black", tone === "healthy" && "bg-[#ecfdf5] text-[#059669]", tone === "careful" && "bg-[#fff7ed] text-[#f97316]", tone === "danger" && "bg-[#fff1f2] text-[#e11d48]")}>{tone === "healthy" ? "Sano" : tone === "careful" ? "Cuidado" : "Excedido"}</span></div><p className="mt-1 text-xs font-bold text-[#6b7280]">{pesos.format(spent)} de {pesos.format(limit)}</p></div></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f1f5f9]"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }} className={cx("h-3 rounded-full", tone === "healthy" && "bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)]", tone === "careful" && "bg-[linear-gradient(135deg,#ffc857_0%,#ff8a65_100%)]", tone === "danger" && "bg-[#ff6b6b]")} /></div><div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#f7f8fc] px-3 py-2"><span className="text-xs font-black text-[#94a3b8]">Límite</span><input value={limit} type="number" onChange={(event) => onLimitChange(Number(event.target.value) || 0)} className="min-w-0 flex-1 bg-transparent text-right text-sm font-black outline-none" /></div></motion.article>;
}

function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack?: () => void }) {
  return <header className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3">{onBack && <button onClick={onBack} className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-[#e5e7eb] cursor-pointer"><ArrowLeft className="h-5 w-5" /></button>}<div><h1 className="text-3xl font-black tracking-[-0.05em]">{title}</h1><p className="mt-1 max-w-[330px] text-sm font-semibold leading-relaxed text-[#6b7280]">{subtitle}</p></div></div><button className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-[#e5e7eb] pointer-events-none"><Sparkles className="h-5 w-5 text-[#7c6df2]" /></button></header>;
}

function MoreView({
  section,
  setSection,
  transactions,
  goals,
  setGoals,
  recurring,
  setRecurring,
  profile,
  setProfile,
  budget,
  customCategories,
  onOpenCreateCategory,
  onSignOut,
  onResetData,
}: {
  section: MoreSection;
  setSection: (section: MoreSection) => void;
  transactions: Transaction[];
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  recurring: RecurringExpense[];
  setRecurring: React.Dispatch<React.SetStateAction<RecurringExpense[]>>;
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  budget: BudgetConfig;
  customCategories: Category[];
  onOpenCreateCategory: (callback: (name: string) => void) => void;
  onSignOut?: () => void;
  onResetData?: () => void;
}) {
  if (section === "reports") return <ReportsView transactions={transactions} budget={budget} onBack={() => setSection("menu")} customCategories={customCategories} />;
  if (section === "goals") return <GoalsView goals={goals} setGoals={setGoals} onBack={() => setSection("menu")} />;
  if (section === "recurring") return <RecurringView recurring={recurring} setRecurring={setRecurring} onBack={() => setSection("menu")} customCategories={customCategories} onOpenCreateCategory={onOpenCreateCategory} />;
  if (section === "export") return <ExportView transactions={transactions} goals={goals} recurring={recurring} profile={profile} budget={budget} onBack={() => setSection("menu")} />;
  if (section === "account" || section === "settings") return <AccountView profile={profile} setProfile={setProfile} onBack={() => setSection("menu")} onSignOut={onSignOut} onResetData={onResetData} />;
  
  const cards = [{ id: "account", title: "Mi cuenta", subtitle: "Nickname, foto, moneda y datos útiles", icon: User, gradient: "bg-[linear-gradient(135deg,#7c6df2_0%,#5aa9ff_100%)]" }, { id: "goals", title: "Metas de ahorro", subtitle: "Crea metas y suma aportaciones", icon: PiggyBank, gradient: "bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)]" }, { id: "recurring", title: "Gastos recurrentes", subtitle: "Netflix, renta, servicios y ahorro", icon: Repeat, gradient: "bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)]" }, { id: "reports", title: "Reportes avanzados", subtitle: "Gráficas diarias, semanales, mensuales y anuales", icon: BarChart3, gradient: "bg-[linear-gradient(135deg,#7c6df2_0%,#b794f4_100%)]" }, { id: "export", title: "Exportar datos", subtitle: "CSV y JSON listos para respaldo", icon: Download, gradient: "bg-[#111827]" }, { id: "settings", title: "Configuración", subtitle: "Preferencias de cuenta", icon: Settings, gradient: "bg-[linear-gradient(135deg,#ffc857_0%,#ff8a65_100%)]" }] as const;
  
  return <div className="px-5 pt-5"><SectionHeader title="Más" subtitle="Funciones avanzadas funcionando sin saturar la app." /><div className="mt-5 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-3"><UserAvatar photoUrl={profile.photoUrl} nickname={profile.nickname} size="md" /><div><p className="text-base font-black">{profile.nickname}</p><p className="text-xs font-bold text-[#6b7280]">{profile.city} · {profile.currency}</p></div></div></div><div className="mt-5 space-y-3">{cards.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setSection(item.id as MoreSection)} className="flex w-full items-center gap-3 rounded-[1.6rem] bg-white p-4 text-left shadow-sm ring-1 ring-[#e5e7eb] transition hover:scale-[1.01] cursor-pointer"><span className={cx("grid h-12 w-12 place-items-center rounded-2xl text-white", item.gradient)}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black tracking-[-0.02em]">{item.title}</span><span className="mt-1 block text-xs font-semibold text-[#6b7280]">{item.subtitle}</span></span><ChevronRight className="h-5 w-5 text-[#cbd5e1]" /></button>; })}</div></div>;
}

function ReportsView({ transactions, budget, onBack, customCategories }: { transactions: Transaction[]; budget: BudgetConfig; onBack: () => void; customCategories: Category[] }) {
  const [mode, setMode] = useState<"daily" | "weekly" | "monthly" | "annual">("daily");
  const expenseTrend = groupExpensesByPeriod(transactions, mode);
  const categoryData = byCategoryData(transactions, customCategories);
  const comparison = incomeVsExpenseData(transactions);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const avgDaily = Math.round(totalExpenses / Math.max(1, new Set(transactions.map((t) => t.date)).size));
  return <div className="px-5 pt-5"><SectionHeader title="Reportes" subtitle="Indicadores y gráficas por día, semana, mes y año." onBack={onBack} /><div className="mt-5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{[{ id: "daily", label: "Diario" }, { id: "weekly", label: "Semanal" }, { id: "monthly", label: "Mensual" }, { id: "annual", label: "Anual" }].map((item) => <button key={item.id} onClick={() => setMode(item.id as any)} className={cx("shrink-0 rounded-full px-4 py-2 text-xs font-black cursor-pointer", mode === item.id ? "bg-[#111827] text-white" : "bg-white text-[#6b7280] ring-1 ring-[#e5e7eb]")}>{item.label}</button>)}</div><div className="mt-5 grid grid-cols-2 gap-3"><InsightMiniCard icon={BarChart3} label="Gasto total" value={pesos.format(totalExpenses)} tone="purple" /><InsightMiniCard icon={CalendarDays} label="Promedio día" value={pesos.format(avgDaily)} tone="warm" /></div><ChartCard title="Gastos por periodo"><ResponsiveContainer width="100%" height={220}><AreaChart data={expenseTrend}><defs><linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5aa9ff" stopOpacity={0.55} /><stop offset="100%" stopColor="#5aa9ff" stopOpacity={0.04} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value: any) => pesos.format(Number(value))} /><Area type="monotone" dataKey="gasto" stroke="#5aa9ff" strokeWidth={3} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="Gastos por categoría"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>{categoryData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value: any) => pesos.format(Number(value))} /></PieChart></ResponsiveContainer><div className="grid grid-cols-2 gap-2">{categoryData.slice(0, 6).map((item) => <div key={item.name} className="flex items-center gap-2 text-xs font-bold text-[#6b7280]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</div>)}</div></ChartCard><ChartCard title="Ingresos vs gastos"><ResponsiveContainer width="100%" height={230}><BarChart data={comparison}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value: any) => pesos.format(Number(value))} /><Bar dataKey="ingresos" radius={[10, 10, 0, 0]} fill="#36d399" /><Bar dataKey="gastos" radius={[10, 10, 0, 0]} fill="#ff9f68" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Indicador de presupuesto"><div className="rounded-[1.5rem] bg-[#f7f8fc] p-4"><p className="text-xs font-bold text-[#6b7280]">Presupuesto {periodLabel(budget.period)}</p><p className="mt-1 text-2xl font-black">{pesos.format(budget.totalByPeriod[budget.period])}</p><p className="mt-2 text-xs font-semibold text-[#6b7280]">Referencia contra tus gastos del periodo actual.</p></div></ChartCard></div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 rounded-[1.8rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><h2 className="mb-3 text-base font-black tracking-[-0.03em]">{title}</h2>{children}</section>;
}

function GoalsView({ goals, setGoals, onBack }: { goals: Goal[]; setGoals: React.Dispatch<React.SetStateAction<Goal[]>>; onBack: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const totalSaved = goals.reduce((a, g) => a + g.saved, 0);
  return <div className="px-5 pt-5 pb-8"><SectionHeader title="Metas" subtitle="Crea objetivos y registra aportaciones reales." onBack={onBack} /><section className="mt-5 rounded-[2rem] bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)] p-5 text-white shadow-sm"><p className="text-sm font-semibold text-white/80">Ahorro acumulado</p><p className="mt-1 text-3xl font-black">{pesos.format(totalSaved)}</p></section><div className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><p className="text-sm font-black">Nueva meta</p><div className="mt-3 grid grid-cols-2 gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="rounded-2xl bg-[#f7f8fc] px-3 py-3 text-sm font-bold outline-none border border-[#e5e7eb]" /><input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Meta $" className="rounded-2xl bg-[#f7f8fc] px-3 py-3 text-sm font-bold outline-none border border-[#e5e7eb]" /></div><button onClick={() => { if (!name || !normalizeNumber(target)) return; setGoals((g) => [{ id: `g-${Date.now()}`, name, target: normalizeNumber(target), saved: 0, dueDate: addDaysISO(90), color: "#5aa9ff" }, ...g]); setName(""); setTarget(""); }} className="mt-3 w-full rounded-2xl bg-[#111827] hover:bg-[#1f2937] px-4 py-3.5 text-sm font-black text-white cursor-pointer"><PlusCircle className="mr-2 inline h-4 w-4" />Crear meta</button></div><div className="mt-5 space-y-3">{goals.map((goal) => { const progress = Math.min(100, Math.round((goal.saved / goal.target) * 100)); return <article key={goal.id} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: goal.color }}><Trophy className="h-5 w-5" /></div><div className="flex-1"><p className="font-black">{goal.name}</p><p className="text-xs font-bold text-[#6b7280]">{pesos.format(goal.saved)} de {pesos.format(goal.target)}</p></div><span className="text-sm font-black text-[#2ec4b6]">{progress}%</span></div><div className="mt-4 h-3 rounded-full bg-[#f1f5f9]"><motion.div animate={{ width: `${progress}%` }} className="h-3 rounded-full bg-[linear-gradient(135deg,#36d399_0%,#42d6b5_100%)]" /></div><div className="mt-3 flex gap-2"><input value={amounts[goal.id] || ""} onChange={(e) => setAmounts((a) => ({ ...a, [goal.id]: e.target.value }))} placeholder="Aportar $" className="min-w-0 flex-1 rounded-2xl bg-[#f7f8fc] px-3 py-3 text-sm font-bold outline-none border border-[#e5e7eb]" /><button onClick={() => { const value = normalizeNumber(amounts[goal.id] || "0"); if (!value) return; setGoals((current) => current.map((g) => g.id === goal.id ? { ...g, saved: Math.min(g.target, g.saved + value) } : g)); setAmounts((a) => ({ ...a, [goal.id]: "" })); }} className="rounded-2xl bg-[#ecfdf5] hover:bg-[#d1fae5] px-4 py-3 text-sm font-black text-[#059669] cursor-pointer">Sumar</button></div></article>; })}</div></div>;
}

function RecurringView({
  recurring,
  setRecurring,
  onBack,
  customCategories,
  onOpenCreateCategory,
}: {
  recurring: RecurringExpense[];
  setRecurring: React.Dispatch<React.SetStateAction<RecurringExpense[]>>;
  onBack: () => void;
  customCategories: Category[];
  onOpenCreateCategory: (callback: (name: string) => void) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Servicios");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [nextDate, setNextDate] = useState(todayISO());

  const handleEdit = (item: RecurringExpense) => {
    setEditingId(item.id);
    setNote(item.note);
    setAmount(String(item.amount));
    setCategory(item.category);
    setFrequency(item.frequency);
    setNextDate(item.nextDate);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setRecurring((current) => current.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (!note.trim() || !normalizeNumber(amount)) return;
    const expenseAmount = normalizeNumber(amount);

    if (editingId) {
      setRecurring((current) =>
        current.map((item) =>
          item.id === editingId
            ? { ...item, note: note.trim(), amount: expenseAmount, category, frequency, nextDate }
            : item
        )
      );
    } else {
      const newExpense: RecurringExpense = {
        id: `r-${Date.now()}`,
        note: note.trim(),
        amount: expenseAmount,
        category,
        frequency,
        nextDate,
        active: true,
      };
      setRecurring((current) => [newExpense, ...current]);
    }

    setNote("");
    setAmount("");
    setCategory("Servicios");
    setFrequency("monthly");
    setNextDate(todayISO());
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="px-5 pt-5 pb-8">
      <SectionHeader title="Recurrentes" subtitle="Programa tus suscripciones y gastos fijos de tu mes." onBack={onBack} />

      <button
        onClick={() => {
          setShowForm(!showForm);
          setEditingId(null);
          setNote("");
          setAmount("");
          setCategory("Servicios");
          setFrequency("monthly");
          setNextDate(todayISO());
        }}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#111827] hover:bg-[#1f2937] text-white px-4 py-3.5 text-sm font-black shadow-sm active:scale-[0.98] transition cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        {showForm && !editingId ? "Cerrar Formulario" : "Agregar Gasto Recurrente"}
      </button>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-3"
          >
            <div className="rounded-[1.6rem] bg-white p-4 border border-[#e5e7eb] shadow-sm space-y-3">
              <p className="text-sm font-black">{editingId ? "Editar Gasto Recurrente" : "Nuevo Gasto Recurrente"}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Monto" value={amount} onChange={setAmount} />
                <label className="rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]">
                  <span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Frecuencia</span>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="mt-1 w-full bg-transparent text-sm font-black outline-none"
                  >
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]">
                  <span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Categoría</span>
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        onOpenCreateCategory((newName) => setCategory(newName));
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="mt-1 w-full bg-transparent text-sm font-black outline-none"
                  >
                    {customCategories.map((item) => (
                      <option key={item.id} value={item.name}>{item.name}</option>
                    ))}
                    <option value="__new__">+ Crear nueva...</option>
                  </select>
                </label>
                <EditField label="Próxima fecha" type="date" value={nextDate} onChange={setNextDate} />
              </div>

              <EditField label="Concepto / Nota" value={note} placeholder="Ej. Gasolina, Supermercado" onChange={setNote} />

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-2xl bg-[#f1f5f9] px-4 py-3 text-sm font-black text-[#6b7280] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!note.trim() || !normalizeNumber(amount)}
                  className="disabled:opacity-50 rounded-2xl bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] px-4 py-3 text-sm font-black text-white shadow-sm cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-3">
        {recurring.map((item) => {
          const categoryObj = getCategory(item.category, customCategories);
          return (
            <article key={item.id} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 place-items-center rounded-2xl shadow-sm shrink-0"
                  style={{ backgroundColor: `${categoryObj.color}18`, color: categoryObj.color }}
                >
                  <CategoryIcon name={item.category} customCategories={customCategories} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black truncate">{item.note}</p>
                  <p className="text-xs font-bold text-[#6b7280]">
                    {pesos.format(item.amount)} · {item.frequency === "weekly" ? "Semanal" : item.frequency === "biweekly" ? "Quincenal" : "Mensual"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleEdit(item)}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-[#eef2ff] text-[#7c6df2] transition active:scale-90 cursor-pointer"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff1f2] text-[#e11d48] transition active:scale-90 cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      setRecurring((items) =>
                        items.map((r) => (r.id === item.id ? { ...r, active: !r.active } : r))
                      )
                    }
                    className={cx(
                      "rounded-full px-3 py-1.5 text-xs font-black transition active:scale-95 cursor-pointer",
                      item.active ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f1f5f9] text-[#94a3b8]"
                    )}
                  >
                    {item.active ? "Activo" : "Pausado"}
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f7f8fc] p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#6b7280]">
                  <CalendarClock className="h-4 w-4" />
                  Próximo: {formatSmartDate(item.nextDate)}
                </div>
                <button
                  onClick={() =>
                    setRecurring((items) =>
                      items.map((r) =>
                        r.id === item.id
                          ? {
                              ...r,
                              nextDate: addDaysISO(
                                r.frequency === "weekly" ? 7 : r.frequency === "biweekly" ? 15 : 30
                              ),
                            }
                          : r
                      )
                    )
                  }
                  className="text-xs font-black text-[#5aa9ff] hover:underline cursor-pointer flex items-center"
                >
                  <RefreshCcw className="mr-1 inline h-3.5 w-3.5" />
                  Aplicar
                </button>
              </div>
            </article>
          );
        })}
        {recurring.length === 0 && (
          <p className="text-center text-sm font-semibold text-[#94a3b8] py-8">
            No tienes gastos recurrentes programados. ¡Agrega el primero!
          </p>
        )}
      </div>
    </div>
  );
}

function ExportView({ transactions, goals, recurring, profile, budget, onBack }: { transactions: Transaction[]; goals: Goal[]; recurring: RecurringExpense[]; profile: UserProfile; budget: BudgetConfig; onBack: () => void }) {
  const csv = transactionToCSV(transactions);
  const json = JSON.stringify({ profile, transactions, goals, recurring, budget }, null, 2);
  const download = (content: string, filename: string, type: string) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };
  return <div className="px-5 pt-5 pb-8"><SectionHeader title="Exportar" subtitle="Respalda tus movimientos en CSV o JSON." onBack={onBack} /><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => download(csv, "monia-movimientos.csv", "text/csv")} className="rounded-[1.6rem] bg-white p-4 text-left shadow-sm ring-1 ring-[#e5e7eb] cursor-pointer"><FileDown className="mb-3 h-7 w-7 text-[#5aa9ff]" /><p className="font-black">CSV</p><p className="text-xs font-bold text-[#6b7280]">Para Excel o Sheets</p></button><button onClick={() => download(json, "monia-respaldo.json", "application/json")} className="rounded-[1.6rem] bg-white p-4 text-left shadow-sm ring-1 ring-[#e5e7eb] cursor-pointer"><Download className="mb-3 h-7 w-7 text-[#7c6df2]" /><p className="font-black">JSON</p><p className="text-xs font-bold text-[#6b7280]">Respaldo completo</p></button></div><section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-black">Vista previa CSV</p><Clipboard className="h-4 w-4 text-[#94a3b8]" /></div><pre className="max-h-72 overflow-auto rounded-2xl bg-[#111827] p-3 text-[11px] font-semibold text-white/85 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{csv}</pre></section></div>;
}

function AccountView({ profile, setProfile, onBack, onSignOut, onResetData }: { profile: UserProfile; setProfile: React.Dispatch<React.SetStateAction<UserProfile>>; onBack: () => void; onSignOut?: () => void; onResetData?: () => void }) {
  const googlePhoto = auth.currentUser?.photoURL;
  const emojiPresets = ["🦁", "🦊", "🐼", "🚀", "💰", "💎", "🦄", "👻", "⚡", "🍀"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert("La imagen es muy grande. Por favor, selecciona una imagen menor a 500 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfile((p) => ({ ...p, photoUrl: base64String }));
    };
    reader.readAsDataURL(file);
  };

  return <div className="px-5 pt-5 pb-8"><SectionHeader title="Mi cuenta" subtitle="Perfil con datos útiles para personalizar tus finanzas." onBack={onBack} /><section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#e5e7eb]"><div className="flex items-center gap-4"><UserAvatar photoUrl={profile.photoUrl} nickname={profile.nickname} size="lg" /><div className="flex-1"><p className="text-lg font-black">{profile.nickname}</p><p className="text-xs font-bold text-[#6b7280]">{profile.email}</p><p className="mt-2 inline-flex rounded-full bg-[#effdf8] px-3 py-1 text-xs font-black text-[#2ec4b6] shadow-sm"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Perfil seguro en la nube</p></div></div>
  
  <div className="mt-5 border-t border-[#f1f5f9] pt-4">
    <p className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8] mb-2">Elegir avatar rápido</p>
    <div className="flex flex-wrap gap-2 items-center">
      {emojiPresets.map((emoji) => (
        <button
          key={emoji}
          onClick={() => setProfile((p) => ({ ...p, photoUrl: emoji }))}
          className={cx(
            "h-10 w-10 text-xl rounded-xl flex items-center justify-center border transition active:scale-90 cursor-pointer",
            profile.photoUrl === emoji ? "bg-[#f1f5f9] border-[#7c6df2] ring-2 ring-[#7c6df2]/20 text-white" : "bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]"
          )}
        >
          {emoji}
        </button>
      ))}
      {googlePhoto && (
        <button
          onClick={() => setProfile((p) => ({ ...p, photoUrl: googlePhoto }))}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-[#f1f5f9] border border-[#e2e8f0] hover:bg-[#e2e8f0] active:scale-95 transition cursor-pointer"
        >
          <Camera className="h-3.5 w-3.5 text-[#6b7280]" />
          Foto Google
        </button>
      )}
      <label
        htmlFor="avatar-file-upload"
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-[#f1f5f9] border border-[#e2e8f0] hover:bg-[#e2e8f0] active:scale-95 transition cursor-pointer"
      >
        <Upload className="h-3.5 w-3.5 text-[#6b7280]" />
        Subir Foto
      </label>
      <input
        type="file"
        id="avatar-file-upload"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  </div>

  <div className="mt-5 space-y-3"><EditField label="Nickname" value={profile.nickname} onChange={(value) => setProfile((p) => ({ ...p, nickname: value }))} /><EditField label="URL foto de perfil" value={profile.photoUrl} placeholder="https://..." onChange={(value) => setProfile((p) => ({ ...p, photoUrl: value }))} /><EditField label="Ciudad" value={profile.city} onChange={(value) => setProfile((p) => ({ ...p, city: value }))} /><div className="grid grid-cols-2 gap-3"><label className="rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Moneda</span><select value={profile.currency} onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value as "MXN" | "USD" }))} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option>MXN</option><option>USD</option></select></label><EditField label="Pago" value={profile.payday} onChange={(value) => setProfile((p) => ({ ...p, payday: value }))} /></div><EditField label="Ingreso meta mensual" value={String(profile.monthlyIncomeGoal)} onChange={(value) => setProfile((p) => ({ ...p, monthlyIncomeGoal: normalizeNumber(value) }))} /></div></section><section className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]"><p className="font-black">Datos de valor</p><div className="mt-3 grid grid-cols-2 gap-3"><MiniValue icon={WalletCards} label="Meta ingreso" value={pesos.format(profile.monthlyIncomeGoal)} /><MiniValue icon={CalendarClock} label="Frecuencia" value={profile.payday} /><MiniValue icon={Camera} label="Foto" value={profile.photoUrl ? "Activa" : "Inicial"} /><MiniValue icon={ShieldCheck} label="Estado" value="Nube" /></div></section>
  {onSignOut && (
    <button onClick={onSignOut} className="mt-5 w-full rounded-2xl bg-[#fff1f2] hover:bg-[#ffe4e6] px-4 py-3.5 text-sm font-black text-[#e11d48] border border-[#fecdd3] active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer">
      <LogOut className="h-4 w-4" />
      Cerrar sesión
    </button>
  )}
  
  {onResetData && (
    <section className="mt-5 rounded-[1.6rem] bg-white p-5 shadow-sm ring-1 ring-red-200 border border-red-100">
      <h3 className="text-sm font-black text-red-600 flex items-center gap-1.5">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        Zona de peligro
      </h3>
      <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
        Restablece por completo tu cuenta. Se borrarán permanentemente todos tus movimientos, presupuestos, metas y configuraciones del dispositivo y de la nube.
      </p>
      <button
        onClick={onResetData}
        className="mt-3.5 w-full rounded-2xl bg-red-50 hover:bg-red-100 px-4 py-3 text-sm font-black text-red-600 border border-red-200 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
      >
        <Trash2 className="h-4 w-4" />
        Restablecer todos los datos
      </button>
    </section>
  )}
  </div>;
}

function MiniValue({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="rounded-2xl bg-[#f7f8fc] p-3"><Icon className="mb-2 h-5 w-5 text-[#7c6df2]" /><p className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">{label}</p><p className="mt-1 truncate text-sm font-black">{value}</p></div>;
}

function QuickExpenseModal({ open, onClose, onSave, customCategories, onOpenCreateCategory }: { open: boolean; onClose: () => void; onSave: (transaction: ParsedTransaction) => void; customCategories: Category[]; onOpenCreateCategory: (callback: (name: string) => void) => void }) {
  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[80] mx-auto max-w-[460px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button className="absolute inset-0 bg-[#111827]/36 backdrop-blur-[2px]" onClick={onClose} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 330, damping: 34 }} className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-auto rounded-t-[2.2rem] bg-[#f7f8fc] p-5 pb-[calc(env(safe-area-inset-bottom)+22px)] shadow-[0_-30px_80px_rgba(15,23,42,0.28)]"><div className="mb-4 flex items-center justify-between"><div><p className="text-lg font-black tracking-[-0.03em]">Agregar movimiento</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">Habla → entiende → confirmas → se guarda</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#6b7280] shadow-sm ring-1 ring-[#e5e7eb] cursor-pointer"><X className="h-5 w-5" /></button></div><QuickExpenseInput compact onSave={(transaction) => { onSave(transaction); onClose(); }} customCategories={customCategories} onOpenCreateCategory={onOpenCreateCategory} /></motion.div></motion.div>}</AnimatePresence>;
}

function EditTransactionModal({ transaction, onClose, onSave, customCategories, onOpenCreateCategory }: { transaction: Transaction | null; onClose: () => void; onSave: (transaction: Transaction) => void; customCategories: Category[]; onOpenCreateCategory: (callback: (name: string) => void) => void }) {
  const [draft, setDraft] = useState<Transaction | null>(transaction);
  useEffect(() => setDraft(transaction), [transaction]);
  if (!transaction || !draft) return null;
  return <AnimatePresence><motion.div className="fixed inset-0 z-[90] mx-auto max-w-[460px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button className="absolute inset-0 bg-[#111827]/36 backdrop-blur-[2px]" onClick={onClose} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-x-0 bottom-0 rounded-t-[2.2rem] bg-white p-5 pb-8 shadow-[0_-30px_80px_rgba(15,23,42,0.28)]"><div className="mb-4 flex items-center justify-between"><div><p className="text-lg font-black">Editar movimiento</p><p className="text-xs font-bold text-[#6b7280]">Corrige monto, categoría, nota o fecha.</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f8fc] cursor-pointer"><X className="h-5 w-5" /></button></div><div className="space-y-3"><div className="grid grid-cols-2 gap-2"><button onClick={() => setDraft({ ...draft, type: "expense" })} className={cx("rounded-2xl px-4 py-3 text-sm font-black", draft.type === "expense" ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f7f8fc] text-[#6b7280]")}>Gasto</button><button onClick={() => setDraft({ ...draft, type: "income" })} className={cx("rounded-2xl px-4 py-3 text-sm font-black", draft.type === "income" ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f7f8fc] text-[#6b7280]")}>Ingreso</button></div><div className="grid grid-cols-2 gap-3"><EditField label="Monto" value={String(draft.amount)} onChange={(v) => setDraft({ ...draft, amount: normalizeNumber(v) })} /><EditField label="Fecha" type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} /></div><div className="grid grid-cols-2 gap-3"><label className="block rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Categoría</span><select value={draft.category} onChange={(e) => { if (e.target.value === "__new__") { onOpenCreateCategory((newName) => setDraft({ ...draft, category: newName, categoryId: getCategory(newName, customCategories).id })); } else { setDraft({ ...draft, category: e.target.value, categoryId: getCategory(e.target.value, customCategories).id }); } }} className="mt-1 w-full bg-transparent text-sm font-black outline-none">{customCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}<option value="__new__">+ Crear nueva...</option></select></label><label className="block rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]"><span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Método de pago</span><select value={draft.paymentMethod || "cash"} onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value as "card" | "cash" })} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option value="cash">💵 Efectivo</option><option value="card">💳 Tarjeta</option></select></label></div><EditField label="Nota" value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} /><button onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })} className="w-full rounded-2xl bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] px-4 py-3 text-sm font-black text-white cursor-pointer">Guardar cambios</button></div></motion.div></motion.div></AnimatePresence>;
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
        <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] rounded-full bg-[#42d6b5]/10 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] rounded-full bg-[#7c6df2]/10 blur-[80px] pointer-events-none" />
        
        <div className="pt-8 flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-24 h-24 rounded-[2.2rem] overflow-hidden flex items-center justify-center shadow-[0_20px_45px_rgba(66,214,181,0.35)] relative bg-white p-2"
          >
            <img src="logo_mark.png" alt="MonIA" className="w-full h-full object-contain" />
          </motion.div>
          
          <motion.div 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-6 flex justify-center"
          >
            <img src="logo_full.png" alt="MonIA Logo" className="h-14 object-contain" />
          </motion.div>
          <motion.p 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-sm font-semibold text-[#6b7280] text-center max-w-[280px]"
          >
            Tu asistente financiero inteligente con IA local
          </motion.p>
        </div>

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

function CreateCategoryModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, color: string, icon: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#ff9f68");
  const [icon, setIcon] = useState("MoreHorizontal");

  const colors = [
    "#ff6b6b",
    "#ff9f68",
    "#ffc857",
    "#36d399",
    "#42d6b5",
    "#5aa9ff",
    "#7c6df2",
    "#b794f4",
    "#ec4899",
    "#94a3b8",
  ];

  const icons = [
    { name: "Coffee", label: "Comida" },
    { name: "ShoppingCart", label: "Súper" },
    { name: "Car", label: "Transporte" },
    { name: "Wifi", label: "Servicios" },
    { name: "HeartPulse", label: "Salud" },
    { name: "GraduationCap", label: "Edu" },
    { name: "Sofa", label: "Hogar" },
    { name: "Gamepad2", label: "Fun" },
    { name: "PiggyBank", label: "Ahorro" },
    { name: "CircleDollarSign", label: "Nómina" },
    { name: "MoreHorizontal", label: "Otro" },
  ];

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), color, icon);
    setName("");
    setColor("#ff9f68");
    setIcon("MoreHorizontal");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] mx-auto max-w-[460px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="absolute inset-0 bg-[#111827]/40 backdrop-blur-[2px] cursor-pointer" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 330, damping: 34 }}
            className="absolute inset-x-0 bottom-0 rounded-t-[2.2rem] bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+22px)] shadow-[0_-30px_80px_rgba(15,23,42,0.28)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-lg font-black tracking-[-0.03em]">Crear nueva categoría</p>
                <p className="text-xs font-semibold text-[#6b7280]">Agrega una categoría personalizada a tus finanzas.</p>
              </div>
              <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f8fc] text-[#6b7280] cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block rounded-2xl bg-[#f7f8fc] px-3 py-2 border border-[#e5e7eb]">
                <span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8]">Nombre de categoría</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Mascotas, Regalos, Vacaciones"
                  className="mt-1 w-full bg-transparent text-sm font-black outline-none"
                />
              </label>

              <div>
                <span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8] block mb-2">Color temático</span>
                <div className="flex flex-wrap gap-2.5">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cx(
                        "h-8 w-8 rounded-full transition active:scale-90 relative cursor-pointer",
                        color === c ? "ring-2 ring-offset-2 ring-[#111827]" : ""
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-wide text-[#94a3b8] block mb-2">Icono representativo</span>
                <div className="flex flex-wrap gap-2">
                  {icons.map((ic) => {
                    const iconsMap: Record<string, React.ElementType> = { Coffee, Car, ShoppingCart, Wifi, HeartPulse, GraduationCap, Sofa, Gamepad2, PiggyBank, CircleDollarSign, MoreHorizontal };
                    const IconComp = iconsMap[ic.name] || MoreHorizontal;
                    return (
                      <button
                        key={ic.name}
                        onClick={() => setIcon(ic.name)}
                        className={cx(
                          "p-2.5 rounded-xl border transition active:scale-95 flex items-center justify-center cursor-pointer",
                          icon === ic.name ? "bg-[#f1f5f9] border-[#7c6df2] text-[#7c6df2]" : "bg-[#f8fafc] border-[#e2e8f0] text-[#6b7280] hover:bg-[#f1f5f9]"
                        )}
                        title={ic.label}
                      >
                        <IconComp className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={onClose} className="rounded-2xl bg-[#f1f5f9] px-4 py-3 text-sm font-black text-[#6b7280] cursor-pointer">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="disabled:opacity-50 rounded-2xl bg-[linear-gradient(135deg,#42d6b5_0%,#5aa9ff_100%)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(66,214,181,0.22)] cursor-pointer"
                >
                  Crear Categoría
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function MonIAGastosPreview() {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const cleanBudget: BudgetConfig = {
    period: "month",
    totalByPeriod: { week: 0, biweek: 0, month: 0, year: 0 },
    categoryLimits: { Comida: 0, Supermercado: 0, Transporte: 0, Servicios: 0, Salud: 0, Educación: 0, Hogar: 0, Entretenimiento: 0, Ahorro: 0, Otros: 0 },
    alerts: { "50": true, "80": true, "100": true },
    startDayOfWeek: 1, // Lunes por defecto
    startDayOfMonth: 1, // Día 1 por defecto
  };

  const defaultRecurring: RecurringExpense[] = [
    { id: "r-def-1", note: "Gasolina", amount: 1200, category: "Transporte", frequency: "monthly", nextDate: addDaysISO(5), active: true },
    { id: "r-def-2", note: "Supermercado", amount: 2500, category: "Supermercado", frequency: "monthly", nextDate: addDaysISO(10), active: true },
  ];

  const defaultProfileEmpty = (email: string, name: string, photo: string): UserProfile => ({
    nickname: name || "Usuario",
    email: email || "",
    photoUrl: photo || "",
    currency: "MXN",
    monthlyIncomeGoal: 0,
    payday: "Quincenal",
    city: "México",
  });

  const [budget, setBudget] = useState<BudgetConfig>(cleanBudget);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    nickname: "Usuario",
    email: "",
    photoUrl: "",
    currency: "MXN",
    monthlyIncomeGoal: 0,
    payday: "Quincenal",
    city: "México",
  });
  const [categoriesState, setCategoriesState] = useState<Category[]>(initialCategories);

  const [moreSection, setMoreSection] = useState<MoreSection>("menu");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toast, setToast] = useState("");

  // Custom category modal states
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [onCategoryCreatedCallback, setOnCategoryCreatedCallback] = useState<((name: string) => void) | null>(null);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };

  const handleOpenCreateCategory = (callback: (name: string) => void) => {
    setOnCategoryCreatedCallback(() => callback);
    setCreateCategoryOpen(true);
  };

  const handleAddNewCategory = (name: string, color: string, icon: string) => {
    const newId = `cat-${Date.now()}`;
    const newCategory: Category = {
      id: newId,
      name: titleCase(name),
      color,
      icon,
      keywords: [name.toLowerCase()],
    };
    setCategoriesState((current) => [...current, newCategory]);
    
    if (onCategoryCreatedCallback) {
      onCategoryCreatedCallback(newCategory.name);
    }
    setCreateCategoryOpen(false);
    showToast(`Categoría "${newCategory.name}" agregada con éxito`);
  };

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
            if (data.categories) setCategoriesState(data.categories);
            if (data.profile) {
              setProfile(data.profile);
            } else {
              setProfile(defaultProfileEmpty(
                currentUser.email || "", 
                currentUser.displayName?.split(" ")[0] || "Usuario", 
                currentUser.photoURL || ""
              ));
            }
          } else {
            // El documento no existe en la nube, inicializar cuenta totalmente limpia
            const cleanProf = defaultProfileEmpty(
              currentUser.email || "", 
              currentUser.displayName?.split(" ")[0] || "Usuario", 
              currentUser.photoURL || ""
            );
            await setDoc(docRef, {
              transactions: [],
              budget: cleanBudget,
              goals: [],
              recurring: defaultRecurring,
              profile: cleanProf,
              categories: initialCategories,
            });
            setTransactions([]);
            setBudget(cleanBudget);
            setGoals([]);
            setRecurring(defaultRecurring);
            setProfile(cleanProf);
            setCategoriesState(initialCategories);
          }
        } catch (error) {
          console.error("Error al cargar datos desde Firestore:", error);
          showToast("Error al cargar tus datos. Usando base local.");
        }
      } else {
        setTransactions([]);
        setBudget(cleanBudget);
        setGoals([]);
        setRecurring([]);
        setProfile({
          nickname: "Usuario",
          email: "",
          photoUrl: "",
          currency: "MXN",
          monthlyIncomeGoal: 0,
          payday: "Quincenal",
          city: "México",
        });
        setCategoriesState(initialCategories);
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
          categories: categoriesState,
        }, { merge: true });
      } catch (error) {
        console.error("Error al sincronizar con Firestore:", error);
      }
    };

    const timeout = setTimeout(() => {
      saveData();
    }, 1000); // 1s debounce

    return () => clearTimeout(timeout);
  }, [transactions, budget, goals, recurring, profile, categoriesState, user]);

  const addTransaction = (parsed: ParsedTransaction) => { const transaction: Transaction = { ...parsed, id: globalThis.crypto?.randomUUID?.() || `t-${Date.now()}`, amount: Number(parsed.amount), note: parsed.note || parsed.category, categoryId: getCategory(parsed.category, categoriesState).id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; setTransactions((current) => [transaction, ...current]); showToast(`${transaction.type === "income" ? "Ingreso" : "Gasto"} agregado en ${transaction.category} por ${pesos.format(transaction.amount)}`); };
  const duplicateTransaction = (transaction: Transaction) => addTransaction({ ...transaction, source: "manual", rawInput: `Duplicado de ${transaction.note}`, needsConfirmation: false });
  const deleteTransaction = (id: string) => { setTransactions((current) => current.filter((item) => item.id !== id)); showToast("Movimiento eliminado"); };
  const saveEditedTransaction = (transaction: Transaction) => { setTransactions((current) => current.map((item) => item.id === transaction.id ? transaction : item)); setEditing(null); showToast("Movimiento actualizado"); };
  const goAccount = () => { setActiveTab("more"); setMoreSection("account"); };

  const handleGoToBudgets = () => {
    setActiveTab("budgets");
  };

  const handleGoToGoals = () => {
    setActiveTab("more");
    setMoreSection("goals");
  };

  const handleResetData = async () => {
    if (!window.confirm("¿Estás seguro de que quieres restablecer tu cuenta? Se eliminarán de forma permanente todos tus movimientos, presupuestos, metas, gastos recurrentes y configuración. Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      setTransactions([]);
      setBudget(cleanBudget);
      setGoals([]);
      setRecurring([]);
      
      const cleanProf = defaultProfileEmpty(
        user?.email || "", 
        user?.displayName?.split(" ")[0] || "Usuario", 
        user?.photoURL || ""
      );
      setProfile(cleanProf);
      setCategoriesState(initialCategories);

      if (user) {
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, {
          transactions: [],
          budget: cleanBudget,
          goals: [],
          recurring: [],
          profile: cleanProf,
          categories: initialCategories,
        });
      }

      showToast("¡Cuenta restablecida con éxito!");
      setMoreSection("menu");
    } catch (error) {
      console.error("Error al restablecer la cuenta:", error);
      showToast("Error al restablecer datos.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] text-[#111827] flex flex-col items-center justify-center antialiased">
        <div className="mx-auto w-full max-w-[460px] min-h-screen flex flex-col items-center justify-center p-6 bg-[#f7f8fc] shadow-[0_0_80px_rgba(15,23,42,0.08)]">
          <div className="relative flex flex-col items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="relative w-24 h-24 rounded-[2.2rem] overflow-hidden flex items-center justify-center shadow-[0_15px_35px_rgba(66,214,181,0.3)] bg-white p-2"
            >
              <img src="logo_mark.png" alt="MonIA" className="w-full h-full object-contain" />
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

  return <AppShell activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); if (tab !== "more") setMoreSection("menu"); }} onFabClick={() => setModalOpen(true)}><Toast message={toast} /><AnimatePresence mode="wait">
    {activeTab === "home" && (
      <motion.div key="home" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
        <HomeView
          profile={profile}
          transactions={transactions}
          budget={budget}
          goals={goals}
          onSave={addTransaction}
          onDelete={deleteTransaction}
          onDuplicate={duplicateTransaction}
          onEdit={setEditing}
          onGoAccount={goAccount}
          onGoToBudgets={handleGoToBudgets}
          onGoToGoals={handleGoToGoals}
          customCategories={categoriesState}
          onOpenCreateCategory={handleOpenCreateCategory}
        />
      </motion.div>
    )}
    
    {activeTab === "transactions" && (
      <motion.div key="transactions" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
        <TransactionsView
          transactions={transactions}
          onDelete={deleteTransaction}
          onDuplicate={duplicateTransaction}
          onEdit={setEditing}
          customCategories={categoriesState}
        />
      </motion.div>
    )}
    
    {activeTab === "budgets" && (
      <motion.div key="budgets" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
        <BudgetsView
          transactions={transactions}
          budget={budget}
          setBudget={setBudget}
          customCategories={categoriesState}
        />
      </motion.div>
    )}
    
    {activeTab === "more" && (
      <motion.div key="more" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
        <MoreView
          section={moreSection}
          setSection={setMoreSection}
          transactions={transactions}
          goals={goals}
          setGoals={setGoals}
          recurring={recurring}
          setRecurring={setRecurring}
          profile={profile}
          setProfile={setProfile}
          budget={budget}
          customCategories={categoriesState}
          onOpenCreateCategory={handleOpenCreateCategory}
          onSignOut={async () => {
            try {
              await signOut(auth);
              showToast("Sesión cerrada con éxito.");
            } catch (error) {
              console.error("Error al cerrar sesión:", error);
              showToast("Error al cerrar sesión.");
            }
          }}
          onResetData={handleResetData}
        />
      </motion.div>
    )}
  </AnimatePresence>
  
  <QuickExpenseModal
    open={modalOpen}
    onClose={() => setModalOpen(false)}
    onSave={addTransaction}
    customCategories={categoriesState}
    onOpenCreateCategory={handleOpenCreateCategory}
  />
  
  <EditTransactionModal
    transaction={editing}
    onClose={() => setEditing(null)}
    onSave={saveEditedTransaction}
    customCategories={categoriesState}
    onOpenCreateCategory={handleOpenCreateCategory}
  />

  <CreateCategoryModal
    open={createCategoryOpen}
    onClose={() => setCreateCategoryOpen(false)}
    onSave={handleAddNewCategory}
  />
  </AppShell>;
}
