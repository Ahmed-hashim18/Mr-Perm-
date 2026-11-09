import React from 'react';
import { PlusCircle, ListFilter, ShoppingBag, Wallet, Users } from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';

export const Navbar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    currentBalance,
    sheetConfig,
  } = useTreasury();

  return (
    <header className="w-full max-w-6xl mx-auto pt-6 pb-4 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-xs flex-wrap">
          <button
            type="button"
            onClick={() => setCurrentTab('new-entry')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'new-entry'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('view-data')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'view-data'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>View Data</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('make-order')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'make-order' || currentTab === 'sales'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Make An Order</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('clients')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'clients'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clients</span>
          </button>
        </div>

        {/* Right side: Clean Balance Display with SDG currency */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="p-1.5 bg-[#284742]/10 text-[#284742] rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Current Balance
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#284742] leading-none">
                {currentBalance.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-500">{sheetConfig.currency}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
