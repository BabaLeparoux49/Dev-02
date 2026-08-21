export type ExpenseCategory =
  | "logement"
  | "alimentation"
  | "transport"
  | "sante"
  | "loisirs"
  | "abonnements"
  | "shopping"
  | "restaurants"
  | "autre";

export type IncomeCategory = "salaire" | "autre";

export interface Transaction {
  id: string;
  type: "expense" | "income";
  amount: number;
  category: ExpenseCategory | IncomeCategory;
  label: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Profile {
  monthlySalary: number;
  emergencyFundMonths: number; // target months of expenses
  riskProfile: "prudent" | "equilibre" | "dynamique";
  investmentHorizonYears: number;
  displayName: string;
}

export interface AppState {
  profile: Profile;
  transactions: Transaction[];
}

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: "logement", label: "Logement" },
  { id: "alimentation", label: "Alimentation" },
  { id: "transport", label: "Transport" },
  { id: "sante", label: "Santé" },
  { id: "loisirs", label: "Loisirs" },
  { id: "abonnements", label: "Abonnements" },
  { id: "shopping", label: "Shopping" },
  { id: "restaurants", label: "Restaurants" },
  { id: "autre", label: "Autre" },
];

export const DEFAULT_PROFILE: Profile = {
  monthlySalary: 0,
  emergencyFundMonths: 3,
  riskProfile: "equilibre",
  investmentHorizonYears: 10,
  displayName: "",
};

export const DEFAULT_STATE: AppState = {
  profile: DEFAULT_PROFILE,
  transactions: [],
};
