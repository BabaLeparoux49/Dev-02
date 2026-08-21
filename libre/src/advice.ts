import { EXPENSE_CATEGORIES } from "./types";
import type { AppState, ExpenseCategory, Transaction } from "./types";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

export interface MonthSummary {
  income: number;
  expenses: number;
  balance: number;
  byCategory: Record<string, number>;
  savingsRate: number;
}

export interface AdviceItem {
  id: string;
  tone: "good" | "warn" | "action" | "info";
  title: string;
  body: string;
}

export interface InvestmentPlan {
  liquid: { name: string; percent: number; note: string };
  medium: { name: string; percent: number; note: string };
  long: { name: string; percent: number; note: string };
  monthlyInvestHint: number;
  disclaimer: string;
}

function inMonth(tx: Transaction, ref: Date): boolean {
  const d = parseISO(tx.date);
  return d >= startOfMonth(ref) && d <= endOfMonth(ref);
}

export function summarizeMonth(state: AppState, ref = new Date()): MonthSummary {
  const txs = state.transactions.filter((t) => inMonth(t, ref));
  let income = 0;
  let expenses = 0;
  const byCategory: Record<string, number> = {};

  for (const t of txs) {
    if (t.type === "income") {
      income += t.amount;
    } else {
      expenses += t.amount;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
    }
  }

  // If no income entries this month, fall back to declared salary
  if (income === 0 && state.profile.monthlySalary > 0) {
    income = state.profile.monthlySalary;
  }

  const balance = income - expenses;
  const savingsRate = income > 0 ? balance / income : 0;

  return { income, expenses, balance, byCategory, savingsRate };
}

export function averageMonthlyExpenses(state: AppState, months = 3): number {
  const now = new Date();
  let total = 0;
  let counted = 0;
  for (let i = 0; i < months; i++) {
    const ref = subMonths(now, i);
    const s = summarizeMonth(state, ref);
    if (s.expenses > 0 || i === 0) {
      total += s.expenses;
      counted += 1;
    }
  }
  return counted ? total / counted : 0;
}

export function buildAdvice(state: AppState): AdviceItem[] {
  const month = summarizeMonth(state);
  const avgExp = averageMonthlyExpenses(state);
  const items: AdviceItem[] = [];
  const salary = Math.max(month.income, state.profile.monthlySalary);

  if (salary <= 0 && state.transactions.length === 0) {
    items.push({
      id: "start",
      tone: "info",
      title: "Commence par ton salaire",
      body: "Indique ton salaire net mensuel dans Réglages, puis ajoute tes dépenses du mois. Les conseils s’affinent au fil des saisies.",
    });
    return items;
  }

  if (state.transactions.filter((t) => t.type === "expense").length < 3) {
    items.push({
      id: "more-data",
      tone: "info",
      title: "Ajoute encore quelques dépenses",
      body: "Avec au moins une semaine de dépenses saisies, les plafonds et l’épargne recommandée deviennent plus fiables.",
    });
  }

  // Savings capacity
  if (month.balance > 0) {
    items.push({
      id: "can-save",
      tone: "good",
      title: `Tu peux épargner environ ${fmt(month.balance)} ce mois-ci`,
      body: `Revenus ${fmt(month.income)} − dépenses ${fmt(month.expenses)}. Vise au moins 20 % du revenu net (${fmt(salary * 0.2)}) si tu peux.`,
    });
  } else if (month.expenses > 0) {
    items.push({
      id: "overspend",
      tone: "warn",
      title: "Ce mois dépasse tes revenus",
      body: `Écart de ${fmt(Math.abs(month.balance))}. Coupe d’abord dans restaurants, shopping et abonnements avant de toucher au logement.`,
    });
  }

  // 50/30/20 envelopes
  if (salary > 0) {
    const needs = salary * 0.5;
    const wants = salary * 0.3;
    const save = salary * 0.2;
    const essentialCats: ExpenseCategory[] = [
      "logement",
      "alimentation",
      "transport",
      "sante",
    ];
    const wantCats: ExpenseCategory[] = [
      "loisirs",
      "abonnements",
      "shopping",
      "restaurants",
    ];
    const essentialSpent = essentialCats.reduce(
      (s, c) => s + (month.byCategory[c] ?? 0),
      0,
    );
    const wantSpent = wantCats.reduce(
      (s, c) => s + (month.byCategory[c] ?? 0),
      0,
    );

    items.push({
      id: "envelopes",
      tone: "action",
      title: "Enveloppes du mois (règle 50 / 30 / 20)",
      body: `Besoins ~${fmt(needs)} (tu es à ${fmt(essentialSpent)}) · Envies ~${fmt(wants)} (tu es à ${fmt(wantSpent)}) · Épargne / invest ~${fmt(save)}.`,
    });

    if (wantSpent > wants) {
      items.push({
        id: "wants-high",
        tone: "warn",
        title: "Les envies dépassent le plafond",
        body: `Il te reste idéalement ${fmt(Math.max(0, wants - wantSpent))} sur loisirs / restos / shopping. Reporte un achat non urgent cette semaine.`,
      });
    }
  }

  // Top spending category
  const entries = Object.entries(month.byCategory).sort((a, b) => b[1] - a[1]);
  if (entries[0] && salary > 0) {
    const [cat, amount] = entries[0];
    const label =
      EXPENSE_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
    const share = amount / salary;
    if (share > 0.15 && cat !== "logement") {
      items.push({
        id: "top-cat",
        tone: "action",
        title: `${label} pèse ${Math.round(share * 100)} % du revenu`,
        body: `C’est ta plus grosse ligne hors logement (${fmt(amount)}). Fixe un plafond de ${fmt(salary * 0.1)} le mois prochain et suis-le ici.`,
      });
    }
  }

  // Emergency fund
  const monthlyBurn = Math.max(avgExp, month.expenses, salary * 0.7);
  const targetEF = monthlyBurn * state.profile.emergencyFundMonths;
  items.push({
    id: "emergency",
    tone: "info",
    title: `Fonds d’urgence cible : ${fmt(targetEF)}`,
    body: `${state.profile.emergencyFundMonths} mois de dépenses estimées (~${fmt(monthlyBurn)}/mois). Place-le sur Livret A / LDDS avant d’investir agressivement.`,
  });

  // Daily remaining budget
  if (salary > 0) {
    const day = new Date().getDate();
    const daysInMonth = endOfMonth(new Date()).getDate();
    const daysLeft = Math.max(1, daysInMonth - day + 1);
    const remainingSpendBudget = Math.max(
      0,
      salary * 0.8 - month.expenses,
    ); // keep 20% for saving
    items.push({
      id: "daily",
      tone: month.expenses > salary * 0.8 ? "warn" : "good",
      title: `Budget quotidien restant : ~${fmt(remainingSpendBudget / daysLeft)}`,
      body: `Pour garder 20 % d’épargne, il te reste ${fmt(remainingSpendBudget)} à dépenser sur ${daysLeft} jour${daysLeft > 1 ? "s" : ""}.`,
    });
  }

  return items;
}

export function buildInvestmentPlan(
  state: AppState,
  monthlySave: number,
): InvestmentPlan {
  const { riskProfile, investmentHorizonYears } = state.profile;
  const save = Math.max(0, monthlySave);

  let liquidPct = 40;
  let mediumPct = 30;
  let longPct = 30;

  if (riskProfile === "prudent") {
    liquidPct = 55;
    mediumPct = 30;
    longPct = 15;
  } else if (riskProfile === "dynamique") {
    liquidPct = 25;
    mediumPct = 25;
    longPct = 50;
  }

  if (investmentHorizonYears < 5) {
    longPct = Math.min(longPct, 20);
    liquidPct = 100 - mediumPct - longPct;
  } else if (investmentHorizonYears >= 15 && riskProfile !== "prudent") {
    longPct = Math.min(70, longPct + 15);
    liquidPct = Math.max(15, 100 - mediumPct - longPct);
  }

  return {
    liquid: {
      name: "Liquidités (Livret A / LDDS)",
      percent: liquidPct,
      note: `~${fmt((save * liquidPct) / 100)} / mois — imprévus et fonds d’urgence.`,
    },
    medium: {
      name: "Épargne sécurisée (fonds euros / obligations)",
      percent: mediumPct,
      note: `~${fmt((save * mediumPct) / 100)} / mois — projets à 3–7 ans.`,
    },
    long: {
      name: "Long terme (PEA ETF monde)",
      percent: longPct,
      note: `~${fmt((save * longPct) / 100)} / mois — horizon ${investmentHorizonYears} ans, volatilité acceptée.`,
    },
    monthlyInvestHint: save,
    disclaimer:
      "Conseils génériques à titre éducatif, pas un conseil en investissement personnalisé au sens réglementaire.",
  };
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function monthLabel(d = new Date()): string {
  return format(d, "MMMM yyyy", { locale: fr });
}

export function uid(): string {
  return crypto.randomUUID();
}
