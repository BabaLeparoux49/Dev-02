import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  averageMonthlyExpenses,
  buildAdvice,
  buildInvestmentPlan,
  fmt,
  monthLabel,
  summarizeMonth,
  uid,
} from "./advice";
import { loadState, saveState } from "./storage";
import { EXPENSE_CATEGORIES } from "./types";
import type {
  AppState,
  ExpenseCategory,
  IncomeCategory,
  Profile,
  Transaction,
} from "./types";
import "./index.css";

type Tab = "accueil" | "depenses" | "conseils" | "investir" | "reglages";

function usePersistedState() {
  const [state, setState] = useState<AppState>(() => loadState());

  const update = (next: AppState | ((prev: AppState) => AppState)) => {
    setState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      saveState(value);
      return value;
    });
  };

  return [state, update] as const;
}

export default function App() {
  const [state, setState] = usePersistedState();
  const [tab, setTab] = useState<Tab>("accueil");

  const month = useMemo(() => summarizeMonth(state), [state]);
  const advice = useMemo(() => buildAdvice(state), [state]);
  const monthlySave = Math.max(0, month.balance);
  const invest = useMemo(
    () => buildInvestmentPlan(state, monthlySave || state.profile.monthlySalary * 0.2),
    [state, monthlySave],
  );

  const addTransaction = (tx: Omit<Transaction, "id" | "createdAt">) => {
    setState((prev) => ({
      ...prev,
      transactions: [
        {
          ...tx,
          id: uid(),
          createdAt: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const removeTransaction = (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const saveProfile = (profile: Profile) => {
    setState((prev) => ({ ...prev, profile }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Libre</strong>
          <span>Tes dépenses, ton épargne, tes choix.</span>
        </div>
        <nav className="nav" aria-label="Navigation">
          {(
            [
              ["accueil", "Accueil"],
              ["depenses", "Dépenses"],
              ["conseils", "Conseils"],
              ["investir", "Investir"],
              ["reglages", "Réglages"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "accueil" && (
        <Home
          state={state}
          month={month}
          advice={advice}
          onAddExpense={() => setTab("depenses")}
          onAdvice={() => setTab("conseils")}
        />
      )}
      {tab === "depenses" && (
        <Expenses
          state={state}
          onAdd={addTransaction}
          onRemove={removeTransaction}
        />
      )}
      {tab === "conseils" && <AdviceView advice={advice} month={month} />}
      {tab === "investir" && (
        <InvestView invest={invest} profile={state.profile} month={month} />
      )}
      {tab === "reglages" && (
        <SettingsView profile={state.profile} onSave={saveProfile} />
      )}
    </div>
  );
}

function Home({
  state,
  month,
  advice,
  onAddExpense,
  onAdvice,
}: {
  state: AppState;
  month: ReturnType<typeof summarizeMonth>;
  advice: ReturnType<typeof buildAdvice>;
  onAddExpense: () => void;
  onAdvice: () => void;
}) {
  const headline =
    month.balance >= 0
      ? `Ce mois, tu peux mettre de côté ${fmt(month.balance)}.`
      : `Ce mois, tu es à ${fmt(month.balance)} — recentre les envies.`;

  const topAdvice = advice[0];

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <div>
            <div className="hero-kicker">Libre · {monthLabel()}</div>
            <h1>{headline}</h1>
            <p>
              {topAdvice?.body ??
                "Saisis tes dépenses au fil de l’eau. Libre calcule ce que tu peux épargner et où placer le surplus."}
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={onAddExpense}>
              Ajouter une dépense
            </button>
            <button type="button" className="btn btn-ghost" onClick={onAdvice}>
              Voir les conseils
            </button>
          </div>
        </div>
        <div className="hero-side">
          <div className="metric">
            <div className="label">Revenus du mois</div>
            <div className="value">{fmt(month.income)}</div>
            <div className="hint">
              {state.profile.monthlySalary > 0
                ? `Salaire déclaré ${fmt(state.profile.monthlySalary)}`
                : "Déclare ton salaire dans Réglages"}
            </div>
          </div>
          <div className="metric">
            <div className="label">Dépenses</div>
            <div className="value">{fmt(month.expenses)}</div>
            <div className="hint">
              Taux d’épargne {Math.round(month.savingsRate * 100)} %
            </div>
          </div>
          <div className="metric">
            <div className="label">Fonds d’urgence cible</div>
            <div className="value">
              {fmt(
                averageMonthlyExpenses(state) *
                  state.profile.emergencyFundMonths ||
                  state.profile.monthlySalary *
                    0.7 *
                    state.profile.emergencyFundMonths,
              )}
            </div>
            <div className="hint">
              {state.profile.emergencyFundMonths} mois de dépenses
            </div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Où part l’argent</h2>
          <p className="lede">Répartition des dépenses du mois en cours.</p>
          <CategoryBars byCategory={month.byCategory} total={month.expenses} />
        </section>
        <section className="panel">
          <h2>Conseil du moment</h2>
          <p className="lede">Une action simple, calculée sur tes saisies.</p>
          {topAdvice ? (
            <div className={`advice ${topAdvice.tone}`}>
              <h3>{topAdvice.title}</h3>
              <p>{topAdvice.body}</p>
            </div>
          ) : (
            <div className="empty">Ajoute des mouvements pour démarrer.</div>
          )}
        </section>
      </div>
    </>
  );
}

function CategoryBars({
  byCategory,
  total,
}: {
  byCategory: Record<string, number>;
  total: number;
}) {
  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    return <div className="empty">Aucune dépense ce mois-ci.</div>;
  }
  return (
    <div className="bars">
      {rows.map(([cat, amount]) => {
        const label =
          EXPENSE_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
        const pct = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div className="bar-row" key={cat}>
            <div className="top">
              <span>{label}</span>
              <span>
                {fmt(amount)} · {Math.round(pct)} %
              </span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Expenses({
  state,
  onAdd,
  onRemove,
}: {
  state: AppState;
  onAdd: (tx: Omit<Transaction, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
}) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | IncomeCategory>(
    "alimentation",
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    onAdd({
      type,
      amount: value,
      category,
      label: label.trim() || (type === "expense" ? "Dépense" : "Revenu"),
      date,
    });
    setAmount("");
    setLabel("");
  };

  const recent = [...state.transactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Nouvelle entrée</h2>
        <p className="lede">Note chaque dépense (et revenus ponctuels) pour affûter les conseils.</p>
        <form className="form-grid" onSubmit={submit}>
          <div className="form-row">
            <label className="field">
              Type
              <select
                value={type}
                onChange={(e) => {
                  const next = e.target.value as "expense" | "income";
                  setType(next);
                  setCategory(next === "expense" ? "alimentation" : "salaire");
                }}
              >
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </select>
            </label>
            <label className="field">
              Montant (€)
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="42,50"
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              Catégorie
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ExpenseCategory | IncomeCategory)
                }
              >
                {type === "expense"
                  ? EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))
                  : (
                      <>
                        <option value="salaire">Salaire</option>
                        <option value="autre">Autre revenu</option>
                      </>
                    )}
              </select>
            </label>
            <label className="field">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="field">
            Libellé
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Courses, loyer, essence…"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Historique</h2>
        <p className="lede">Tes dernières écritures, stockées sur cet appareil.</p>
        {recent.length === 0 ? (
          <div className="empty">Rien pour l’instant — ajoute ta première dépense.</div>
        ) : (
          <ul className="tx-list">
            {recent.map((tx) => {
              const catLabel =
                tx.type === "expense"
                  ? EXPENSE_CATEGORIES.find((c) => c.id === tx.category)?.label
                  : tx.category === "salaire"
                    ? "Salaire"
                    : "Autre revenu";
              return (
                <li className="tx-item" key={tx.id}>
                  <div className="meta">
                    <strong>{tx.label}</strong>
                    <span>
                      {catLabel} · {tx.date}
                    </span>
                  </div>
                  <div className={`amount ${tx.type}`}>
                    {tx.type === "expense" ? "−" : "+"}
                    {fmt(tx.amount)}
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => onRemove(tx.id)}
                  >
                    Suppr.
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdviceView({
  advice,
  month,
}: {
  advice: ReturnType<typeof buildAdvice>;
  month: ReturnType<typeof summarizeMonth>;
}) {
  return (
    <section className="panel">
      <h2>Conseils du mois</h2>
      <p className="lede">
        Basés sur {fmt(month.income)} de revenus et {fmt(month.expenses)} de
        dépenses · {monthLabel()}.
      </p>
      <div className="advice-list">
        {advice.map((item, i) => (
          <article
            key={item.id}
            className={`advice ${item.tone}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function InvestView({
  invest,
  profile,
  month,
}: {
  invest: ReturnType<typeof buildInvestmentPlan>;
  profile: Profile;
  month: ReturnType<typeof summarizeMonth>;
}) {
  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Répartition suggérée</h2>
        <p className="lede">
          Sur un effort d’épargne d’environ {fmt(invest.monthlyInvestHint)} / mois
          (profil {profile.riskProfile}, horizon {profile.investmentHorizonYears}{" "}
          ans).
        </p>
        <div className="invest-stack">
          {[invest.liquid, invest.medium, invest.long].map((row) => (
            <div className="invest-row" key={row.name}>
              <div className="pct">{row.percent}%</div>
              <div>
                <h3>{row.name}</h3>
                <p>{row.note}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="disclaimer">{invest.disclaimer}</p>
      </section>
      <section className="panel">
        <h2>Ordre de priorité</h2>
        <p className="lede">Avant de « jouer en bourse », sécurise la base.</p>
        <div className="advice-list">
          <article className="advice action">
            <h3>1. Fonds d’urgence</h3>
            <p>
              Vise {profile.emergencyFundMonths} mois de dépenses sur Livret A /
              LDDS. Tant que ce matelas n’est pas là, limite l’exposition actions.
            </p>
          </article>
          <article className="advice action">
            <h3>2. Dettes chères</h3>
            <p>
              Crédit conso / revolving : rembourse avant d’investir. Le rendement
              « garanti » vaut le taux de la dette.
            </p>
          </article>
          <article className="advice action">
            <h3>3. Investissement long terme</h3>
            <p>
              PEA + ETF monde diversifié, versements automatiques le jour de
              paie. Capacité estimée ce mois : {fmt(Math.max(0, month.balance))}.
            </p>
          </article>
          <article className="advice info">
            <h3>Ce que Libre ne fait pas</h3>
            <p>
              Pas de recommandation de titres individuels, pas de garantie de
              performance. Ajuste le profil dans Réglages.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="panel">
      <h2>Réglages</h2>
      <p className="lede">
        Salaire et profil d’investisseur — tout reste sur cet appareil
        (localStorage).
      </p>
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            Prénom (optionnel)
            <input
              value={draft.displayName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, displayName: e.target.value }))
              }
              placeholder="Bastien"
            />
          </label>
          <label className="field">
            Salaire net mensuel (€)
            <input
              inputMode="decimal"
              value={draft.monthlySalary || ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  monthlySalary: Number(e.target.value.replace(",", ".")) || 0,
                }))
              }
              placeholder="2200"
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            Mois de fonds d’urgence
            <select
              value={draft.emergencyFundMonths}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  emergencyFundMonths: Number(e.target.value),
                }))
              }
            >
              <option value={3}>3 mois</option>
              <option value={4}>4 mois</option>
              <option value={6}>6 mois</option>
            </select>
          </label>
          <label className="field">
            Profil de risque
            <select
              value={draft.riskProfile}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  riskProfile: e.target.value as Profile["riskProfile"],
                }))
              }
            >
              <option value="prudent">Prudent</option>
              <option value="equilibre">Équilibré</option>
              <option value="dynamique">Dynamique</option>
            </select>
          </label>
        </div>
        <label className="field">
          Horizon d’investissement (années)
          <input
            type="number"
            min={1}
            max={40}
            value={draft.investmentHorizonYears}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                investmentHorizonYears: Number(e.target.value) || 1,
              }))
            }
          />
        </label>
        <button type="submit" className="btn btn-primary">
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
      </form>
    </section>
  );
}
