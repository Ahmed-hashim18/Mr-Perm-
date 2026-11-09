import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  FileSpreadsheet,
  Link2,
  ExternalLink,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { GOOGLE_APPS_SCRIPT_CODE, testAppsScriptConnection } from '../services/appsScriptService';

export const AppsScriptModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    sheetConfig,
    updateSheetConfig,
    syncWithGoogleSheet,
  } = useTreasury();

  const [urlInput, setUrlInput] = useState(sheetConfig.appsScriptUrl);
  const [openingBalInput, setOpeningBalInput] = useState(sheetConfig.initialOpeningBalance.toString());
  const [currencyInput, setCurrencyInput] = useState(sheetConfig.currency);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'code' | 'structure'>('setup');

  if (!isSettingsOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setHasCopiedCode(true);
      setTimeout(() => setHasCopiedCode(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestAndSave = async () => {
    setIsTesting(true);
    setTestResult(null);

    const trimmedUrl = urlInput.trim();
    const parsedBal = parseFloat(openingBalInput) || 0;

    updateSheetConfig({
      appsScriptUrl: trimmedUrl,
      initialOpeningBalance: parsedBal,
      currency: currencyInput.trim() || 'MRU',
    });

    if (!trimmedUrl) {
      setTestResult({
        success: true,
        message: 'Settings saved in Local Storage Ledger mode.',
      });
      setIsTesting(false);
      return;
    }

    const res = await testAppsScriptConnection(trimmedUrl);
    setTestResult(res);
    setIsTesting(false);

    if (res.success) {
      updateSheetConfig({ isConnected: true });
      await syncWithGoogleSheet();
    } else {
      updateSheetConfig({ isConnected: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#284742] text-white rounded-2xl shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-lg">
                Google Sheets & Apps Script Sync
              </h2>
              <p className="text-xs text-slate-500">
                Connect your Cash Flow spreadsheet to submit and view live data
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation within modal */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6">
          <button
            onClick={() => setActiveTab('setup')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'setup'
                ? 'border-[#284742] text-[#284742]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Setup Guide & Webhook URL
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-[#284742] text-[#284742]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Google Apps Script Code
          </button>
          <button
            onClick={() => setActiveTab('structure')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'structure'
                ? 'border-[#284742] text-[#284742]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Sheet Columns Structure
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[72vh] overflow-y-auto space-y-6">
          {activeTab === 'setup' && (
            <div className="space-y-6">
              {/* How it works banner */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Direct Google Sheet Integration via Apps Script:</strong> When connected, every transaction you submit in the form is instantly appended to your Google Sheet as a new row with date, account, ref, debit/credit, and updated balance.
                </div>
              </div>

              {/* Step by step checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Quick Setup in 4 Steps
                </h4>

                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Open your Google Sheet
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        In the top menu, go to <strong>Extensions</strong> → <strong>Apps Script</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Paste the Script Code
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Copy the code from the <strong>"Google Apps Script Code"</strong> tab, paste it into the editor, and click <strong>Save</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Deploy as Web App
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Click <strong>Deploy</strong> → <strong>New deployment</strong> → select <strong>Web app</strong>. Set <em>Execute as:</em> <strong>Me</strong> and <em>Who has access:</em> <strong>Anyone</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      4
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Paste the Web App URL below
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Copy the generated URL (starts with <code>https://script.google.com/macros/s/...</code>) and paste it below.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Web App URL Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Google Apps Script Web App URL
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Leave blank to use the built-in browser local storage ledger.
                </p>
              </div>

              {/* General Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Initial Opening Balance
                  </label>
                  <input
                    type="number"
                    value={openingBalInput}
                    onChange={e => setOpeningBalInput(e.target.value)}
                    placeholder="5585"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Matching initial balance from your sheet ({openingBalInput} {currencyInput})
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={currencyInput}
                    onChange={e => setCurrencyInput(e.target.value)}
                    placeholder="MRU"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    MRU (Mauritanian Ouguiya)
                  </p>
                </div>
              </div>

              {/* Test Connection Results */}
              {testResult && (
                <div
                  className={`p-4 rounded-2xl text-xs border flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{testResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Apps Script Code Snippet
                  </h4>
                  <p className="text-xs text-slate-500">
                    Paste this into your Google Sheet's Apps Script editor
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#284742] hover:bg-[#1e3632] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  {hasCopiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                  <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Google Sheet Columns Structure
                </h4>
                <p className="text-xs text-slate-500">
                  Matches your Cash Flow sheet structure with automatic row creation:
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#284742] text-white font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Col</th>
                      <th className="py-2.5 px-4">Header</th>
                      <th className="py-2.5 px-4">Example Value</th>
                      <th className="py-2.5 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr className="bg-white">
                      <td className="py-2 px-4 font-bold text-slate-500">A</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Timestamp</td>
                      <td className="py-2 px-4 text-slate-600">2026-11-09 12:30:15</td>
                      <td className="py-2 px-4 font-sans text-slate-600">Exact date and time stamp</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-4 font-bold text-slate-500">B</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Date</td>
                      <td className="py-2 px-4 text-slate-600">2026-11-09</td>
                      <td className="py-2 px-4 font-sans text-slate-600">Entry transaction date</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="py-2 px-4 font-bold text-slate-500">C</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Client Code</td>
                      <td className="py-2 px-4 text-slate-600">C04</td>
                      <td className="py-2 px-4 font-sans text-slate-600">e.g. C01 to C33</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-4 font-bold text-slate-500">D</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Client Name</td>
                      <td className="py-2 px-4 text-slate-600" dir="auto">الاماسي</td>
                      <td className="py-2 px-4 font-sans text-slate-600">Arabic or English client name</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="py-2 px-4 font-bold text-slate-500">E</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Ref No.</td>
                      <td className="py-2 px-4 text-slate-600">C022 / D001</td>
                      <td className="py-2 px-4 font-sans text-slate-600">Reference identifier</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-4 font-bold text-slate-500">F</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Description</td>
                      <td className="py-2 px-4 text-slate-600 font-sans" dir="auto">جزء من فاتورة</td>
                      <td className="py-2 px-4 font-sans text-slate-600">Transaction details</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="py-2 px-4 font-bold text-slate-500">G</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Type {'{in/out}'}</td>
                      <td className="py-2 px-4 text-emerald-700 font-bold">in / out</td>
                      <td className="py-2 px-4 font-sans text-slate-600">Exact &quot;in&quot; for inflow or &quot;out&quot; for outflow (matches Snapshot formula)</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-4 font-bold text-slate-500">H</td>
                      <td className="py-2 px-4 font-bold text-slate-800">Amount</td>
                      <td className="py-2 px-4 text-slate-900 font-bold">20000000</td>
                      <td className="py-2 px-4 font-sans text-slate-600">Transaction amount in SDG</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleTestAndSave}
            disabled={isTesting}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#284742] hover:bg-[#1e3632] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            {isTesting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Save & Test Connection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
