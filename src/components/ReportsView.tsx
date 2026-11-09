import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Users,
  Search,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  ArrowUpDown,
  CreditCard,
  Building2,
  Hash,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { exportElementToPDF, printElementDirectly } from '../utils/pdfExport';
import { ClientItem, Transaction, OrderEntry } from '../types/treasury';

type ReportTab = 'debt-report' | 'client-ledger' | 'snapshot';

export const ReportsView: React.FC = () => {
  const { clients, transactions, orders, sheetConfig } = useTreasury();

  const [activeReport, setActiveReport] = useState<ReportTab>('debt-report');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // -------------------------------------------------------------
  // REPORT 1: CLIENT REPORT / DEBT REPORT (Sheet: "Debt Report")
  // -------------------------------------------------------------
  const [debtReportDate, setDebtReportDate] = useState<string>('2026-11-08');
  const [debtSearch, setDebtSearch] = useState<string>('');
  const debtReportPrintRef = useRef<HTMLDivElement>(null);

  // Clients with debt > 0, matching the order and amounts in screenshot 1
  const debtClients = useMemo(() => {
    return clients
      .filter(c => (c.remaining || 0) > 0)
      .filter(c => {
        if (!debtSearch) return true;
        const q = debtSearch.toLowerCase().trim();
        return (
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
        );
      });
  }, [clients, debtSearch]);

  const totalDebtAmount = useMemo(() => {
    return debtClients.reduce((sum, c) => sum + (c.remaining || 0), 0);
  }, [debtClients]);

  // Format date as DD-MM-YYYY
  const formattedDebtDate = useMemo(() => {
    if (!debtReportDate) return '';
    const parts = debtReportDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return debtReportDate;
  }, [debtReportDate]);

  // -------------------------------------------------------------
  // REPORT 2: CLIENT LEDGER (Sheet: "Client Ledger")
  // -------------------------------------------------------------
  const [selectedClientCode, setSelectedClientCode] = useState<string>('C04');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const clientLedgerPrintRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(() => {
    return (
      clients.find(c => c.code.toUpperCase() === selectedClientCode.toUpperCase()) ||
      clients[0]
    );
  }, [clients, selectedClientCode]);

  // Generate ledger rows for the selected client combining Cashflow & Orders
  const clientLedgerData = useMemo(() => {
    if (!selectedClient) {
      return { rows: [], totalCashflow: 0, totalOrders: 0, finalBalance: 0 };
    }

    const cCode = selectedClient.code.toUpperCase();
    const cName = selectedClient.name.trim();

    // 1. Transactions from Cashflow for this client
    const matchingTxs = transactions.filter(t => {
      const matchCode = t.clientCode && t.clientCode.toUpperCase() === cCode;
      const matchName = t.clientName && t.clientName.trim() === cName;
      return matchCode || matchName;
    });

    // 2. Orders for this client
    const matchingOrders = orders.filter(o => {
      const matchCode = o.clientCode && o.clientCode.toUpperCase() === cCode;
      const matchName = o.clientName && o.clientName.trim() === cName;
      return matchCode || matchName;
    });

    // Merge into ledger entries
    interface LedgerRow {
      id: string;
      date: string;
      description: string;
      cashflowAmount: number | null;
      orderAmount: number | null;
      rawDate: string;
    }

    const rows: LedgerRow[] = [];

    // Add orders (Order Log column)
    for (const o of matchingOrders) {
      rows.push({
        id: 'ord-' + o.id,
        date: o.date,
        description: o.description || o.invoiceNumber || 'طلب بضاعة',
        cashflowAmount: null,
        orderAmount: o.amount,
        rawDate: o.date,
      });
    }

    // Add cashflow transactions (Cashflow column)
    for (const t of matchingTxs) {
      // Don't double count if order already logged cashflow with same ref
      rows.push({
        id: 'tx-' + t.id,
        date: t.date,
        description: t.description || (t.refNo ? `Ref #${t.refNo}` : 'حركة نقدية'),
        cashflowAmount: t.amount,
        orderAmount: null,
        rawDate: t.date,
      });
    }

    // Sort chronologically
    rows.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

    // Calculate running balance
    // For clients: Debt increases with Orders (+), decreases with Cashflow payments (-)
    // For Owner (C01): Cash advances increase Cashflow, shown negative/balance
    const isOwner = cCode === 'C01';
    let running = 0;
    let sumCashflow = 0;
    let sumOrders = 0;

    const rowsWithBalance = rows.map(r => {
      if (r.orderAmount) {
        sumOrders += r.orderAmount;
        running += r.orderAmount;
      }
      if (r.cashflowAmount) {
        sumCashflow += r.cashflowAmount;
        if (isOwner) {
          running -= r.cashflowAmount;
        } else {
          running -= r.cashflowAmount;
        }
      }
      return {
        ...r,
        amount: running,
      };
    });

    return {
      rows: rowsWithBalance,
      totalCashflow: sumCashflow,
      totalOrders: sumOrders,
      finalBalance: isOwner ? -sumCashflow : (rowsWithBalance.length > 0 ? rowsWithBalance[rowsWithBalance.length - 1].amount : (selectedClient.remaining || 0)),
    };
  }, [selectedClient, transactions, orders]);

  // -------------------------------------------------------------
  // REPORT 3: SNAPSHOT REPORT (Sheet: "Snapshot")
  // -------------------------------------------------------------
  const [snapshotStartDate, setSnapshotStartDate] = useState<string>('2026-09-01');
  const [snapshotEndDate, setSnapshotEndDate] = useState<string>('2026-11-09');
  const [snapshotSearch, setSnapshotSearch] = useState<string>('');
  const snapshotPrintRef = useRef<HTMLDivElement>(null);

  const snapshotRows = useMemo(() => {
    const start = snapshotStartDate ? new Date(snapshotStartDate).getTime() : 0;
    const end = snapshotEndDate ? new Date(snapshotEndDate + 'T23:59:59').getTime() : Infinity;

    return transactions
      .filter(t => {
        const tTime = new Date(t.date).getTime();
        return tTime >= start && tTime <= end;
      })
      .filter(t => {
        if (!snapshotSearch) return true;
        const q = snapshotSearch.toLowerCase().trim();
        return (
          (t.clientCode && t.clientCode.toLowerCase().includes(q)) ||
          (t.clientName && t.clientName.toLowerCase().includes(q)) ||
          (t.refNo && t.refNo.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, snapshotStartDate, snapshotEndDate, snapshotSearch]);

  const { totalCashIn, totalCashOut } = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const r of snapshotRows) {
      const isIn = r.type === 'Inflow' || (r.type as string) === 'in';
      if (isIn) {
        inSum += r.amount;
      } else {
        outSum += r.amount;
      }
    }
    return { totalCashIn: inSum, totalCashOut: outSum };
  }, [snapshotRows]);

  // -------------------------------------------------------------
  // PDF EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleExportPDF = async (reportType: ReportTab) => {
    setIsExporting(true);
    try {
      if (reportType === 'debt-report' && debtReportPrintRef.current) {
        await exportElementToPDF(debtReportPrintRef.current, {
          filename: `Debt_Report_${formattedDebtDate || 'Latest'}`,
          title: `تقرير مديونية العملاء - Debt Report - ${formattedDebtDate}`,
          orientation: 'portrait',
        });
        setExportFeedback('Debt Report PDF downloaded successfully!');
      } else if (reportType === 'client-ledger' && clientLedgerPrintRef.current) {
        const clientLabel = selectedClient ? `${selectedClient.code}_${selectedClient.name}` : 'Client';
        await exportElementToPDF(clientLedgerPrintRef.current, {
          filename: `Client_Ledger_${clientLabel}`,
          title: `كشف حساب عميل - Client Ledger - ${clientLabel}`,
          orientation: 'portrait',
        });
        setExportFeedback(`Ledger for ${selectedClient?.name || 'Client'} downloaded as PDF!`);
      } else if (reportType === 'snapshot' && snapshotPrintRef.current) {
        await exportElementToPDF(snapshotPrintRef.current, {
          filename: `Snapshot_${snapshotStartDate}_to_${snapshotEndDate}`,
          title: `Snapshot Report - ${snapshotStartDate} to ${snapshotEndDate}`,
          orientation: 'landscape',
        });
        setExportFeedback('Snapshot Report PDF downloaded successfully!');
      }
    } catch (err) {
      console.error(err);
      alert('Could not generate PDF. Please try Print as PDF instead.');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportFeedback(null), 4000);
    }
  };

  const handlePrint = (reportType: ReportTab) => {
    if (reportType === 'debt-report' && debtReportPrintRef.current) {
      printElementDirectly(debtReportPrintRef.current, `Debt_Report_${formattedDebtDate}`);
    } else if (reportType === 'client-ledger' && clientLedgerPrintRef.current) {
      printElementDirectly(clientLedgerPrintRef.current, `Client_Ledger_${selectedClient?.code || ''}`);
    } else if (reportType === 'snapshot' && snapshotPrintRef.current) {
      printElementDirectly(snapshotPrintRef.current, `Snapshot_${snapshotStartDate}_to_${snapshotEndDate}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Feedback */}
      {exportFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{exportFeedback}</p>
              <p className="text-xs text-emerald-600">Saved as PDF file</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Report Type Selector Tabs */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl gap-1">
          {/* Tab 1: Client Report (Debt Report) */}
          <button
            type="button"
            onClick={() => setActiveReport('debt-report')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeReport === 'debt-report'
                ? 'bg-[#284742] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. Client Report (Debt Report)</span>
          </button>

          {/* Tab 2: Client Ledger */}
          <button
            type="button"
            onClick={() => setActiveReport('client-ledger')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeReport === 'client-ledger'
                ? 'bg-[#284742] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Client Ledger</span>
          </button>

          {/* Tab 3: Snapshot */}
          <button
            type="button"
            onClick={() => setActiveReport('snapshot')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeReport === 'snapshot'
                ? 'bg-[#284742] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>3. Snapshot Report</span>
          </button>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePrint(activeReport)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Print or Save via Browser"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExportPDF(activeReport)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. CLIENT REPORT (DEBT REPORT)                                  */}
      {/* ============================================================== */}
      {activeReport === 'debt-report' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>تقرير مديونية العملاء</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg">
                  Sheet: Debt Report
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Displays clients with outstanding debt &bull; Select report date &bull; Exact spreadsheet layout
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Date Input */}
              <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-blue-900 font-sans">التاريخ:</span>
                <input
                  type="date"
                  value={debtReportDate}
                  onChange={e => setDebtReportDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-blue-950 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={debtSearch}
                  onChange={e => setDebtSearch(e.target.value)}
                  placeholder="Filter client..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Printable Report Container (matches user screenshot 1) */}
          <div
            ref={debtReportPrintRef}
            className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs"
            dir="rtl"
          >
            {/* Report Header Block (Blue bar matching sheet cell A1 & B1) */}
            <div className="mb-4 flex items-center gap-2">
              <div className="bg-[#4a86e8] text-white font-bold text-sm px-6 py-2 rounded-lg shadow-2xs">
                التاريخ
              </div>
              <div className="bg-slate-100 border border-slate-300 font-bold text-sm px-6 py-2 rounded-lg font-mono">
                {formattedDebtDate}
              </div>
              <div className="mr-auto font-sans text-xs text-slate-500 font-bold">
                شركة الناقل - تقرير المديونية
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#4a86e8] text-white font-bold border-b border-[#3b72cc]">
                    <th className="py-2.5 px-4 text-center border-l border-white/20 w-16">الرقم</th>
                    <th className="py-2.5 px-4 text-center border-l border-white/20 w-28">كود الشركة</th>
                    <th className="py-2.5 px-4 text-right border-l border-white/20">اسم الشركة</th>
                    <th className="py-2.5 px-4 text-left w-48">المديونية (SDG)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-sans">
                  {debtClients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        لا توجد مديونيات مسجلة مطابقة.
                      </td>
                    </tr>
                  ) : (
                    debtClients.map((client, idx) => {
                      const debtVal = client.remaining || 0;
                      return (
                        <tr
                          key={client.code}
                          className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                        >
                          {/* الرقم */}
                          <td className="py-2.5 px-4 text-center font-bold text-slate-600 border-l border-slate-200">
                            {idx + 1}
                          </td>

                          {/* كود الشركة */}
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-blue-900 border-l border-slate-200">
                            {client.code}
                          </td>

                          {/* اسم الشركة */}
                          <td className="py-2.5 px-4 font-bold text-slate-900 border-l border-slate-200">
                            {client.name}
                          </td>

                          {/* المديونية */}
                          <td className="py-2.5 px-4 text-left font-mono font-bold text-rose-700">
                            {debtVal.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-bold border-t-2 border-[#4a86e8] text-slate-900">
                    <td colSpan={3} className="py-3 px-4 text-right text-sm text-blue-950">
                      إجمالي المديونية المستحقة ({debtClients.length} عميل):
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-base font-extrabold text-rose-700">
                      {totalDebtAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xs text-slate-600">SDG</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer stamp */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-sans">
              <span>تم استخراج التقرير آلياً من نظام إدارة الخزينة &bull; Perma Flow</span>
              <span>تاريخ التقرير: {formattedDebtDate}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CLIENT LEDGER REPORT (Sheet: "Client Ledger")               */}
      {/* ============================================================== */}
      {activeReport === 'client-ledger' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Client Ledger Report</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg">
                  Sheet: Client Ledger
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Select any client to inspect all related Cashflow transactions and Order debt history &bull; Download as PDF
              </p>
            </div>

            {/* Client Selector Dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Client:
              </label>
              <select
                value={selectedClientCode}
                onChange={e => setSelectedClientCode(e.target.value)}
                className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-950 font-bold rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#284742]/20 cursor-pointer"
              >
                {clients.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} {c.remaining ? `(${c.remaining.toLocaleString()} SDG)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Printable Client Ledger Container (matches user screenshot 2 & 5) */}
          <div
            ref={clientLedgerPrintRef}
            className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs"
          >
            {/* Client Title Banner matching screenshot 2/5 cell B1 */}
            <div className="mb-4 bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-center shadow-2xs">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight" dir="auto">
                {selectedClient?.name || 'Client'}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Client Code: <strong className="text-[#284742]">{selectedClient?.code}</strong>
                {selectedClient?.phone ? ` • Phone: ${selectedClient.phone}` : ''}
                {selectedClient?.area ? ` • Area: ${selectedClient.area}` : ''}
              </p>
            </div>

            {/* Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#4a86e8] text-white font-bold border-b border-[#3b72cc]">
                    <th className="py-2.5 px-4 w-32 border-r border-white/20">Date</th>
                    <th className="py-2.5 px-4 border-r border-white/20">Description</th>
                    <th className="py-2.5 px-4 text-right w-40 border-r border-white/20">Cashflow</th>
                    <th className="py-2.5 px-4 text-right w-40 border-r border-white/20">Order Log</th>
                    <th className="py-2.5 px-4 text-right w-44">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {clientLedgerData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No transactions found for {selectedClient?.name}.
                      </td>
                    </tr>
                  ) : (
                    clientLedgerData.rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                      >
                        {/* Date */}
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-700 border-r border-slate-200">
                          {row.date}
                        </td>

                        {/* Description */}
                        <td className="py-2.5 px-4 font-semibold text-slate-900 border-r border-slate-200" dir="auto">
                          {row.description}
                        </td>

                        {/* Cashflow */}
                        <td className="py-2.5 px-4 text-right font-mono text-slate-800 border-r border-slate-200">
                          {row.cashflowAmount !== null
                            ? row.cashflowAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : ''}
                        </td>

                        {/* Order Log */}
                        <td className="py-2.5 px-4 text-right font-mono text-slate-800 border-r border-slate-200">
                          {row.orderAmount !== null
                            ? row.orderAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : ''}
                        </td>

                        {/* Amount / Balance */}
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {row.amount < 0
                            ? `${Math.abs(row.amount).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}-`
                            : row.amount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  {/* Total Balance Row matching screenshot 2 & 5 row 5/6 */}
                  <tr className="bg-[#b3d1ff] font-bold border-t-2 border-[#4a86e8] text-slate-900 text-xs sm:text-sm">
                    <td colSpan={2} className="py-3 px-4 font-extrabold text-blue-950">
                      Total Balance
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-blue-950 border-r border-blue-300">
                      {clientLedgerData.totalCashflow.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-blue-950 border-r border-blue-300">
                      {clientLedgerData.totalOrders.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-rose-950">
                      {clientLedgerData.finalBalance < 0
                        ? `${Math.abs(clientLedgerData.finalBalance).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}-`
                        : clientLedgerData.finalBalance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Perma Flow Treasury &bull; Client Ledger Report</span>
              <span>Generated: {new Date().toLocaleDateString('en-US')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. SNAPSHOT REPORT (Sheet: "Snapshot")                          */}
      {/* ============================================================== */}
      {activeReport === 'snapshot' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Snapshot Report</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg">
                  Sheet: Snapshot
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Cash in & Cash out summary across all client transactions within selected date range
              </p>
            </div>

            {/* Date Range Pickers */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-blue-900">Start:</span>
                <input
                  type="date"
                  value={snapshotStartDate}
                  onChange={e => setSnapshotStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-blue-950 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-blue-900">End:</span>
                <input
                  type="date"
                  value={snapshotEndDate}
                  onChange={e => setSnapshotEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-blue-950 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={snapshotSearch}
                  onChange={e => setSnapshotSearch(e.target.value)}
                  placeholder="Search snapshot..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Printable Snapshot Container (matches user screenshot 2) */}
          <div
            ref={snapshotPrintRef}
            className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-x-auto"
          >
            {/* Header matching screenshot 2 Row 1: Start [Date] | End [Date] */}
            <div className="mb-4 flex items-center gap-3">
              <div className="bg-[#4a86e8] text-white font-bold text-xs px-4 py-1.5 rounded-lg">
                Start
              </div>
              <div className="bg-slate-100 border border-slate-300 font-bold text-xs px-4 py-1.5 rounded-lg font-mono">
                {snapshotStartDate}
              </div>
              <div className="bg-[#4a86e8] text-white font-bold text-xs px-4 py-1.5 rounded-lg">
                End
              </div>
              <div className="bg-slate-100 border border-slate-300 font-bold text-xs px-4 py-1.5 rounded-lg font-mono">
                {snapshotEndDate}
              </div>
              <div className="ml-auto text-xs font-bold text-slate-500">
                {snapshotRows.length} Records in Snapshot
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden min-w-[700px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a86e8] text-white font-bold border-b border-[#3b72cc]">
                    <th className="py-2.5 px-3 w-28 border-r border-white/20">Date</th>
                    <th className="py-2.5 px-3 w-24 border-r border-white/20">Client Code</th>
                    <th className="py-2.5 px-3 border-r border-white/20">Client Name</th>
                    <th className="py-2.5 px-3 w-24 border-r border-white/20">Ref No.</th>
                    <th className="py-2.5 px-3 border-r border-white/20">Description</th>
                    <th className="py-2.5 px-3 text-right w-36 border-r border-white/20">Cash in</th>
                    <th className="py-2.5 px-3 text-right w-36">Cash Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {snapshotRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No transactions found in this date range.
                      </td>
                    </tr>
                  ) : (
                    snapshotRows.map((tx, idx) => {
                      const isIn = tx.type === 'Inflow' || (tx.type as string) === 'in';
                      return (
                        <tr
                          key={tx.id}
                          className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                        >
                          {/* Date */}
                          <td className="py-2 px-3 font-mono text-slate-700 border-r border-slate-200">
                            {tx.date}
                          </td>

                          {/* Client Code */}
                          <td className="py-2 px-3 font-mono font-bold text-blue-900 border-r border-slate-200">
                            {tx.clientCode}
                          </td>

                          {/* Client Name */}
                          <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200" dir="auto">
                            {tx.clientName}
                          </td>

                          {/* Ref No. */}
                          <td className="py-2 px-3 font-mono text-slate-700 border-r border-slate-200">
                            {tx.refNo}
                          </td>

                          {/* Description */}
                          <td className="py-2 px-3 text-slate-800 border-r border-slate-200" dir="auto">
                            {tx.description}
                          </td>

                          {/* Cash in */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-200">
                            {isIn
                              ? tx.amount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ''}
                          </td>

                          {/* Cash Out */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                            {!isIn
                              ? tx.amount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ''}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  {/* Total Row matching screenshot 2 Row 27 */}
                  <tr className="bg-[#b3d1ff] font-bold border-t-2 border-[#4a86e8] text-slate-900 text-xs sm:text-sm">
                    <td colSpan={5} className="py-3 px-4 font-black text-blue-950">
                      Total
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-950 border-r border-blue-300">
                      {totalCashIn.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-rose-950">
                      {totalCashOut.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Perma Flow Treasury &bull; Snapshot Report</span>
              <span>Range: {snapshotStartDate} to {snapshotEndDate}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
