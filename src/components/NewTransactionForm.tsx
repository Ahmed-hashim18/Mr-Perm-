import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Tag,
  AlignLeft,
  Send,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Hash,
  User,
  History,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { ClientItem } from '../types/treasury';
import { INITIAL_CLIENTS } from '../data/initialData';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

export const NewTransactionForm: React.FC = () => {
  const {
    currentBalance,
    sheetConfig,
    clients,
    previousDescriptions,
    addTransaction,
    getNextRefNo,
    isSyncing,
    setCurrentTab,
  } = useTreasury();

  // Columns: Timestamp (hidden), Date, Client Code, Client Name, Ref No., Description, Type {Inflow/Outflow}, Amount
  const [date, setDate] = useState<string>('2026-11-08');
  
  // Two-way interactive Client Code & Client Name (Default to empty)
  const [clientCode, setClientCode] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');

  const [type, setType] = useState<'Inflow' | 'Outflow'>('Inflow');
  const [refNo, setRefNo] = useState<string>(() => getNextRefNo('Inflow'));
  const [description, setDescription] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');

  // Dropdowns visibility
  const [showCodeDropdown, setShowCodeDropdown] = useState<boolean>(false);
  const [showNameDropdown, setShowNameDropdown] = useState<boolean>(false);

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const nameContainerRef = useRef<HTMLDivElement>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-generate reference number when type changes or on init
  useEffect(() => {
    setRefNo(getNextRefNo(type));
  }, [type, getNextRefNo]);

  // Click outside listener to close autocomplete dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (codeContainerRef.current && !codeContainerRef.current.contains(event.target as Node)) {
        setShowCodeDropdown(false);
      }
      if (nameContainerRef.current && !nameContainerRef.current.contains(event.target as Node)) {
        setShowNameDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // When user types in Client Code
  const handleCodeChange = (typedCode: string) => {
    setClientCode(typedCode);
    setShowCodeDropdown(true);

    const clean = typedCode.trim().toUpperCase();
    if (clean) {
      // Find exact or closest match
      const matched = clients.find(c => c.code.toUpperCase() === clean);
      if (matched) {
        setClientName(matched.name);
      }
    }
  };

  // When user types in Client Name
  const handleNameChange = (typedName: string) => {
    setClientName(typedName);
    setShowNameDropdown(true);

    const norm = normalizeText(typedName);
    if (norm) {
      // Find matching client by normalized name
      const matched = clients.find(c => normalizeText(c.name) === norm);
      if (matched) {
        setClientCode(matched.code);
      }
    }
  };

  // When user selects a client from either suggestions list
  const handleSelectClient = (c: ClientItem) => {
    setClientCode(c.code);
    setClientName(c.name);
    setShowCodeDropdown(false);
    setShowNameDropdown(false);
  };

  // Filtered lists for suggestions
  const codeMatches = clients.filter(c => {
    if (!clientCode) return true;
    return c.code.toLowerCase().includes(clientCode.toLowerCase().trim());
  });

  const nameMatches = clients.filter(c => {
    if (!clientName) return true;
    const normSearch = normalizeText(clientName);
    return (
      normalizeText(c.name).includes(normSearch) ||
      c.code.toLowerCase().includes(clientName.toLowerCase().trim())
    );
  });

  // Amount parsing with comma handling
  const parsedAmount = React.useMemo(() => {
    if (!amountStr) return 0;
    const clean = amountStr.replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }, [amountStr]);

  const projectedBalance =
    type === 'Inflow' ? currentBalance + parsedAmount : currentBalance - parsedAmount;

  // Selected client object & remaining debt/balance (with robust fallback to INITIAL_CLIENTS)
  const selectedClientObj = React.useMemo(() => {
    const cleanCode = clientCode.trim().toUpperCase();
    const cleanName = normalizeText(clientName);
    if (!cleanCode && !cleanName) return null;

    const fromContext = clients.find(
      c =>
        (cleanCode && c.code.toUpperCase() === cleanCode) ||
        (cleanName && normalizeText(c.name) === cleanName)
    );
    if (fromContext) return fromContext;

    return INITIAL_CLIENTS.find(
      c =>
        (cleanCode && c.code.toUpperCase() === cleanCode) ||
        (cleanName && normalizeText(c.name) === cleanName)
    ) || null;
  }, [clients, clientCode, clientName]);

  // Ensure remaining balance is accurately resolved (e.g. CDC C29 -> 11,755,633 SDG)
  const clientRemaining: number = React.useMemo(() => {
    if (!selectedClientObj) return 0;
    if (typeof selectedClientObj.remaining === 'number' && selectedClientObj.remaining > 0) {
      return selectedClientObj.remaining;
    }
    const fromInit = INITIAL_CLIENTS.find(
      c =>
        c.code.toUpperCase() === selectedClientObj.code.toUpperCase() ||
        normalizeText(c.name) === normalizeText(selectedClientObj.name)
    );
    return fromInit?.remaining || 0;
  }, [selectedClientObj]);

  const handleAmountChange = (val: string) => {
    if (!val) {
      setAmountStr('');
      return;
    }
    // Normalize Arabic/Eastern digits to standard digits
    const standard = val
      .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
      .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);

    const oldDigits = amountStr.replace(/[^0-9.]/g, '');
    let clean = standard.replace(/[^0-9.]/g, '');

    // If user pressed backspace on a comma, drop the preceding digit so it never gets stuck
    if (val.length < amountStr.length && clean === oldDigits && clean.length > 0) {
      clean = clean.slice(0, -1);
    }

    const parts = clean.split('.');
    if (parts.length > 2) return;

    // Format whole number with comma thousand separators
    const whole = parts[0].replace(/^0+(?=\d)/, '');
    const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = parts.length === 2 ? `${formattedWhole || '0'}.${parts[1]}` : formattedWhole;
    setAmountStr(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verify existing client
    const matched = clients.find(
      c =>
        c.code.toUpperCase() === clientCode.trim().toUpperCase() ||
        normalizeText(c.name) === normalizeText(clientName)
    );

    if (!matched) {
      alert(`Please select an existing client from your sheet (e.g. C01 to C31). "${clientCode || clientName}" was not found.`);
      return;
    }

    if (parsedAmount <= 0) {
      alert('Please enter an amount greater than 0');
      return;
    }

    setIsSubmitting(true);

    const result = await addTransaction({
      date,
      clientCode: matched.code,
      clientName: matched.name,
      refNo: refNo.trim() || getNextRefNo(type),
      type,
      description: description.trim(),
      amount: parsedAmount,
    });

    setIsSubmitting(false);

    if (result.success) {
      setToastMessage(result.message);
      setClientCode('');
      setClientName('');
      setAmountStr('');
      setDescription('');
      setRefNo(getNextRefNo(type));

      setTimeout(() => {
        setToastMessage(null);
      }, 4500);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{toastMessage}</p>
              <p className="text-xs text-emerald-600">Recorded with exact timestamp into sheet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab('view-data')}
            className="text-xs font-bold underline hover:text-emerald-950 ml-4 cursor-pointer"
          >
            View Data →
          </button>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              New Transaction
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Insert transaction into Cashflow sheet matched with Clients sheet
            </p>
          </div>

          {/* Current Balance Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                CURRENT BALANCE
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {currentBalance.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-500">{sheetConfig.currency}</span>
              </span>
            </div>

            <div
              className="p-3 bg-slate-100/90 border border-slate-200/80 rounded-2xl text-slate-700 flex items-center justify-center shadow-2xs"
              title="Verified Balance"
            >
              <CheckCircle className="w-5 h-5 text-[#284742]" />
            </div>
          </div>
        </div>

        {/* Transaction Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column: Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-sm font-semibold text-slate-800 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                />
              </div>
            </div>

            {/* Column: Type {Inflow / Outflow} */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#f3f4f6]/80 p-1.5 rounded-2xl border border-transparent">
                <button
                  type="button"
                  onClick={() => setType('Inflow')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                    type === 'Inflow'
                      ? 'bg-[#284742] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-emerald-300" />
                  <span>Inflow</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('Outflow')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                    type === 'Outflow'
                      ? 'bg-[#284742] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-rose-300" />
                  <span>Outflow</span>
                </button>
              </div>
            </div>

            {/* Column: Client Code (Write code -> auto-completes Name) */}
            <div className="relative" ref={codeContainerRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Client Code
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  Type code &bull; auto-fills name
                </span>
              </div>

              <div className="relative">
                <Hash className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={clientCode}
                  onFocus={() => setShowCodeDropdown(true)}
                  onChange={e => handleCodeChange(e.target.value)}
                  placeholder="e.g. C01, C02..."
                  className="w-full pl-11 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-sm font-mono font-bold text-[#284742] transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                />
              </div>

              {/* Autocomplete suggestions popup */}
              {showCodeDropdown && codeMatches.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 max-h-56 overflow-y-auto animate-in fade-in duration-100">
                  {codeMatches.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectClient(c)}
                      className={`px-3 py-2 rounded-xl text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between ${
                        clientCode.toUpperCase() === c.code.toUpperCase()
                          ? 'bg-[#284742]/10 text-[#284742] font-bold'
                          : 'text-slate-700'
                      }`}
                    >
                      <span className="font-mono font-bold text-[#284742]">{c.code}</span>
                      <span className="text-slate-900 font-medium" dir="auto">{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column: Client Name (Write name -> auto-completes Code) */}
            <div className="relative" ref={nameContainerRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Client Name
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  Type name &bull; auto-fills code
                </span>
              </div>

              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={clientName}
                  onFocus={() => setShowNameDropdown(true)}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. أبو عمر, انجي, الرياض..."
                  className="w-full pl-11 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-sm font-semibold text-slate-800 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                  dir="auto"
                />
              </div>

              {/* Autocomplete suggestions popup */}
              {showNameDropdown && nameMatches.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 max-h-56 overflow-y-auto animate-in fade-in duration-100">
                  {nameMatches.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectClient(c)}
                      className={`px-3 py-2 rounded-xl text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between ${
                        normalizeText(clientName) === normalizeText(c.name)
                          ? 'bg-[#284742]/10 text-[#284742] font-bold'
                          : 'text-slate-700'
                      }`}
                    >
                      <span className="font-semibold text-slate-900" dir="auto">{c.name}</span>
                      <span className="font-mono font-bold text-[#284742] px-2 py-0.5 rounded-md bg-slate-100">
                        {c.code}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column: Ref No. */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ref No.
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={refNo}
                  onChange={e => setRefNo(e.target.value)}
                  placeholder="e.g. D2402 or C8224"
                  className="w-full pl-11 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-sm font-semibold text-slate-800 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                />
              </div>
            </div>

            {/* Column: Amount (SDG) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Amount
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center pointer-events-none">
                  <span className="text-xs font-black tracking-wider text-slate-600 bg-slate-200/90 px-2 py-0.5 rounded-md">
                    SDG
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={amountStr}
                  onChange={e => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="w-full pl-20 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-base font-bold text-slate-900 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                />
              </div>
            </div>
          </div>

          {/* Column: Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Description
            </label>
            <div className="relative">
              <AlignLeft className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of the transaction"
                className="w-full pl-11 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-sm font-medium text-slate-800 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                dir="auto"
              />
            </div>

            {/* Quick Text From Previous Descriptions at the sheet */}
            {previousDescriptions.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
                  <History className="w-3.5 h-3.5 text-[#284742]" />
                  <span>Quick Text from previous sheet entries:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {previousDescriptions.slice(0, 12).map((desc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDescription(desc)}
                      title={desc}
                      className="text-left px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-medium transition-colors border border-slate-200/60 max-w-xs truncate cursor-pointer"
                      dir="auto"
                    >
                      {desc}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Balance Projection */}
          {parsedAmount > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Current Balance:</span>
                <span className="font-bold text-slate-800">
                  {currentBalance.toLocaleString()} SDG
                </span>
                <span className="text-slate-400 font-bold">{type === 'Inflow' ? '+' : '-'}</span>
                <span className={`font-bold ${type === 'Inflow' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {parsedAmount.toLocaleString()} SDG
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Projected Balance:</span>
                <span className="text-sm font-extrabold text-[#284742]">
                  {projectedBalance.toLocaleString()} SDG
                </span>
              </div>
            </div>
          )}

          {/* Client Remaining Amount Calculation (Directly below Current Balance Calculation) */}
          {selectedClientObj && (
            <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950">
                  {selectedClientObj.code}
                </span>
                <span className="font-bold text-slate-800" dir="auto">
                  {selectedClientObj.name}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-slate-600">Remaining Amount:</span>
                <span className="font-extrabold text-slate-900">
                  {clientRemaining.toLocaleString('en-US')} SDG
                </span>
                {parsedAmount > 0 && (
                  <>
                    <span className="text-slate-400 font-bold">-</span>
                    <span className="font-bold text-rose-600">
                      {parsedAmount.toLocaleString('en-US')} SDG ({type})
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-amber-900 uppercase tracking-wider text-[10px]">
                  {type === 'Outflow' ? 'Remaining after Outflow:' : 'Remaining after Inflow:'}
                </span>
                <span className="text-sm font-extrabold text-[#284742] px-2.5 py-0.5 bg-white rounded-lg border border-amber-200 shadow-2xs">
                  {(clientRemaining - parsedAmount).toLocaleString('en-US')} SDG
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 flex items-center justify-end border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || isSyncing}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#284742] hover:bg-[#1e3632] active:scale-98 text-white rounded-2xl font-bold text-sm shadow-md shadow-[#284742]/20 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
