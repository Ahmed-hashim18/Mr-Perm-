import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Transaction,
  ClientItem,
  SheetConfig,
  DayGroup,
  TransactionType,
  OrderEntry,
  PaymentOption,
  TabType,
} from '../types/treasury';
import {
  INITIAL_CLIENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_OPENING_BALANCE,
  INITIAL_ORDERS,
} from '../data/initialData';
import {
  APPS_SCRIPT_STORAGE_KEY,
  TRANSACTIONS_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  ORDER_LOG_STORAGE_KEY,
  CONFIGURED_APPS_SCRIPT_URL,
  postTransactionToSheet,
  postOrderToSheet,
  postNewClientToSheet,
  updateClientInSheet,
  restoreAllClientBalancesInSheet,
  testAppsScriptConnection,
} from '../services/appsScriptService';

interface TreasuryContextType {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  transactions: Transaction[];
  clients: ClientItem[];
  orders: OrderEntry[];
  previousDescriptions: string[];
  currentBalance: number;
  initialOpeningBalance: number;
  sheetConfig: SheetConfig;
  isSyncing: boolean;
  syncStatusMessage: string | null;
  dayGroups: DayGroup[];
  selectedMonth: { year: number; month: number };
  setSelectedMonth: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>;
  prevMonth: () => void;
  nextMonth: () => void;
  addTransaction: (data: {
    date: string;
    clientCode: string;
    clientName: string;
    refNo: string;
    type: 'Inflow' | 'Outflow';
    description: string;
    amount: number;
  }) => Promise<{ success: boolean; message: string }>;
  addOrder: (data: {
    date: string;
    clientCode: string;
    clientName: string;
    invoiceNumber: string;
    description: string;
    amount: number;
    paymentOption: PaymentOption;
    downPayment: number;
  }) => Promise<{ success: boolean; message: string; cashflowLogged: boolean }>;
  addClient: (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }) => Promise<{ success: boolean; message: string }>;
  updateClient: (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }) => Promise<{ success: boolean; message: string }>;
  restoreAllBalances: () => Promise<{ success: boolean; message: string }>;
  deleteTransaction: (id: string) => void;
  updateSheetConfig: (config: Partial<SheetConfig>) => void;
  syncWithGoogleSheet: () => Promise<void>;
  getNextRefNo: (type: 'Inflow' | 'Outflow') => string;
  getNextInvoiceNo: () => string;
  getNextClientCode: () => string;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const TreasuryContext = createContext<TreasuryContextType | undefined>(undefined);

export function getExactTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const TreasuryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<TabType>('new-entry');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  const [orders, setOrders] = useState<OrderEntry[]>(() => {
    try {
      const saved = localStorage.getItem(ORDER_LOG_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ORDERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(ORDER_LOG_STORAGE_KEY, JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }
  }, [orders]);
  
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>({
    year: 2026,
    month: 10,
  });

  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() => {
    try {
      const saved = localStorage.getItem(APPS_SCRIPT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          appsScriptUrl: CONFIGURED_APPS_SCRIPT_URL,
          currency: 'SDG',
          isConnected: true,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      appsScriptUrl: CONFIGURED_APPS_SCRIPT_URL,
      sheetName: 'Cashflow',
      currency: 'SDG',
      initialOpeningBalance: INITIAL_OPENING_BALANCE,
      autoSync: true,
      lastSyncedAt: null,
      isConnected: true,
    };
  });

  // Clients initialized with exact sheet clients and remaining balances
  const [clients, setClients] = useState<ClientItem[]>(() => {
    const initialMap = new Map(INITIAL_CLIENTS.map(c => [c.code.toUpperCase(), c]));
    try {
      const saved = localStorage.getItem(CLIENTS_STORAGE_KEY);
      if (saved) {
        const parsed: ClientItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(c => {
            const init = initialMap.get(c.code.toUpperCase());
            const rem = (typeof c.remaining === 'number' && !isNaN(c.remaining) && c.remaining > 0)
              ? c.remaining
              : (init?.remaining || 0);
            return {
              ...c,
              remaining: rem,
            };
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_CLIENTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_TRANSACTIONS;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error(e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    } catch (e) {
      console.error(e);
    }
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem(APPS_SCRIPT_STORAGE_KEY, JSON.stringify(sheetConfig));
    } catch (e) {
      console.error(e);
    }
  }, [sheetConfig]);

  const currentBalance = React.useMemo(() => {
    if (transactions.length === 0) return sheetConfig.initialOpeningBalance;
    return transactions[transactions.length - 1].balance;
  }, [transactions, sheetConfig.initialOpeningBalance]);

  // Extract quick text from previous descriptions in the sheet (deduplicated, recent first)
  const previousDescriptions = React.useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    for (let i = transactions.length - 1; i >= 0; i--) {
      const desc = transactions[i].description?.trim();
      if (desc && !seen.has(desc)) {
        seen.add(desc);
        list.push(desc);
      }
    }
    return list;
  }, [transactions]);

  const getNextRefNo = (type: 'Inflow' | 'Outflow'): string => {
    const prefix = type === 'Inflow' ? 'D' : 'C';
    
    // Find all ref numbers from transactions that match prefix or type
    const matching = transactions
      .filter(t => {
        if (!t.refNo) return false;
        const upper = t.refNo.trim().toUpperCase();
        return upper.startsWith(prefix);
      })
      .map(t => {
        const match = t.refNo.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => n > 0);

    if (matching.length === 0) {
      // Fallback check by transaction type
      const typeMatching = transactions
        .filter(t => (type === 'Inflow' ? (t.type === 'Inflow' || (t.type as string) === 'in') : (t.type === 'Outflow' || (t.type as string) === 'out')))
        .map(t => {
          const match = t.refNo?.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter(n => n > 0);

      if (typeMatching.length > 0) {
        const maxTypeNum = Math.max(...typeMatching);
        return `${prefix}${maxTypeNum + 1}`;
      }

      return type === 'Inflow' ? 'D2402' : 'C8224';
    }

    const maxNum = Math.max(...matching);
    return `${prefix}${maxNum + 1}`;
  };

  const getNextInvoiceNo = (): string => {
    const nums = orders
      .map(o => {
        const match = o.invoiceNumber?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 1009;
    return `INV-${maxNum + 1}`;
  };

  const getNextClientCode = (): string => {
    const allCodes = [...clients, ...INITIAL_CLIENTS].map(c => c.code.trim().toUpperCase());
    const numbers = allCodes
      .map(code => {
        const match = code.match(/C0*(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const max = numbers.length > 0 ? Math.max(...numbers) : 33;
    const nextNum = max + 1;
    return nextNum < 10 ? `C0${nextNum}` : `C${nextNum}`;
  };

  const dayGroups = React.useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const groupsMap = new Map<string, Transaction[]>();
    for (const tx of sorted) {
      const d = tx.date;
      if (!groupsMap.has(d)) {
        groupsMap.set(d, []);
      }
      groupsMap.get(d)!.push(tx);
    }

    const result: DayGroup[] = [];
    let runningPriorBalance = sheetConfig.initialOpeningBalance;

    for (const [dateStr, txs] of groupsMap.entries()) {
      const dayOpening = runningPriorBalance;
      let dayIn = 0;
      let dayOut = 0;

      for (const t of txs) {
        const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
        if (isIn || t.debit) {
          dayIn += (t.debit ?? t.amount);
        } else {
          dayOut += (t.credit ?? t.amount);
        }
      }

      const dayClosing = txs[txs.length - 1]?.balance ?? (dayOpening + dayIn - dayOut);
      runningPriorBalance = dayClosing;

      const dateObj = new Date(dateStr + 'T00:00:00');
      const displayDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      result.push({
        date: dateStr,
        displayDate: displayDate || dateStr,
        openingBalance: dayOpening,
        closingBalance: dayClosing,
        totalIn: dayIn,
        totalOut: dayOut,
        totalDebit: dayIn,
        totalCredit: dayOut,
        transactions: txs,
      });
    }

    return result.filter(g => {
      const d = new Date(g.date + 'T00:00:00');
      return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
    });
  }, [transactions, sheetConfig.initialOpeningBalance, selectedMonth]);

  const prevMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const addTransaction = async (data: {
    date: string;
    clientCode: string;
    clientName: string;
    refNo: string;
    type: 'Inflow' | 'Outflow';
    description: string;
    amount: number;
  }): Promise<{ success: boolean; message: string }> => {
    const isIn = data.type === 'Inflow';
    const debitAmount = isIn ? data.amount : null;
    const creditAmount = !isIn ? data.amount : null;

    const newBal = isIn
      ? currentBalance + data.amount
      : currentBalance - data.amount;

    const timestamp = getExactTimestamp();

    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      timestamp,
      date: data.date,
      formattedDate: data.date.split('-').reverse().join('/'),
      clientCode: data.clientCode,
      clientName: data.clientName,
      accountHead: `${data.clientName} - ${data.clientCode}`,
      refNo: data.refNo,
      type: data.type,
      description: data.description,
      amount: data.amount,
      debit: debitAmount,
      credit: creditAmount,
      balance: newBal,
      syncedToSheet: false,
      createdAt: new Date().toISOString(),
    };

    setTransactions(prev => [...prev, newTx]);

    // Update client remaining balance in local state
    const matchedClient = clients.find(
      c =>
        c.code.toUpperCase() === data.clientCode.trim().toUpperCase() ||
        c.name.trim() === data.clientName.trim()
    );

    const calculatedNewRemaining: number = matchedClient
      ? Math.max(0, (typeof matchedClient.remaining === 'number' ? matchedClient.remaining : 0) - data.amount)
      : 0;

    setClients(prevClients =>
      prevClients.map(c => {
        if (
          c.code.toUpperCase() === data.clientCode.trim().toUpperCase() ||
          c.name.trim() === data.clientName.trim()
        ) {
          return {
            ...c,
            remaining: calculatedNewRemaining,
          };
        }
        return c;
      })
    );

    if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
      setIsSyncing(true);
      setSyncStatusMessage('Sending transaction to Google Sheet...');
      try {
        const postRes = await postTransactionToSheet(sheetConfig.appsScriptUrl, newTx, calculatedNewRemaining);
        if (postRes.success) {
          setTransactions(prev =>
            prev.map(t => (t.id === newTx.id ? { ...t, syncedToSheet: true } : t))
          );
          setSyncStatusMessage('Transaction recorded in Cashflow & client balance updated in sheet');
        } else {
          setSyncStatusMessage(postRes.message);
        }

        // Proactively call updateClientInSheet to guarantee client row is updated in sheet
        if (matchedClient) {
          updateClientInSheet(sheetConfig.appsScriptUrl, {
            code: matchedClient.code,
            name: matchedClient.name,
            remaining: calculatedNewRemaining,
          }).catch(console.error);
        }
      } catch (err: any) {
        console.error('Error posting to sheet:', err);
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatusMessage(null), 3000);
      }
    }

    return {
      success: true,
      message: `Transaction recorded. New Balance: ${newBal.toLocaleString()} ${sheetConfig.currency}`,
    };
  };

  const addOrder = async (data: {
    date: string;
    clientCode: string;
    clientName: string;
    invoiceNumber: string;
    description: string;
    amount: number;
    paymentOption: PaymentOption;
    downPayment: number;
  }): Promise<{ success: boolean; message: string; cashflowLogged: boolean }> => {
    const timestamp = getExactTimestamp();
    const cleanCode = data.clientCode.trim().toUpperCase();
    const cleanName = data.clientName.trim();

    // 1. Calculate down payment and unpaid portion
    let actualDownPayment = 0;
    let unpaidPart = 0;

    if (data.paymentOption === 'Full Payment') {
      actualDownPayment = data.amount;
      unpaidPart = 0;
    } else if (data.paymentOption === 'Installments') {
      actualDownPayment = 0;
      unpaidPart = data.amount;
    } else {
      // Partial Payment
      actualDownPayment = Math.min(data.amount, Math.max(0, data.downPayment));
      unpaidPart = Math.max(0, data.amount - actualDownPayment);
    }

    // 2. Client Credit Management Rule:
    let finalClientRemaining = 0;
    setClients(prevClients =>
      prevClients.map(c => {
        if (
          c.code.toUpperCase() === cleanCode ||
          c.name.trim().toLowerCase() === cleanName.toLowerCase()
        ) {
          const prevRem = typeof c.remaining === 'number' ? c.remaining : 0;
          finalClientRemaining = prevRem + unpaidPart;
          return {
            ...c,
            remaining: finalClientRemaining,
          };
        }
        return c;
      })
    );

    // 3. Payment Method & Cashflow Rules:
    // If Full Payment: log full amount as Inflow entry in Cashflow sheet
    // If Installments ($0 down payment): do not create any entry in Cashflow sheet
    // If Partial Payment: record only the paid down payment amount as an entry in Cashflow sheet
    let cashflowTx: Transaction | undefined = undefined;
    let cashflowLogged = false;

    if (actualDownPayment > 0) {
      cashflowLogged = true;
      const refNumber = getNextRefNo('Inflow');
      const newBal = currentBalance + actualDownPayment;

      const descSuffix = data.description ? ` (${data.description})` : '';
      const txDesc =
        data.paymentOption === 'Full Payment'
          ? `سداد طلب كامل فاتورة ${data.invoiceNumber || getNextInvoiceNo()} - ${cleanName}${descSuffix}`
          : `سداد دفعة مقدمة فاتورة ${data.invoiceNumber || getNextInvoiceNo()} - ${cleanName}${descSuffix}`;

      cashflowTx = {
        id: 'tx-cf-' + Date.now(),
        timestamp,
        date: data.date,
        formattedDate: data.date.split('-').reverse().join('/'),
        clientCode: cleanCode,
        clientName: cleanName,
        accountHead: `${cleanName} - ${cleanCode}`,
        refNo: refNumber,
        type: 'Inflow',
        description: txDesc,
        amount: actualDownPayment,
        debit: actualDownPayment,
        credit: null,
        balance: newBal,
        syncedToSheet: false,
        createdAt: new Date().toISOString(),
      };

      setTransactions(prev => [...prev, cashflowTx!]);
    }

    // 4. Record order into local orders state
    const finalInvoiceNumber = data.invoiceNumber.trim() || getNextInvoiceNo();
    const newOrder: OrderEntry = {
      id: 'ord-' + Date.now(),
      timestamp,
      date: data.date,
      clientCode: cleanCode,
      clientName: cleanName,
      invoiceNumber: finalInvoiceNumber,
      description: data.description.trim(),
      amount: data.amount,
      paymentOption: data.paymentOption,
      downPayment: actualDownPayment,
      unpaidAmount: unpaidPart,
      cashflowLogged,
      cashflowRefNo: cashflowTx?.refNo,
      syncedToSheet: false,
      createdAt: new Date().toISOString(),
    };

    setOrders(prev => [newOrder, ...prev]);

    // 5. Post to Apps Script if configured (updates Clients sheet & Cashflow, no Order Log sheet)
    if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
      setIsSyncing(true);
      setSyncStatusMessage('Updating client debt & syncing Cashflow...');
      try {
        const postRes = await postOrderToSheet(sheetConfig.appsScriptUrl, newOrder, cashflowTx);
        if (postRes.success) {
          setOrders(prev =>
            prev.map(o => (o.id === newOrder.id ? { ...o, syncedToSheet: true } : o))
          );
          if (cashflowTx) {
            setTransactions(prev =>
              prev.map(t => (t.id === cashflowTx!.id ? { ...t, syncedToSheet: true } : t))
            );
          }
          setSyncStatusMessage('Client debt updated in sheet');
        }

        // Proactively update Clients sheet with new remaining balance
        if (unpaidPart > 0) {
          updateClientInSheet(sheetConfig.appsScriptUrl, {
            code: cleanCode,
            name: cleanName,
            remaining: finalClientRemaining,
          }).catch(console.error);
        }
      } catch (err) {
        console.error('Error posting order:', err);
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatusMessage(null), 3000);
      }
    }

    let resultMsg = `Order ${newOrder.invoiceNumber} processed.`;
    if (cashflowLogged) {
      resultMsg += ` Recorded ${actualDownPayment.toLocaleString()} ${sheetConfig.currency} Inflow in Cashflow.`;
    }
    if (unpaidPart > 0) {
      resultMsg += ` +${unpaidPart.toLocaleString()} ${sheetConfig.currency} added to client remaining debt.`;
    }

    return {
      success: true,
      message: resultMsg,
      cashflowLogged,
    };
  };

  const addClient = async (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanCode = data.code.trim().toUpperCase() || getNextClientCode();
    const cleanName = data.name.trim();

    if (!cleanName) {
      return { success: false, message: 'Client name is required.' };
    }

    const exists = clients.some(c => c.code.toUpperCase() === cleanCode);
    if (exists) {
      return { success: false, message: `Client code "${cleanCode}" already exists.` };
    }

    const newClient: ClientItem = {
      id: 'cli-' + cleanCode.toLowerCase(),
      code: cleanCode,
      name: cleanName,
      phone: data.phone?.trim() || '',
      area: data.area?.trim() || '',
      email: data.email?.trim() || '',
      remaining: typeof data.remaining === 'number' ? data.remaining : 0,
      fullLabel: `${cleanCode} - ${cleanName}`,
    };

    setClients(prev => [...prev, newClient]);

    if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
      setIsSyncing(true);
      setSyncStatusMessage('Adding client to Google Sheet...');
      try {
        await postNewClientToSheet(sheetConfig.appsScriptUrl, newClient);
      } catch (err) {
        console.error('Error posting client:', err);
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatusMessage(null), 3000);
      }
    }

    return {
      success: true,
      message: `Client ${cleanCode} (${cleanName}) created successfully.`,
    };
  };

  const updateClient = async (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanCode = data.code.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (!cleanName) {
      return { success: false, message: 'Client name cannot be empty.' };
    }

    let updatedItem: ClientItem | null = null;

    setClients(prev =>
      prev.map(c => {
        if (c.code.toUpperCase() === cleanCode) {
          updatedItem = {
            ...c,
            name: cleanName,
            phone: data.phone !== undefined ? data.phone.trim() : c.phone,
            area: data.area !== undefined ? data.area.trim() : c.area,
            email: data.email !== undefined ? data.email.trim() : c.email,
            remaining: typeof data.remaining === 'number' ? data.remaining : c.remaining,
            fullLabel: `${cleanCode} - ${cleanName}`,
          };
          return updatedItem;
        }
        return c;
      })
    );

    if (updatedItem && sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
      setIsSyncing(true);
      setSyncStatusMessage('Updating client in Google Sheet...');
      try {
        await updateClientInSheet(sheetConfig.appsScriptUrl, updatedItem);
      } catch (err) {
        console.error('Error updating client:', err);
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatusMessage(null), 3000);
      }
    }

    return {
      success: true,
      message: `Client ${cleanCode} updated successfully.`,
    };
  };

  const restoreAllBalances = async (): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    setSyncStatusMessage('Restoring all client balances in Google Sheet...');

    // 1. Reset local clients state
    setClients(INITIAL_CLIENTS);

    // 2. Call restore endpoint on Google Apps Script
    let sheetSuccess = false;
    let msg = 'Client balances restored in application.';

    if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
      try {
        const res = await restoreAllClientBalancesInSheet(sheetConfig.appsScriptUrl);
        sheetSuccess = res.success;
        msg = res.message || 'Client balances restored in Google Sheet!';
      } catch (err: any) {
        console.error('Error restoring balances:', err);
      }
    }

    setIsSyncing(false);
    setTimeout(() => setSyncStatusMessage(null), 4000);

    return {
      success: true,
      message: msg,
    };
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => {
      const remaining = prev.filter(t => t.id !== id);
      let bal = sheetConfig.initialOpeningBalance;
      return remaining.map(t => {
        const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
        if (isIn || t.debit) {
          bal += (t.debit || t.amount);
        } else {
          bal -= (t.credit || t.amount);
        }
        return {
          ...t,
          balance: bal,
        };
      });
    });
  };

  const updateSheetConfig = (config: Partial<SheetConfig>) => {
    setSheetConfig(prev => ({ ...prev, ...config }));
  };

  const syncWithGoogleSheet = async () => {
    const url = sheetConfig.appsScriptUrl || CONFIGURED_APPS_SCRIPT_URL;
    if (!url) {
      return;
    }
    setIsSyncing(true);
    setSyncStatusMessage('Syncing with Google Sheet...');
    const result = await testAppsScriptConnection(url);
    if (result.success && result.data) {
      if (Array.isArray(result.data.transactions) && result.data.transactions.length > 0) {
        setTransactions(result.data.transactions);
      }
      if (Array.isArray(result.data.clients) && result.data.clients.length > 0) {
        const initialMap = new Map(INITIAL_CLIENTS.map(c => [c.code.toUpperCase(), c]));
        const merged = result.data.clients.map((c: any) => {
          const init = initialMap.get(c.code.toUpperCase());
          let rem = c.remaining;
          if (typeof rem === 'string') {
            rem = parseFloat(rem.replace(/,/g, ''));
          }
          if (typeof rem !== 'number' || isNaN(rem) || rem === 0) {
            rem = init?.remaining || 0;
          }
          return {
            ...c,
            remaining: rem,
          };
        });
        setClients(merged);
      }
      setSheetConfig(prev => ({
        ...prev,
        isConnected: true,
        lastSyncedAt: new Date().toLocaleTimeString(),
      }));
      setSyncStatusMessage('Synchronized with Google Sheet');
    }
    setIsSyncing(false);
    setTimeout(() => setSyncStatusMessage(null), 3000);
  };

  // Sync with live Google Sheet on initial mount
  useEffect(() => {
    syncWithGoogleSheet();
  }, []);

  return (
    <TreasuryContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        transactions,
        clients,
        orders,
        previousDescriptions,
        currentBalance,
        initialOpeningBalance: sheetConfig.initialOpeningBalance,
        sheetConfig,
        isSyncing,
        syncStatusMessage,
        dayGroups,
        selectedMonth,
        setSelectedMonth,
        prevMonth,
        nextMonth,
        addTransaction,
        addOrder,
        addClient,
        updateClient,
        restoreAllBalances,
        deleteTransaction,
        updateSheetConfig,
        syncWithGoogleSheet,
        getNextRefNo,
        getNextInvoiceNo,
        getNextClientCode,
        isSettingsOpen,
        setIsSettingsOpen,
      }}
    >
      {children}
    </TreasuryContext.Provider>
  );
};

export const useTreasury = () => {
  const context = useContext(TreasuryContext);
  if (!context) {
    throw new Error('useTreasury must be used within a TreasuryProvider');
  }
  return context;
};
