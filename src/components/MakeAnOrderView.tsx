import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Tag,
  AlignLeft,
  Send,
  Hash,
  User,
  CheckCircle2,
  Receipt,
  CreditCard,
  Layers,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { ClientItem, PaymentOption } from '../types/treasury';
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

export const MakeAnOrderView: React.FC = () => {
  const {
    clients,
    orders,
    addOrder,
    sheetConfig,
    getNextInvoiceNo,
    isSyncing,
    currentBalance,
    setCurrentTab,
  } = useTreasury();

  // Form states
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [clientCode, setClientCode] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => getNextInvoiceNo());
  const [orderAmountStr, setOrderAmountStr] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('Partial Payment');
  const [downPaymentStr, setDownPaymentStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Dropdown states for two-way client search
  const [showCodeDropdown, setShowCodeDropdown] = useState<boolean>(false);
  const [showNameDropdown, setShowNameDropdown] = useState<boolean>(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const nameContainerRef = useRef<HTMLDivElement>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-fill invoice number when orders change if not modified
  useEffect(() => {
    if (!invoiceNumber || invoiceNumber.startsWith('INV-')) {
      setInvoiceNumber(getNextInvoiceNo());
    }
  }, [orders, getNextInvoiceNo]);

  // Click outside listener for client autocomplete dropdowns
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
      const matched = clients.find(c => normalizeText(c.name) === norm);
      if (matched) {
        setClientCode(matched.code);
      }
    }
  };

  const handleSelectClient = (c: ClientItem) => {
    setClientCode(c.code);
    setClientName(c.name);
    setShowCodeDropdown(false);
    setShowNameDropdown(false);
  };

  // Filtered client lists
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

  // Selected client object with robust fallback to INITIAL_CLIENTS
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

    return (
      INITIAL_CLIENTS.find(
        c =>
          (cleanCode && c.code.toUpperCase() === cleanCode) ||
          (cleanName && normalizeText(c.name) === cleanName)
      ) || null
    );
  }, [clients, clientCode, clientName]);

  const clientCurrentRemaining: number = React.useMemo(() => {
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

  // Amount formatting handlers (supporting commas, Arabic digits, smooth typing)
  const formatCommaValue = (val: string, prevVal: string): string => {
    if (!val) return '';
    const standard = val
      .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
      .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);

    const oldDigits = prevVal.replace(/[^0-9.]/g, '');
    let clean = standard.replace(/[^0-9.]/g, '');

    if (val.length < prevVal.length && clean === oldDigits && clean.length > 0) {
      clean = clean.slice(0, -1);
    }

    const parts = clean.split('.');
    if (parts.length > 2) return prevVal;

    const whole = parts[0].replace(/^0+(?=\d)/, '');
    const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length === 2 ? `${formattedWhole || '0'}.${parts[1]}` : formattedWhole;
  };

  const handleOrderAmountChange = (val: string) => {
    setOrderAmountStr(formatCommaValue(val, orderAmountStr));
  };

  const handleDownPaymentChange = (val: string) => {
    setDownPaymentStr(formatCommaValue(val, downPaymentStr));
  };

  // Parsed numerical amounts
  const parsedOrderAmount = React.useMemo(() => {
    if (!orderAmountStr) return 0;
    return parseFloat(orderAmountStr.replace(/,/g, '')) || 0;
  }, [orderAmountStr]);

  const parsedDownPayment = React.useMemo(() => {
    if (paymentOption === 'Full Payment') return parsedOrderAmount;
    if (paymentOption === 'Installments') return 0;
    if (!downPaymentStr) return 0;
    const entered = parseFloat(downPaymentStr.replace(/,/g, '')) || 0;
    return Math.min(parsedOrderAmount, entered);
  }, [paymentOption, downPaymentStr, parsedOrderAmount]);

  const unpaidPortion = Math.max(0, parsedOrderAmount - parsedDownPayment);

  // Projected new client remaining debt after order submission
  // Rules:
  // Installments: +parsedOrderAmount
  // Partial: +unpaidPortion (unpaid portion only)
  // Full: +0 (paid in full)
  const projectedClientRemaining = clientCurrentRemaining + unpaidPortion;

  // Projected treasury balance after down payment inflow
  const projectedTreasuryBalance = currentBalance + parsedDownPayment;

  // Auto-fill suggested description if empty
  const applySuggestedDescription = (text: string) => {
    setDescription(text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const matched = clients.find(
      c =>
        c.code.toUpperCase() === clientCode.trim().toUpperCase() ||
        normalizeText(c.name) === normalizeText(clientName)
    );

    if (!matched) {
      alert(`Please select an existing client (e.g. C01 to C33). "${clientCode || clientName}" was not found.`);
      return;
    }

    if (parsedOrderAmount <= 0) {
      alert('Please enter an order amount greater than 0');
      return;
    }

    if (paymentOption === 'Partial Payment' && parsedDownPayment <= 0) {
      alert('For Partial Payment, please enter the paid down payment amount. (Use Installments for 0 down payment).');
      return;
    }

    setIsSubmitting(true);

    const result = await addOrder({
      date,
      clientCode: matched.code,
      clientName: matched.name,
      invoiceNumber: invoiceNumber.trim() || getNextInvoiceNo(),
      description: description.trim(),
      amount: parsedOrderAmount,
      paymentOption,
      downPayment: parsedDownPayment,
    });

    setIsSubmitting(false);

    if (result.success) {
      setToastMessage(result.message);
      setClientCode('');
      setClientName('');
      setOrderAmountStr('');
      setDownPaymentStr('');
      setDescription('');
      setInvoiceNumber(getNextInvoiceNo());

      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{toastMessage}</p>
              <p className="text-xs text-emerald-600">Updated client remaining debt and synced Cashflow</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab('view-data')}
            className="text-xs font-bold underline hover:text-emerald-950 ml-4 cursor-pointer"
          >
            View Cashflow Data →
          </button>
        </div>
      )}

      {/* Main Order Form Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#284742] text-white rounded-2xl shadow-xs">
                <Receipt className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Make An Order
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Automatically updates Client Remaining Debt in <strong>Clients</strong> sheet &bull; Syncs Cashflow on payment
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-100/90 rounded-2xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                TREASURY BALANCE
              </span>
              <span className="text-base sm:text-lg font-extrabold text-[#284742]">
                {currentBalance.toLocaleString()} <span className="text-xs font-bold text-slate-500">{sheetConfig.currency}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Order Form */}
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

            {/* Column: Invoice Number */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Invoice Number
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  Auto-sequenced or custom
                </span>
              </div>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-1010"
                  className="w-full pl-11 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-sm font-mono font-bold text-slate-900 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                />
              </div>
            </div>

            {/* Column: Client Code (Write code -> auto-fills Name) */}
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
                  placeholder="e.g. C26, C13, C29..."
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

            {/* Column: Client Name (Write name -> auto-fills Code) */}
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
                  placeholder="e.g. ميديكال بلص, دان مروي, CDC..."
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

            {/* Column: Order Amount (SDG) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Order Total Amount (SDG)
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
                  value={orderAmountStr}
                  onChange={e => handleOrderAmountChange(e.target.value)}
                  placeholder="0"
                  className="w-full pl-20 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-base font-bold text-slate-900 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                />
              </div>
            </div>

            {/* Column: Payment Option Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Payment Option
              </label>
              <div className="grid grid-cols-3 gap-2 bg-[#f3f4f6]/80 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setPaymentOption('Full Payment')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    paymentOption === 'Full Payment'
                      ? 'bg-[#284742] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mb-0.5" />
                  <span>Full Payment</span>
                  <span className="text-[10px] font-normal opacity-80">100% Cashflow</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOption('Partial Payment')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    paymentOption === 'Partial Payment'
                      ? 'bg-[#284742] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Layers className="w-4 h-4 mb-0.5 text-amber-300" />
                  <span>Partial Payment</span>
                  <span className="text-[10px] font-normal opacity-80">Down + Install</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOption('Installments')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    paymentOption === 'Installments'
                      ? 'bg-[#284742] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Clock className="w-4 h-4 mb-0.5 text-sky-300" />
                  <span>Installments</span>
                  <span className="text-[10px] font-normal opacity-80">$0 Down</span>
                </button>
              </div>
            </div>
          </div>

          {/* If Partial Payment: Down Payment Input */}
          {paymentOption === 'Partial Payment' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider mb-2">
                    Paid Down Payment Amount (SDG)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 flex items-center pointer-events-none">
                      <span className="text-xs font-black tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md">
                        SDG
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={downPaymentStr}
                      onChange={e => handleDownPaymentChange(e.target.value)}
                      placeholder="e.g. 3,000,000"
                      className="w-full pl-20 pr-4 py-2.5 bg-white border border-amber-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                <div className="text-xs space-y-1.5 pl-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-amber-200/80 pt-3 sm:pt-0">
                  <div className="flex justify-between text-emerald-800">
                    <span className="font-semibold">Paid Now (Cashflow Inflow):</span>
                    <span className="font-bold">+{parsedDownPayment.toLocaleString('en-US')} SDG</span>
                  </div>
                  <div className="flex justify-between text-amber-900">
                    <span className="font-semibold">Unpaid Portion (Added to Debt):</span>
                    <span className="font-bold">+{unpaidPortion.toLocaleString('en-US')} SDG</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1">
                    * Only the down payment is recorded into the Cashflow sheet now. The rest is added to client remaining debt.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Description / Notes
            </label>
            <div className="relative">
              <AlignLeft className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. تم سداد ٣ مليون كاش والباقي أقساط / طلب أدوية ومستلزمات"
                className="w-full pl-11 pr-4 py-3 bg-[#f3f4f6]/80 hover:bg-[#f3f4f6] focus:bg-white border border-transparent focus:border-[#284742] rounded-2xl text-sm font-medium text-slate-800 transition-all focus:outline-none focus:ring-3 focus:ring-[#284742]/10"
                dir="auto"
              />
            </div>

            {/* Quick description suggestions */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">Suggestions:</span>
              {parsedDownPayment > 0 && unpaidPortion > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    applySuggestedDescription(
                      `تم سداد ${parsedDownPayment.toLocaleString('en-US')} كاش والباقي أقساط`
                    )
                  }
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-medium cursor-pointer"
                  dir="auto"
                >
                  تم سداد {parsedDownPayment.toLocaleString('en-US')} كاش
                </button>
              )}
              <button
                type="button"
                onClick={() => applySuggestedDescription('تم سداد كاش')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-medium cursor-pointer"
                dir="auto"
              >
                تم سداد كاش
              </button>
              <button
                type="button"
                onClick={() => applySuggestedDescription('طلب مواد ومستلزمات')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-medium cursor-pointer"
                dir="auto"
              >
                طلب مواد ومستلزمات
              </button>
            </div>
          </div>

          {/* Client Credit & Cashflow Financial Impact Banner */}
          {selectedClientObj && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#284742]/10 text-[#284742]">
                    {selectedClientObj.code}
                  </span>
                  <span className="font-bold text-slate-900" dir="auto">
                    {selectedClientObj.name}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-500">Current Outstanding Balance:</span>
                  <span className="font-extrabold text-slate-900">
                    {clientCurrentRemaining.toLocaleString('en-US')} SDG
                  </span>
                </div>

                <div className="flex items-center gap-2 font-bold text-xs">
                  <span className="text-slate-500 uppercase tracking-wider text-[10px]">
                    New Client Remaining:
                  </span>
                  <span className="text-sm font-extrabold text-amber-950 px-2.5 py-0.5 bg-amber-100 rounded-lg border border-amber-200">
                    {projectedClientRemaining.toLocaleString('en-US')} SDG
                  </span>
                </div>
              </div>

              {/* Cashflow rule explanation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="block font-bold text-slate-700 mb-0.5">
                    1. Google Sheet &ldquo;Cashflow&rdquo; Action:
                  </span>
                  {parsedDownPayment > 0 ? (
                    <p className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>
                        Logs Inflow of <strong>+{parsedDownPayment.toLocaleString('en-US')} SDG</strong> into Cashflow
                      </span>
                    </p>
                  ) : (
                    <p className="text-slate-500 font-medium">
                      No Cashflow entry created ($0 paid down payment).
                    </p>
                  )}
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="block font-bold text-slate-700 mb-0.5">
                    2. Client Credit Management Rule:
                  </span>
                  {unpaidPortion > 0 ? (
                    <p className="text-amber-800 font-semibold">
                      Client debt increases by <strong>+{unpaidPortion.toLocaleString('en-US')} SDG</strong> (unpaid portion).
                    </p>
                  ) : (
                    <p className="text-emerald-700 font-semibold">
                      Full order paid on the spot. No debt added to client.
                    </p>
                  )}
                </div>
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
              <span>{isSubmitting ? 'Recording Order...' : 'Submit Order & Update Sheet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

