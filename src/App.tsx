/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TreasuryProvider, useTreasury } from './context/TreasuryContext';
import { Navbar } from './components/Navbar';
import { NewTransactionForm } from './components/NewTransactionForm';
import { SubmittedTransactionsView } from './components/SubmittedTransactionsView';
import { MakeAnOrderView } from './components/MakeAnOrderView';
import { ClientsView } from './components/ClientsView';

const TreasuryContent: React.FC = () => {
  const { currentTab, sheetConfig } = useTreasury();

  return (
    <div className="min-h-screen bg-[#f3f4f6]/70 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'new-entry' && <NewTransactionForm />}
        {currentTab === 'view-data' && <SubmittedTransactionsView />}
        {(currentTab === 'make-order' || currentTab === 'sales') && <MakeAnOrderView />}
        {currentTab === 'clients' && <ClientsView />}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/70 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Cash Flow & Treasury</span>
            <span className="text-slate-300">•</span>
            <span>Currency: <strong>{sheetConfig.currency}</strong></span>
          </div>
          
          <div className="text-slate-400">
            Automated Cash Flow Sheet System
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <TreasuryProvider>
      <TreasuryContent />
    </TreasuryProvider>
  );
}
