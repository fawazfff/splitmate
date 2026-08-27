import type { Group, Person, SettlementNetwork, SettlementRow } from './types';

export const USDC_DECIMALS = 6;

export const SETTLEMENT_NETWORKS = {
  'base-mainnet': {
    id: 'base-mainnet',
    chainId: 8453,
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    explorerUrl: 'https://basescan.org',
    label: 'Base Mainnet',
    paymentLabel: 'real USDC',
    isTestnet: false,
  },
  'base-sepolia': {
    id: 'base-sepolia',
    chainId: 84532,
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    explorerUrl: 'https://sepolia.basescan.org',
    label: 'Base Sepolia',
    paymentLabel: 'test USDC',
    isTestnet: true,
  },
} as const;

export function getSettlementNetwork(network?: SettlementNetwork) {
  return SETTLEMENT_NETWORKS[network === 'base-sepolia' ? 'base-sepolia' : 'base-mainnet'];
}

// Kept for existing receipt/proof links. New payments always use the group's selected network.
export const BASE_CHAIN_ID = SETTLEMENT_NETWORKS['base-mainnet'].chainId;
export const USDC_ADDRESS = SETTLEMENT_NETWORKS['base-mainnet'].usdcAddress;
export const BASESCAN_URL = SETTLEMENT_NETWORKS['base-mainnet'].explorerUrl;

export const USDC_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const money = (amount: number) => `$${Number(amount || 0).toFixed(2)}`;

export function calculateBalances(group: Group) {
  const balances: Record<string, number> = Object.fromEntries(
    group.people.map((person) => [person.id, 0]),
  );

  for (const expense of group.expenses) {
    if (balances[expense.paid] === undefined || expense.split.length === 0) continue;
    balances[expense.paid] += Number(expense.amount);
    const share = Number(expense.amount) / expense.split.length;
    for (const personId of expense.split) {
      if (balances[personId] !== undefined) balances[personId] -= share;
    }
  }

  for (const settlement of group.settlements || []) {
    if (settlement.status !== 'confirmed') continue;
    if (balances[settlement.from] !== undefined) balances[settlement.from] += settlement.amount;
    if (balances[settlement.to] !== undefined) balances[settlement.to] -= settlement.amount;
  }

  return balances;
}

export function calculateSettlementRows(group: Group): SettlementRow[] {
  const balances = calculateBalances(group);
  const debtors = group.people
    .filter((person) => balances[person.id] < -0.005)
    .map((person) => ({ person, amount: -balances[person.id] }));
  const creditors = group.people
    .filter((person) => balances[person.id] > 0.005)
    .map((person) => ({ person, amount: balances[person.id] }));
  const rows: SettlementRow[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(
      debtors[debtorIndex].amount,
      creditors[creditorIndex].amount,
    );
    rows.push({
      from: debtors[debtorIndex].person,
      to: creditors[creditorIndex].person,
      amount: Number(amount.toFixed(6)),
    });
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount < 0.005) debtorIndex += 1;
    if (creditors[creditorIndex].amount < 0.005) creditorIndex += 1;
  }

  return rows;
}

export function findPerson(group: Group, id: string): Person | undefined {
  return group.people.find((person) => person.id === id);
}

export function getDemoGroup(): Group {
  return {
    id: 'demo',
    name: 'ORION Demo',
    settlementNetwork: 'base-sepolia',
    people: [
      { id: 'demo-fawaz', name: 'Fawaz' },
      { id: 'demo-ahmed', name: 'Ahmed' },
      { id: 'demo-musa', name: 'Musa' },
      { id: 'demo-fatima', name: 'Fatima' },
    ],
    expenses: [
      {
        id: 'demo-dinner',
        title: 'Dinner',
        amount: 80,
        paid: 'demo-fawaz',
        split: ['demo-fawaz', 'demo-ahmed', 'demo-musa', 'demo-fatima'],
      },
    ],
    settlements: [],
  };
}
