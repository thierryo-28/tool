'use client';

import React, { useEffect, useState } from 'react';
import {
  MAX_SDR_TEMPLATE_ROLES,
  MAX_SALES_TEMPLATE_ROLES,
  emptyProfilePlannerSettings,
  type ProfilePlannerSettings,
  type SalesRoleTemplateRow,
  type SdrRoleTemplateRow
} from '@/lib/profilePlannerSettings';
import { CurrencyInput } from './CurrencyInput';

function blankSalesRow(): SalesRoleTemplateRow {
  return {
    title: '',
    rampMonths: 4,
    defaultAnnualQuota: 1_000_000
  };
}

function blankSdrRow(): SdrRoleTemplateRow {
  return {
    title: '',
    rampMonths: 4,
    defaultAnnualSqlQuota: 100
  };
}

interface Props {
  isSignedIn: boolean;
  initial: ProfilePlannerSettings | null;
  onApplySales: (templates: SalesRoleTemplateRow[]) => void;
  onApplySdr: (templates: SdrRoleTemplateRow[]) => void;
  onSaved?: (settings: ProfilePlannerSettings) => void;
}

export const PlannerSettingsPanel: React.FC<Props> = ({
  isSignedIn,
  initial,
  onApplySales,
  onApplySdr,
  onSaved
}) => {
  const [draft, setDraft] = useState<ProfilePlannerSettings>(
    initial ?? emptyProfilePlannerSettings()
  );
  const [salesCountInput, setSalesCountInput] = useState(
    String(initial?.salesTemplates.length ?? 2)
  );
  const [sdrCountInput, setSdrCountInput] = useState(
    String(initial?.sdrTemplates.length ?? 1)
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initial ?? emptyProfilePlannerSettings());
    setSalesCountInput(String(initial?.salesTemplates.length ?? 2));
    setSdrCountInput(String(initial?.sdrTemplates.length ?? 1));
  }, [initial]);

  const persist = async () => {
    setError(null);
    setStatus(null);
    setSaving(true);
    try {
      const res = await fetch('/api/profile-planner-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: ProfilePlannerSettings;
      };
      if (!res.ok) {
        throw new Error(body.error ?? 'Save failed');
      }
      if (body.settings) {
        setDraft(body.settings);
        onSaved?.(body.settings);
      }
      setStatus('Settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const generateSalesRows = () => {
    const n = Math.min(
      MAX_SALES_TEMPLATE_ROLES,
      Math.max(1, Math.round(Number(salesCountInput) || 1))
    );
    setSalesCountInput(String(n));
    setDraft((prev) => ({
      ...prev,
      salesTemplates: Array.from({ length: n }, (_, i) => prev.salesTemplates[i] ?? blankSalesRow())
    }));
  };

  const generateSdrRows = () => {
    const n = Math.min(
      MAX_SDR_TEMPLATE_ROLES,
      Math.max(1, Math.round(Number(sdrCountInput) || 1))
    );
    setSdrCountInput(String(n));
    setDraft((prev) => ({
      ...prev,
      sdrTemplates: Array.from({ length: n }, (_, i) => prev.sdrTemplates[i] ?? blankSdrRow())
    }));
  };

  const salesApplyReady =
    draft.salesTemplates.length > 0 &&
    draft.salesTemplates.every((r) => r.title.trim().length > 0);
  const sdrApplyReady =
    draft.sdrTemplates.length > 0 &&
    draft.sdrTemplates.every((r) => r.title.trim().length > 0);
  const salesRowsValid =
    draft.salesTemplates.length === 0 ||
    draft.salesTemplates.every((r) => r.title.trim().length > 0);
  const sdrRowsValid =
    draft.sdrTemplates.length === 0 ||
    draft.sdrTemplates.every((r) => r.title.trim().length > 0);
  const canSave = salesRowsValid && sdrRowsValid;

  if (!isSignedIn) {
    return (
      <div className="subtitle">
        <p>
          Sign in to configure and save your personal planner defaults (sales
          roles and SDR roles).
        </p>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="subtitle">
        <h2 style={{ margin: '0 0 12px', fontSize: '1.25rem' }}>Configure</h2>
        <p style={{ marginTop: 0, lineHeight: 1.45 }}>
          Define your default Sales and SDR roles here. Save your templates,
          then apply them to each planner tab. You can still edit every value
          later in Sales Capacity and SDR Capacity.
        </p>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Sales capacity defaults</div>
            <div className="panel-subtitle">
              Up to {MAX_SALES_TEMPLATE_ROLES} roles — title, ramp (months),
              annual quota target ($)
            </div>
          </div>
        </div>
        <div className="field-grid" style={{ marginBottom: 12 }}>
          <div className="field">
            <label htmlFor="sales-role-count">Number of sales roles</label>
            <input
              id="sales-role-count"
              type="number"
              min={1}
              max={MAX_SALES_TEMPLATE_ROLES}
              value={salesCountInput}
              onChange={(e) => setSalesCountInput(e.target.value)}
            />
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={generateSalesRows}
            >
              Generate fields
            </button>
          </div>
        </div>
        {draft.salesTemplates.length === 0 ? (
          <p className="muted">Choose a count and click Generate fields.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Ramp (months)</th>
                  <th>Default annual quota ($)</th>
                </tr>
              </thead>
              <tbody>
                {draft.salesTemplates.map((row, idx) => (
                  <tr key={`sales-t-${idx.toString()}`}>
                    <td>
                      <input
                        type="text"
                        value={row.title}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft((prev) => {
                            const next = [...prev.salesTemplates];
                            next[idx] = { ...next[idx]!, title: v };
                            return { ...prev, salesTemplates: next };
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={row.rampMonths}
                        onChange={(e) => {
                          const v = Math.min(
                            12,
                            Math.max(1, Math.round(Number(e.target.value) || 1))
                          );
                          setDraft((prev) => {
                            const next = [...prev.salesTemplates];
                            next[idx] = { ...next[idx]!, rampMonths: v };
                            return { ...prev, salesTemplates: next };
                          });
                        }}
                      />
                    </td>
                    <td>
                      <CurrencyInput
                        id={`sales-template-quota-${idx.toString()}`}
                        value={row.defaultAnnualQuota}
                        onChange={(n) => {
                          const v = Math.max(0, n);
                          setDraft((prev) => {
                            const next = [...prev.salesTemplates];
                            next[idx] = { ...next[idx]!, defaultAnnualQuota: v };
                            return { ...prev, salesTemplates: next };
                          });
                        }}
                        min={0}
                        placeholder="$0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="button-row no-print" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="button button-secondary"
            disabled={!salesApplyReady}
            onClick={() => onApplySales(draft.salesTemplates)}
          >
            Apply to Sales Capacity now
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">SDR capacity defaults</div>
            <div className="panel-subtitle">
              Up to {MAX_SDR_TEMPLATE_ROLES} roles — title, ramp (months), default
              annual SQL quota per rep
            </div>
          </div>
        </div>
        <div className="field-grid" style={{ marginBottom: 12 }}>
          <div className="field">
            <label htmlFor="sdr-role-count">Number of SDR roles</label>
            <input
              id="sdr-role-count"
              type="number"
              min={1}
              max={MAX_SDR_TEMPLATE_ROLES}
              value={sdrCountInput}
              onChange={(e) => setSdrCountInput(e.target.value)}
            />
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={generateSdrRows}
            >
              Generate fields
            </button>
          </div>
        </div>
        {draft.sdrTemplates.length === 0 ? (
          <p className="muted">Choose a count and click Generate fields.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Ramp (months)</th>
                  <th>Default annual SQL quota</th>
                </tr>
              </thead>
              <tbody>
                {draft.sdrTemplates.map((row, idx) => (
                  <tr key={`sdr-t-${idx.toString()}`}>
                    <td>
                      <input
                        type="text"
                        value={row.title}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft((prev) => {
                            const next = [...prev.sdrTemplates];
                            next[idx] = { ...next[idx]!, title: v };
                            return { ...prev, sdrTemplates: next };
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={row.rampMonths}
                        onChange={(e) => {
                          const v = Math.min(
                            12,
                            Math.max(1, Math.round(Number(e.target.value) || 1))
                          );
                          setDraft((prev) => {
                            const next = [...prev.sdrTemplates];
                            next[idx] = { ...next[idx]!, rampMonths: v };
                            return { ...prev, sdrTemplates: next };
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.defaultAnnualSqlQuota}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setDraft((prev) => {
                            const next = [...prev.sdrTemplates];
                            next[idx] = {
                              ...next[idx]!,
                              defaultAnnualSqlQuota: v
                            };
                            return { ...prev, sdrTemplates: next };
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="button-row no-print" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="button button-secondary"
            disabled={!sdrApplyReady}
            onClick={() => onApplySdr(draft.sdrTemplates)}
          >
            Apply to SDR Capacity now
          </button>
        </div>
      </section>

      <div className="button-row no-print">
        <button
          type="button"
          className="button"
          disabled={saving || !canSave}
          onClick={persist}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p style={{ color: 'var(--danger, #c00)' }}>{error}</p> : null}
      {!canSave ? (
        <p className="muted" style={{ marginTop: 8 }}>
          Every generated role row needs a title before you can save (or clear
          generated rows).
        </p>
      ) : null}
    </div>
  );
};
