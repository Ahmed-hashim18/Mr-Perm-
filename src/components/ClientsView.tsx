import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Phone,
  MapPin,
  Mail,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Hash,
  User,
  X,
  Save,
  DollarSign,
  ArrowUpDown,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { ClientItem } from '../types/treasury';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

export const ClientsView: React.FC = () => {
  const {
    clients,
    sheetConfig,
    addClient,
    updateClient,
    restoreAllBalances,
    getNextClientCode,
    isSyncing,
    setCurrentTab,
  } = useTreasury();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'with-debt' | 'settled'>('all');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'debt-desc'>('code');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);

  // Add form fields
  const [newCode, setNewCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newArea, setNewArea] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newRemainingStr, setNewRemainingStr] = useState<string>('0');

  // Edit form fields
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editArea, setEditArea] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRemainingStr, setEditRemainingStr] = useState<string>('0');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Open Add Modal with auto-detected next client code
  const handleOpenAddModal = () => {
    const nextCode = getNextClientCode();
    setNewCode(nextCode);
    setNewName('');
    setNewPhone('');
    setNewArea('');
    setNewEmail('');
    setNewRemainingStr('0');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal for a client
  const handleOpenEditModal = (client: ClientItem) => {
    setEditingClient(client);
    setEditName(client.name || '');
    setEditPhone(client.phone || '');
    setEditArea(client.area || '');
    setEditEmail(client.email || '');
    setEditRemainingStr((client.remaining || 0).toLocaleString('en-US'));
  };

  // Comma formatting helpers
  const handleFormatCommaInput = (val: string, setter: (s: string) => void) => {
    if (!val) {
      setter('');
      return;
    }
    const standard = val
      .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
      .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
    const clean = standard.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) return;
    const whole = parts[0].replace(/^0+(?=\d)/, '');
    const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = parts.length === 2 ? `${formattedWhole || '0'}.${parts[1]}` : formattedWhole;
    setter(formatted);
  };

  // Save New Client
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Please enter a Client Name.');
      return;
    }

    const rem = parseFloat(newRemainingStr.replace(/,/g, '')) || 0;
    setIsSubmitting(true);

    const result = await addClient({
      code: newCode.trim().toUpperCase() || getNextClientCode(),
      name: newName.trim(),
      phone: newPhone.trim(),
      area: newArea.trim(),
      email: newEmail.trim(),
      remaining: rem,
    });

    setIsSubmitting(false);

    if (result.success) {
      setToastMessage(result.message);
      setIsAddModalOpen(false);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      alert(result.message);
    }
  };

  // Save Edited Client
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    if (!editName.trim()) {
      alert('Client Name cannot be empty.');
      return;
    }

    const rem = parseFloat(editRemainingStr.replace(/,/g, '')) || 0;
    setIsSubmitting(true);

    const result = await updateClient({
      code: editingClient.code,
      name: editName.trim(),
      phone: editPhone.trim(),
      area: editArea.trim(),
      email: editEmail.trim(),
      remaining: rem,
    });

    setIsSubmitting(false);

    if (result.success) {
      setToastMessage(result.message);
      setEditingClient(null);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      alert(result.message);
    }
  };

  // Restore All Client Balances in Google Sheet
  const handleRestoreBalances = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to restore all original client remaining balances in Column E of the "Clients" Google Sheet and the app?'
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    const result = await restoreAllBalances();
    setIsSubmitting(false);

    setToastMessage(result.message);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Metrics
  const totalClientsCount = clients.length;
  const totalOutstandingDebt = clients.reduce((sum, c) => sum + (c.remaining || 0), 0);
  const clientsWithDebtCount = clients.filter(c => (c.remaining || 0) > 0).length;

  // Filtered & Sorted Clients
  const filteredClients = clients
    .filter(c => {
      // Debt filter
      const debt = c.remaining || 0;
      if (filterType === 'with-debt' && debt <= 0) return false;
      if (filterType === 'settled' && debt > 0) return false;

      // Search query
      if (!searchQuery) return true;
      const q = normalizeText(searchQuery);
      return (
        normalizeText(c.name).includes(q) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (c.phone && c.phone.includes(searchQuery.trim())) ||
        (c.area && normalizeText(c.area).includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'debt-desc') {
        return (b.remaining || 0) - (a.remaining || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ar');
      }
      // default: code numerical order
      const numA = parseInt(a.code.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.code.replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{toastMessage}</p>
              <p className="text-xs text-emerald-600">Updated in Clients sheet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#284742] text-white rounded-2xl shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Clients Directory
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synchronized with Google Sheet <strong>Clients</strong> tab &bull; Client Code &bull; Balances &bull; Contact Info
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Restore Client Balances Button */}
            <button
              type="button"
              disabled={isSubmitting || isSyncing}
              onClick={handleRestoreBalances}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 active:scale-98 rounded-2xl text-xs sm:text-sm font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              title="Restore all client balances in Column E of the Clients sheet"
            >
              <RotateCcw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>Restore Sheet Balances</span>
            </button>

            {/* New Client Button */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-[#284742] hover:bg-[#1e3632] active:scale-98 text-white rounded-2xl text-sm font-bold shadow-md shadow-[#284742]/15 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New Client</span>
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              TOTAL REGISTERED CLIENTS
            </span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {totalClientsCount}{' '}
              <span className="text-xs font-semibold text-slate-400">Clients</span>
            </p>
          </div>

          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              TOTAL REMAINING DEBT (ALL CLIENTS)
            </span>
            <p className="text-2xl font-extrabold text-amber-950 mt-1">
              {totalOutstandingDebt.toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold text-amber-700">{sheetConfig.currency}</span>
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              OUTSTANDING VS SETTLED
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-rose-600">
                {clientsWithDebtCount} owing
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-sm font-bold text-emerald-600">
                {totalClientsCount - clientsWithDebtCount} settled
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 pt-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by client code, name, phone, or area..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
            />
          </div>

          {/* Filters & Sorting */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Segment */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                All ({totalClientsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('with-debt')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterType === 'with-debt'
                    ? 'bg-amber-100 text-amber-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Owing ({clientsWithDebtCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('settled')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterType === 'settled'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Settled
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-100 border border-transparent rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
            >
              <option value="code">Sort by Code (C01...)</option>
              <option value="debt-desc">Highest Debt First</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>

        {/* Clients Directory Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#284742] text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Client Code</th>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4 text-right">Total Remining</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                      No clients matched your search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(client => {
                    const remainingDebt = client.remaining || 0;
                    return (
                      <tr key={client.code} className="hover:bg-slate-50/80 transition-colors">
                        {/* Client Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-[#284742]">
                          <span className="px-2.5 py-1 bg-[#284742]/10 rounded-lg">
                            {client.code}
                          </span>
                        </td>

                        {/* Client Name */}
                        <td className="py-3.5 px-4 font-bold text-slate-900" dir="auto">
                          {client.name}
                        </td>

                        {/* Phone Number */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {client.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{client.phone}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Area */}
                        <td className="py-3.5 px-4 text-slate-600" dir="auto">
                          {client.area ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-xs">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{client.area}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Total Remining */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {remainingDebt > 0 ? (
                            <span className="text-rose-600 font-extrabold">
                              {remainingDebt.toLocaleString('en-US')}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">SDG</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">0 SDG</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-500 text-xs">
                          {client.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{client.email}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(client)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                              title="Modify Client"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setCurrentTab('make-order')}
                              className="px-2 py-1 bg-[#284742]/10 hover:bg-[#284742] text-[#284742] hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Create Order for this Client"
                            >
                              Order
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE NEW CLIENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#284742] text-white rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-900">Create New Client</h3>
                  <p className="text-xs text-slate-500">Auto-detected next code from sheet &bull; Saves to Clients tab</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Auto-detected Client Code */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Client Code
                    </label>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Auto-detected
                    </span>
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={newCode}
                      onChange={e => setNewCode(e.target.value.toUpperCase())}
                      placeholder="e.g. C34"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-[#284742] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                    />
                  </div>
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Client Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="e.g. شركة الأمل"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                      dir="auto"
                    />
                  </div>
                </div>
              </div>

              {/* Phone & Area */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="+249..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Area / Location
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={newArea}
                      onChange={e => setNewArea(e.target.value)}
                      placeholder="e.g. الخرطوم, بحري..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                      dir="auto"
                    />
                  </div>
                </div>
              </div>

              {/* Email & Initial Total Remining */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Initial Total Remining
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-xs font-bold text-slate-400">
                      SDG
                    </span>
                    <input
                      type="text"
                      value={newRemainingStr}
                      onChange={e => handleFormatCommaInput(e.target.value, setNewRemainingStr)}
                      placeholder="0"
                      className="w-full pl-14 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isSyncing}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-[#284742] hover:bg-[#1e3632] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Adding...' : 'Create & Save to Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODIFY CLIENT MODAL */}
      {editingClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#284742] text-white rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-900">
                    Modify Client: <span className="font-mono text-[#284742]">{editingClient.code}</span>
                  </h3>
                  <p className="text-xs text-slate-500">Update client details and remaining balance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Client Code (Read-only badge) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Client Code
                  </label>
                  <div className="px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-mono font-bold text-[#284742] border border-slate-200/80">
                    {editingClient.code}
                  </div>
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                    dir="auto"
                  />
                </div>
              </div>

              {/* Phone & Area */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="+249..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Area / Location
                  </label>
                  <input
                    type="text"
                    value={editArea}
                    onChange={e => setEditArea(e.target.value)}
                    placeholder="e.g. الخرطوم..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                    dir="auto"
                  />
                </div>
              </div>

              {/* Email & Total Remining */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Total Remining (SDG)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-xs font-bold text-slate-400">
                      SDG
                    </span>
                    <input
                      type="text"
                      value={editRemainingStr}
                      onChange={e => handleFormatCommaInput(e.target.value, setEditRemainingStr)}
                      className="w-full pl-14 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isSyncing}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#284742] hover:bg-[#1e3632] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
