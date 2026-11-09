export type TransactionType = 'Inflow' | 'Outflow' | 'in' | 'out';

export interface Transaction {
  id: string;
  timestamp: string; // Exact time formatted: YYYY-MM-DD HH:mm:ss
  date: string; // YYYY-MM-DD
  formattedDate?: string; // DD/MM/YYYY
  clientCode: string; // e.g. 'C01', 'C02'
  clientName: string; // e.g. 'أبو عمر', 'انجي'
  accountHead?: string;
  refNo: string; // e.g. 'D2401', 'C8217'
  type: 'Inflow' | 'Outflow';
  description: string;
  amount: number;
  debit: number | null;
  credit: number | null;
  balance: number;
  syncedToSheet?: boolean;
  createdAt: string;
}

export interface ClientItem {
  id: string;
  code: string; // C01, C02, etc.
  name: string; // Client name in Arabic / English
  remaining?: number;
  area?: string;
  phone?: string;
  email?: string;
  fullLabel: string;
}

export interface SheetConfig {
  appsScriptUrl: string;
  sheetName: string;
  currency: string;
  initialOpeningBalance: number;
  autoSync: boolean;
  lastSyncedAt: string | null;
  isConnected: boolean;
}

export type TabType = 'new-entry' | 'view-data' | 'make-order' | 'sales' | 'clients';

export type PaymentOption = 'Full Payment' | 'Installments' | 'Partial Payment';

export interface OrderEntry {
  id: string;
  timestamp: string; // Exact time formatted: YYYY-MM-dd HH:mm:ss
  date: string; // YYYY-MM-dd
  clientCode: string; // e.g. C26
  clientName: string; // e.g. ميديكال بلص
  invoiceNumber: string; // e.g. INV-1001
  description: string; // e.g. تم سداد ٣ مليون كاش
  amount: number; // Total order amount
  paymentOption: PaymentOption;
  downPayment: number; // Paid amount now (recorded to Cashflow)
  unpaidAmount: number; // Remaining unpaid amount (added to Client debt)
  cashflowLogged: boolean;
  cashflowRefNo?: string;
  paymentLink?: string;
  syncedToSheet?: boolean;
  createdAt: string;
}

export interface DayGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g., "Thursday, November 5, 2026"
  openingBalance: number;
  closingBalance: number;
  totalIn: number;
  totalOut: number;
  totalDebit?: number;
  totalCredit?: number;
  transactions: Transaction[];
}
