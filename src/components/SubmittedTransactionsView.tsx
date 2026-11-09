import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Search,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { Transaction } from '../types/treasury';
import { ReportsView } from './ReportsView';

export const SubmittedTransactionsView: React.FC = () => {
  const {
    dayGroups,
    currentBalance,
    sheetConfig,
    isSyncing,
    syncWithGoogleSheet,
    selectedMonth,
    prevMonth,
    nextMonth,
    deleteTransaction,
  } = useTreasury();

  const [activeSection, setActiveSection] = useState<'transactions' | 'reports'>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Inflow' | 'Outflow'>('All');
  const [selectedTxToDelete, setSelectedTxToDelete] = useState<Transaction | null>(null);

  const monthNames = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
  ];
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthLabel = `${monthNames[selectedMonth.month]} ${selectedMonth.year}`;
  const fullMonthLabel = `${fullMonthNames[selectedMonth.month]} ${selectedMonth.year}`;

  const exportToCSV = (transactionsToExport: Transaction[], filename: string) => {
    const headers = ['Timestamp', 'Date', 'Client Code', 'Client Name', 'Ref No.', 'Description', 'Type', 'Amount', 'Balance'];
    const rows = transactionsToExport.map(t => {
      const typeLabel = (t.type === 'Inflow' || (t.type as string) === 'in') ? 'Inflow' : 'Outflow';
      return [
        `"${t.timestamp || t.createdAt}"`,
        t.date,
        `"${t.clientCode || ''}"`,
        `"${(t.clientName || '').replace(/"/g, '""')}"`,
        t.refNo,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        typeLabel,
        t.amount,
        t.balance
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredGroups = dayGroups.map(group => {
    const filteredTxs = group.transactions.filter(tx => {
      const matchesSearch =
        (tx.clientName && tx.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.clientCode && tx.clientCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.refNo && tx.refNo.toLowerCase().includes(searchQuery.toLowerCase()));

      const isIn = tx.type === 'Inflow' || (tx.type as string) === 'in';
      const matchesType =
        filterType === 'All' ||
        (filterType === 'Inflow' && isIn) ||
        (filterType === 'Outflow' && !isIn);

      return matchesSearch && matchesType;
    });

    return {
      ...group,
      transactions: filteredTxs,
    };
  }).filter(group => group.transactions.length > 0);

  const allMonthTxs = dayGroups.flatMap(g => g.transactions);
  const totalMonthIn = allMonthTxs.reduce((sum, t) => {
    const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
    return sum + (isIn ? t.amount : 0);
  }, 0);
  const totalMonthOut = allMonthTxs.reduce((sum, t) => {
    const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
    return sum + (!isIn ? t.amount : 0);
  }, 0);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-6">
      {/* View Data Sub-Navigation Bar */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveSection('transactions')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === 'transactions'
                ? 'bg-[#284742] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Transactions Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('reports')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === 'reports'
                ? 'bg-[#284742] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>3 Reports & PDF Export</span>
            <span className="text-[10px] bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded-full">
              PDF
            </span>
          </button>
        </div>

        {activeSection === 'transactions' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('reports')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#284742] bg-[#284742]/10 hover:bg-[#284742]/20 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Reports</span>
            </button>
          </div>
        )}
      </div>

      {/* Conditionally Render ReportsView */}
      {activeSection === 'reports' ? (
        <ReportsView />
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Submitted Transactions
              </h1>
              <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{fullMonthLabel}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {allMonthTxs.length} Transactions
                </span>
              </div>
            </div>

            {/* Month Switcher & Refresh controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-2xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs font-black uppercase tracking-wider text-slate-800">
                  {currentMonthLabel}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={syncWithGoogleSheet}
                disabled={isSyncing}
                title="Refresh / Sync"
                className="p-2.5 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 rounded-2xl shadow-2xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#284742]' : ''}`} />
              </button>
            </div>
          </div>

        {/* Top Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Total Inflow
              </p>
              <p className="text-xl font-extrabold text-emerald-800 mt-1">
                +{totalMonthIn.toLocaleString()} <span className="text-xs">SDG</span>
              </p>
            </div>
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Total Outflow
              </p>
              <p className="text-xl font-extrabold text-rose-800 mt-1">
                -{totalMonthOut.toLocaleString()} <span className="text-xs">SDG</span>
              </p>
            </div>
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-[#284742]/5 rounded-2xl border border-[#284742]/15 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#284742]">
                Current Treasury Balance
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {currentBalance.toLocaleString()} <span className="text-xs font-bold text-slate-500">SDG</span>
              </p>
            </div>
            <div className="p-2.5 bg-[#284742]/10 text-[#284742] rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by client, ref no., or description..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterType('All')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'All' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('Inflow')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'Inflow' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Inflow
              </button>
              <button
                type="button"
                onClick={() => setFilterType('Outflow')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'Outflow' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Outflow
              </button>
            </div>

            <button
              type="button"
              onClick={() => exportToCSV(allMonthTxs, `CashFlow_${currentMonthLabel}`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Download CSV for this month"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Day Groups List */}
        {filteredGroups.length > 0 ? (
          <div className="space-y-8">
            {filteredGroups.map(group => (
              <div key={group.date} className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                {/* Date Group Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/90 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                      {group.displayDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => exportToCSV(group.transactions, `CashFlow_${group.date}`)}
                      className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
                      title="Export transactions for this date"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <div className="px-3 py-1 bg-white border border-slate-200/80 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                        OPENING:
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {group.openingBalance.toLocaleString()}{' '}
                        <span className="text-[10px] text-slate-400 font-semibold">SDG</span>
                      </span>
                    </div>

                    <div className="px-3 py-1 bg-white border border-slate-200/80 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                        CLOSING:
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {group.closingBalance.toLocaleString()}{' '}
                        <span className="text-[10px] text-slate-400 font-semibold">SDG</span>
                      </span>
                    </div>

                    <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 text-xs font-bold rounded-lg">
                      ({group.transactions.length})
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-white">
                        <th className="py-3 px-4">TIMESTAMP</th>
                        <th className="py-3 px-3">DATE</th>
                        <th className="py-3 px-3">CLIENT CODE</th>
                        <th className="py-3 px-4">CLIENT NAME</th>
                        <th className="py-3 px-3">REF NO.</th>
                        <th className="py-3 px-4">DESCRIPTION</th>
                        <th className="py-3 px-3 text-center">TYPE</th>
                        <th className="py-3 px-4 text-right">AMOUNT</th>
                        <th className="py-3 px-4 text-right">BALANCE</th>
                        <th className="py-3 px-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {group.transactions.map(tx => {
                        const isInflow = tx.type === 'Inflow' || (tx.type as string) === 'in';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                            {/* Exact Timestamp */}
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {tx.timestamp || tx.createdAt?.replace('T', ' ').substring(0, 19)}
                            </td>

                            {/* Date */}
                            <td className="py-3 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                              {tx.date}
                            </td>

                            {/* Client Code */}
                            <td className="py-3 px-3 font-mono font-bold text-[#284742] whitespace-nowrap">
                              {tx.clientCode}
                            </td>

                            {/* Client Name */}
                            <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap" dir="auto">
                              {tx.clientName}
                            </td>

                            {/* Ref No. */}
                            <td className="py-3 px-3 font-mono font-medium text-slate-600 whitespace-nowrap">
                              {tx.refNo}
                            </td>

                            {/* Description */}
                            <td className="py-3 px-4 text-slate-700 max-w-xs sm:max-w-md break-words" dir="auto">
                              {tx.description}
                            </td>

                            {/* Type {Inflow / Outflow} */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                  isInflow
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isInflow ? 'Inflow' : 'Outflow'}
                              </span>
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <span
                                className={`font-bold ${
                                  isInflow ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {isInflow ? '+' : '-'}{tx.amount.toLocaleString()}
                              </span>
                            </td>

                            {/* Running Balance */}
                            <td className="py-3 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                              {tx.balance.toLocaleString()}
                            </td>

                            {/* Delete button */}
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedTxToDelete(tx)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all cursor-pointer"
                                title="Delete transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No transactions found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are no recorded transactions for {fullMonthLabel} matching your search filters.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {selectedTxToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Delete Transaction?</h3>
            <p className="text-xs text-slate-600 mt-2">
              Are you sure you want to delete transaction{' '}
              <strong className="text-slate-800">{selectedTxToDelete.refNo}</strong> (
              {selectedTxToDelete.clientName} - {selectedTxToDelete.amount.toLocaleString()} SDG)?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTxToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTransaction(selectedTxToDelete.id);
                  setSelectedTxToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
