export type Person = {
  id: string;
  name: string;
  wallet?: string;
  avatar?: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  paid: string;
  split: string[];
};

export type SettlementStatus = 'submitted' | 'confirmed' | 'failed';

export type SettlementNetwork = 'base-mainnet' | 'base-sepolia';

export type SettlementRecord = {
  id: string;
  from: string;
  to: string;
  amount: number;
  txHash: `0x${string}`;
  status: SettlementStatus;
  submittedAt: string;
  confirmedAt?: string;
  error?: string;
};

export type Group = {
  id: string;
  name: string;
  settlementNetwork: SettlementNetwork;
  people: Person[];
  expenses: Expense[];
  settlements: SettlementRecord[];
};

export type SettlementRow = {
  from: Person;
  to: Person;
  amount: number;
};

export type AgentAction =
  | {
      type: 'add_expense';
      title: string;
      amount: number;
      paidBy: string;
      splitBetween: string[];
      replacesPending?: boolean;
      confirmed?: boolean;
    }
  | {
      type: 'add_expenses';
      expenses: Array<{ title: string; amount: number; paidBy: string; splitBetween: string[] }>;
      confirmed?: boolean;
    }
  | {
      type: 'update_expense';
      expenseIndex: number;
      title?: string;
      amount?: number;
      paidBy?: string;
      splitBetween?: string[];
      confirmed?: boolean;
    }
  | {
      type: 'delete_expense';
      expenseIndex: number;
      confirmed?: boolean;
    }
  | {
      type: 'add_person';
      name: string;
      wallet?: string;
      confirmed?: boolean;
    }
  | { type: 'show_settlement'; all: boolean }
  | { type: 'analyze_spending' }
  | { type: 'explain_balance' };

export type AgentMessage = {
  role: 'user' | 'agent';
  text: string;
  action?: AgentAction | null;
};
