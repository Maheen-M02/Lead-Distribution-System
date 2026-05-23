'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'success' | 'error' | 'info' | 'warn';
  message: string;
  detail?: string;
}

function LogLine({ entry }: { entry: LogEntry }) {
  const colors = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-slate-400',
    warn: 'text-amber-400',
  };
  const prefixes = { success: '✓', error: '✗', info: '›', warn: '⚠' };

  return (
    <div className={`text-xs font-mono py-1 border-b border-white/[0.03] ${colors[entry.type]}`}>
      <span className="text-slate-600">[{entry.timestamp}]</span>{' '}
      <span>{prefixes[entry.type]}</span>{' '}
      <span>{entry.message}</span>
      {entry.detail && <span className="text-slate-600 ml-2">— {entry.detail}</span>}
    </div>
  );
}

const SERVICES = [
  { id: 1, name: 'Service 1' },
  { id: 2, name: 'Service 2' },
  { id: 3, name: 'Service 3' },
];

const CITIES = ['Mumbai', 'Delhi', 'Pune', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur'];

function randomPhone() {
  return '9' + String(Math.floor(100000000 + Math.random() * 900000000));
}

function randomName() {
  const names = ['Arjun Sharma', 'Priya Patel', 'Rahul Gupta', 'Neha Singh', 'Vikram Rao', 'Ananya Kumar', 'Rohit Joshi', 'Kavya Nair', 'Suresh Reddy', 'Meera Iyer'];
  return names[Math.floor(Math.random() * names.length)];
}

export default function TestToolsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);
  const [loadingConcurrency, setLoadingConcurrency] = useState(false);
  const [webhookCallCount, setWebhookCallCount] = useState(0);
  const [idempotencyEventId, setIdempotencyEventId] = useState('');

  useEffect(() => {
    setIdempotencyEventId(uuidv4());
  }, []);

  const addLog = (type: LogEntry['type'], message: string, detail?: string) => {
    setLogs((prev) => [
      {
        id: uuidv4(),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
        detail,
      },
      ...prev.slice(0, 199),
    ]);
  };

  // 1. Reset all quotas via webhook
  const handleQuotaReset = async () => {
    setLoadingReset(true);
    addLog('info', 'Sending quota reset webhook...');
    try {
      const eventId = uuidv4();
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, eventType: 'quota_reset' }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('success', data.message, `eventId: ${eventId.slice(0, 8)}…`);
      } else {
        addLog('error', data.error || 'Webhook failed');
      }
    } catch {
      addLog('error', 'Network error during webhook call');
    } finally {
      setLoadingReset(false);
    }
  };

  // 1b. Clear all leads and reset quotas
  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete all leads, assignments, and reset all quotas? This cannot be undone.')) {
      return;
    }
    setLoadingClear(true);
    addLog('info', 'Sending request to clear all lead data and reset quotas...');
    try {
      const eventId = uuidv4();
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, eventType: 'clear_data' }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('success', data.message, `eventId: ${eventId.slice(0, 8)}…`);
      } else {
        addLog('error', data.error || 'Request failed');
      }
    } catch {
      addLog('error', 'Network error during database cleanup request');
    } finally {
      setLoadingClear(false);
    }
  };

  // 2. Idempotency test — call same webhook multiple times
  const handleIdempotencyTest = async () => {
    addLog('info', `Calling webhook 3× with same eventId: ${idempotencyEventId.slice(0, 8)}…`);
    for (let i = 1; i <= 3; i++) {
      try {
        const res = await fetch('/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: idempotencyEventId,
            eventType: 'quota_reset',
          }),
        });
        const data = await res.json();
        setWebhookCallCount((c) => c + 1);
        if (data.alreadyProcessed) {
          addLog('warn', `Call #${i} — idempotent skip`, data.message);
        } else {
          addLog('success', `Call #${i} — processed`, data.message);
        }
      } catch {
        addLog('error', `Call #${i} — network error`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    addLog('info', 'Idempotency test complete — only 1 actual reset should have occurred');
  };

  // 3. Generate 10 concurrent leads
  const handleConcurrencyTest = async () => {
    setLoadingConcurrency(true);
    addLog('info', 'Generating 10 leads simultaneously...');

    const requests = Array.from({ length: 10 }, (_, i) => {
      const service = SERVICES[i % 3];
      return fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: randomName(),
          phone: randomPhone(),
          city: CITIES[i % CITIES.length],
          serviceId: service.id,
          description: `Test lead #${i + 1} for concurrency testing — ${service.name}`,
        }),
      });
    });

    try {
      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map((r) => r.json()));

      let successCount = 0;
      let errorCount = 0;

      results.forEach((result, i) => {
        if (result.success) {
          successCount++;
          addLog(
            'success',
            `Lead #${i + 1} — ${SERVICES[i % 3].name}`,
            `Assigned to: ${result.data?.assignedProviders?.map((id: number) => `P${id}`).join(', ')}`
          );
        } else {
          errorCount++;
          addLog('error', `Lead #${i + 1} failed`, result.error);
        }
      });

      addLog(
        successCount > 0 ? 'success' : 'error',
        `Concurrency test complete — ${successCount} success, ${errorCount} errors`
      );
    } catch {
      addLog('error', 'Concurrency test failed — network error');
    } finally {
      setLoadingConcurrency(false);
    }
  };

  // 4. Test duplicate lead detection
  const handleDuplicateTest = async () => {
    const phone = '8888888888';
    const serviceId = 1;
    addLog('info', `Testing duplicate detection — phone: ${phone}, service: Service 1`);

    for (let i = 1; i <= 2; i++) {
      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'Test User',
            phone,
            city: 'Mumbai',
            serviceId,
            description: `Duplicate test attempt #${i}`,
          }),
        });
        const data = await res.json();
        if (data.success) {
          addLog('success', `Attempt #${i} — lead created`, `ID: ${data.data?.leadId?.slice(0, 8)}…`);
        } else {
          addLog(
            i === 2 ? 'warn' : 'error',
            `Attempt #${i} — ${data.error}`
          );
        }
      } catch {
        addLog('error', `Attempt #${i} — network error`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    addLog('info', 'Duplicate test complete — second attempt should have been rejected');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-10 px-6 relative">
      <div className="fixed top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-red-500/[0.02] blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-red-500/20 bg-red-500/5">
            <span className="text-xs text-red-400 uppercase tracking-widest font-medium">⚙ Internal</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-white">Test Tools</h1>
          <p className="text-sm text-slate-500 mt-1">
            Webhook simulation, idempotency verification, and stress testing panel.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Action Panel */}
          <div className="space-y-4 animate-slide-up">
            {/* Quota Reset */}
            <div className="glass rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Reset Provider Quota</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Simulates a successful payment webhook. Resets all 8 providers to quota 10.
                  </p>
                </div>
                <span className="tag tag-green">Webhook</span>
              </div>
              <div className="glass-light rounded-lg p-3 mb-4 text-xs font-mono text-slate-400 space-y-0.5">
                <div><span className="text-slate-600">POST</span> /api/webhook</div>
                <div><span className="text-slate-600">body:</span> {'{'}  eventType: &quot;quota_reset&quot; {'}'}</div>
              </div>
              <button
                className="btn-primary w-full text-sm"
                onClick={handleQuotaReset}
                disabled={loadingReset}
              >
                {loadingReset ? 'Resetting…' : 'Reset All Quotas → 10'}
              </button>
            </div>

            {/* Clear All Lead Data */}
            <div className="glass rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Clear All Lead Data</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Deletes all leads, assignments, and resets provider quotas/allocation states to start completely fresh.
                  </p>
                </div>
                <span className="tag tag-red">Database</span>
              </div>
              <div className="glass-light rounded-lg p-3 mb-4 text-xs font-mono text-slate-400 space-y-0.5">
                <div><span className="text-slate-600">POST</span> /api/webhook</div>
                <div><span className="text-slate-600">body:</span> {'{'}  eventType: &quot;clear_data&quot; {'}'}</div>
              </div>
              <button
                className="btn-danger w-full text-sm"
                onClick={handleClearData}
                disabled={loadingClear}
              >
                {loadingClear ? 'Clearing…' : 'Clear All Leads & Reset Quotas'}
              </button>
            </div>

            {/* Idempotency Test */}
            <div className="glass rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Idempotency Test</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Calls the same webhook 3× with an identical eventId. Only the first call should take effect.
                  </p>
                </div>
                <span className="tag tag-amber">Safety</span>
              </div>
              <div className="glass-light rounded-lg p-3 mb-4 text-xs">
                <div className="text-xs text-slate-500 mb-1">Fixed Event ID for this session:</div>
                <div className="font-mono text-amber-400 text-[11px] break-all">{idempotencyEventId}</div>
                {webhookCallCount > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Called <span className="text-white">{webhookCallCount}×</span> this session
                  </div>
                )}
              </div>
              <button
                className="btn-secondary w-full text-sm"
                onClick={handleIdempotencyTest}
              >
                Call Webhook 3×
              </button>
            </div>

            {/* Concurrency Test */}
            <div className="glass rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Concurrency Test</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Fires 10 lead creation requests simultaneously. Tests serializable transaction handling.
                  </p>
                </div>
                <span className="tag tag-blue">Stress</span>
              </div>
              <button
                className="btn-primary w-full text-sm"
                onClick={handleConcurrencyTest}
                disabled={loadingConcurrency}
              >
                {loadingConcurrency ? 'Generating…' : 'Generate 10 Leads Simultaneously'}
              </button>
            </div>

            {/* Duplicate Test */}
            <div className="glass rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Duplicate Lead Test</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Submits the same phone + service twice. Second attempt must be rejected by DB constraint.
                  </p>
                </div>
                <span className="tag tag-red">Validation</span>
              </div>
              <button
                className="btn-danger w-full text-sm"
                onClick={handleDuplicateTest}
              >
                Test Duplicate Detection
              </button>
            </div>
          </div>

          {/* Log Console */}
          <div className="animate-slide-up delay-200">
            <div className="glass rounded-2xl border border-white/[0.06] h-full flex flex-col">
              <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-xs text-slate-500 ml-2 font-mono">system.log</span>
                </div>
                <button
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  onClick={() => setLogs([])}
                >
                  Clear
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 min-h-[400px] max-h-[600px]">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-700 font-mono">
                    Waiting for actions…
                  </div>
                ) : (
                  <div className="space-y-0">
                    {logs.map((entry) => (
                      <LogLine key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="mt-6 glass-light rounded-xl p-4 border border-amber-500/10 animate-slide-up delay-300">
          <div className="flex gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
              <circle cx="8" cy="8" r="7" stroke="#f59e0b" strokeWidth="1.5"/>
              <path d="M8 5v4M8 11v.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="text-xs text-slate-400 space-y-1">
              <p><span className="text-white font-medium">Quota resets</span> only occur through the webhook endpoint — never triggered by the normal user form.</p>
              <p><span className="text-white font-medium">Idempotency</span> is enforced via a unique <code className="text-amber-400">WebhookEvent</code> record per eventId in the database.</p>
              <p><span className="text-white font-medium">Concurrency</span> is handled with PostgreSQL serializable transactions — each allocation is atomic.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
