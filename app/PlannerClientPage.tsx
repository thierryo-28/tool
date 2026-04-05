'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent
} from 'lz-string';
import {
  CapacityOutput,
  GlobalSettings,
  HiringWave,
  RoleAssumption,
  BaselineHeadcount,
  RoleId,
  SelectedRoles,
  DemandSettings,
  DemandOutput,
  PipelineSettings,
  PipelineOutput,
  SdrRoleAssumption,
  SdrHiringWave,
  SdrCapacityOutput
} from '@/lib/types';
import { calculateCapacity } from '@/lib/capacityEngine';
import { calculateSdrCapacity } from '@/lib/sdrCapacityEngine';
import { calculateDemandPlan } from '@/lib/demandEngine';
import { calculatePipelinePlan } from '@/lib/pipelineEngine';
import { GlobalSettingsForm } from './components/GlobalSettingsForm';
import { RoleAssumptionsTable } from './components/RoleAssumptionsTable';
import { HiringPlanTable } from './components/HiringPlanTable';
import { SdrHiringPlanTable } from './components/SdrHiringPlanTable';
import { SdrRoleAssumptionsTable } from './components/SdrRoleAssumptionsTable';
import { BaselineForm } from './components/BaselineForm';
import { Header } from './components/Header';
import { ResultsSummary } from './components/ResultsSummary';
import { ResultsTable } from './components/ResultsTable';
import { CurrencyInput } from './components/CurrencyInput';
import { PipelineSettingsForm } from './components/PipelineSettingsForm';
import { PipelineResults } from './components/PipelineResults';
import { SavedViewsToolbar } from './components/SavedViewsToolbar';
import { WorkspaceAdminPanel } from './components/WorkspaceAdminPanel';
import {
  mergePlannerGlobals,
  plannerGlobalsFromSettings,
  type TabViewPayload
} from '@/lib/plannerViewPayloads';

/** Jan 1 of the current calendar year (UTC noon so YYYY-MM-DD stays correct in every TZ). */
function firstDayOfCurrentYearIso(): string {
  const y = new Date().getFullYear();
  return `${y}-01-01T12:00:00.000Z`;
}

function defaultGlobalSettings(): GlobalSettings {
  return {
    fiscalYearStart: firstDayOfCurrentYearIso(),
    months: 12,
    companyTargetAnnual: 10_000_000,
    overAssignmentPct: 0.2,
    seasonality: {
      quarterWeightsPct: [25, 25, 25, 25],
      withinQuarterPct: [33, 33, 34]
    }
  };
}

function defaultRoles(): RoleAssumption[] {
  return [
    {
      id: 'AE',
      name: 'Account Executive',
      annualQuota: 1_000_000,
      rampMonths: 4,
      rampPattern: [0.25, 0.5, 0.75, 1],
      annualAttritionPct: 0.1
    },
    {
      id: 'AM',
      name: 'Account Manager',
      annualQuota: 1_000_000,
      rampMonths: 4,
      rampPattern: [0.25, 0.5, 0.75, 1],
      annualAttritionPct: 0.1
    }
  ];
}

function defaultHiringPlan(): HiringWave[] {
  const now = new Date();
  const feb = new Date(now.getFullYear(), 1, 1).toISOString();
  return [
    { roleId: 'AE', count: 3, startDate: feb },
    { roleId: 'AM', count: 2, startDate: feb }
  ];
}

function defaultBaseline(): BaselineHeadcount {
  return {
    AE: 5,
    AM: 2
  };
}

function defaultDemandSettings(): DemandSettings {
  return {
    yearlyPaidMediaBudget: 1_000_000,
    mqlFromPaidPct: 50,
    mqlFromFreePct: 50,
    targetCpl: 500,
    mqlToOpportunityCr: 20,
    opportunityToWonCr: 25,
    yearlyRevenueTarget: 10_000_000,
    inboundRevenuePct: 60,
    outboundRevenuePct: 40,
    averageDealSize: 50_000
  };
}

function defaultPipelineSettings(): PipelineSettings {
  return {
    yearlyRevenueTargetExisting: 5_000_000,
    yearlyRevenueTargetNew: 5_000_000,
    inboundRevenuePct: 60,
    outboundRevenuePct: 40,
    opportunityToWonCrExisting: 25,
    opportunityToWonCrNew: 25,
    averageDealSizeExisting: 50_000,
    averageDealSizeNew: 50_000,
    // Default: ~3 months sales cycle
    salesCycleWeeks: 12
  };
}

function defaultSdrSettings(): GlobalSettings {
  return {
    fiscalYearStart: firstDayOfCurrentYearIso(),
    months: 12,
    companyTargetAnnual: 1000,
    overAssignmentPct: 0.2,
    seasonality: {
      quarterWeightsPct: [25, 25, 25, 25],
      withinQuarterPct: [33, 33, 34]
    }
  };
}

function defaultSdrRole(): SdrRoleAssumption {
  return {
    id: 'SDR',
    name: 'Sales Development Rep',
    annualQuota: 100,
    rampMonths: 4,
    rampPattern: [0.25, 0.5, 0.75, 1],
    annualAttritionPct: 0.12
  };
}

function defaultSdrWaves(): SdrHiringWave[] {
  const now = new Date();
  const feb = new Date(now.getFullYear(), 1, 1).toISOString();
  return [{ count: 2, startDate: feb }];
}

type WorkspaceAccessRole = 'admin' | 'user' | 'viewer' | null | 'loading';

export default function PlannerClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, userId } = useAuth();

  const defaultWorkspaceId = (
    process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? ''
  ).trim();
  const [workspaceAccessRole, setWorkspaceAccessRole] =
    useState<WorkspaceAccessRole>('loading');

  const [settings, setSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [roles, setRoles] = useState<RoleAssumption[]>(defaultRoles);
  const [waves, setWaves] = useState<HiringWave[]>(defaultHiringPlan);
  const [baseline, setBaseline] = useState<BaselineHeadcount>(defaultBaseline);
  const [selectedRoles, setSelectedRoles] = useState<SelectedRoles>({
    AE: true,
    AM: true
  });
  const [showResults, setShowResults] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false);

  type TabId = 'home' | 'capacity' | 'sdr' | 'demand' | 'pipeline' | 'admin';
  const [activeTab, setActiveTab] = useState<TabId>('home');

  const [demandSettings, setDemandSettings] = useState<DemandSettings>(
    defaultDemandSettings
  );

  const [pipelineSettings, setPipelineSettings] = useState<PipelineSettings>(
    defaultPipelineSettings()
  );

  const [sdrSettings, setSdrSettings] = useState<GlobalSettings>(defaultSdrSettings);
  const [sdrRole, setSdrRole] = useState<SdrRoleAssumption>(defaultSdrRole);
  const [sdrWaves, setSdrWaves] = useState<SdrHiringWave[]>(defaultSdrWaves);
  const [sdrBaseline, setSdrBaseline] = useState(4);
  const [sdrShowResults, setSdrShowResults] = useState(false);

  const isWorkspaceAdmin = workspaceAccessRole === 'admin';

  useEffect(() => {
    if (!isLoaded) return;
    if (!defaultWorkspaceId) {
      setWorkspaceAccessRole(null);
      return;
    }
    if (!userId) {
      setWorkspaceAccessRole(null);
      return;
    }

    // Clear any role from a previous Clerk user so we never show Admin until
    // this session's role is loaded (avoids stale "admin" after account switch).
    setWorkspaceAccessRole('loading');

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/workspaces/${encodeURIComponent(defaultWorkspaceId)}/access`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (cancelled) return;
        if (!res.ok) {
          setWorkspaceAccessRole(null);
          return;
        }
        const data = (await res.json()) as { role?: unknown };
        if (cancelled) return;
        const r = data.role;
        if (r === 'admin' || r === 'user' || r === 'viewer') {
          setWorkspaceAccessRole(r);
        } else {
          setWorkspaceAccessRole(null);
        }
      } catch {
        if (!cancelled) setWorkspaceAccessRole(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, defaultWorkspaceId]);

  useEffect(() => {
    if (workspaceAccessRole === 'loading') return;
    if (activeTab === 'admin' && workspaceAccessRole !== 'admin') {
      setActiveTab('home');
    }
  }, [activeTab, workspaceAccessRole]);

  const activeRoles = useMemo(
    () => roles.filter((r) => selectedRoles[r.id]),
    [roles, selectedRoles]
  );

  const activeWaves = useMemo(
    () => waves.filter((w) => selectedRoles[w.roleId]),
    [waves, selectedRoles]
  );

  const activeBaseline = useMemo(() => {
    const next: BaselineHeadcount = {
      AE: selectedRoles.AE ? baseline.AE : 0,
      AM: selectedRoles.AM ? baseline.AM : 0
    };
    return next;
  }, [baseline, selectedRoles]);

  const data: CapacityOutput | null = useMemo(() => {
    if (!showResults) return null;
    return calculateCapacity(settings, activeRoles, activeWaves, activeBaseline);
  }, [settings, activeRoles, activeWaves, activeBaseline, showResults]);

  const sdrData: SdrCapacityOutput | null = useMemo(() => {
    if (!sdrShowResults) return null;
    return calculateSdrCapacity(sdrSettings, sdrRole, sdrWaves, sdrBaseline);
  }, [sdrSettings, sdrRole, sdrWaves, sdrBaseline, sdrShowResults]);

  const handleActiveRolesChange = (updatedActive: RoleAssumption[]) => {
    setRoles((prev) => {
      const byId = new Map<RoleId, RoleAssumption>(
        updatedActive.map((r) => [r.id, r])
      );
      return prev.map((r) => byId.get(r.id) ?? r);
    });
  };

  const toggleRole = (roleId: RoleId) => {
    setSelectedRoles((prev) => {
      const nextSelected = !prev[roleId];

      if (!nextSelected) {
        setBaseline((b) => ({ ...b, [roleId]: 0 }));
        setWaves((w) => w.filter((wave) => wave.roleId !== roleId));
      }

      return { ...prev, [roleId]: nextSelected };
    });
  };

  const handleRecalculate = () => {
    setShowResults(true);
  };

  const handleSdrRecalculate = () => {
    setSdrShowResults(true);
  };

  useEffect(() => {
    if (hydratedFromUrl) return;
    const view = searchParams.get('view');
    if (!view) {
      setHydratedFromUrl(true);
      return;
    }
    try {
      const json = decompressFromEncodedURIComponent(view);
      if (!json) {
        setHydratedFromUrl(true);
        return;
      }
      const parsed = JSON.parse(json) as {
        settings: GlobalSettings;
        roles: RoleAssumption[];
        waves: HiringWave[];
        baseline: BaselineHeadcount;
        selectedRoles: SelectedRoles;
        activeTab?: TabId;
        demandSettings?: DemandSettings;
        pipelineSettings?: PipelineSettings;
        showResults?: boolean;
        sdrSettings?: GlobalSettings;
        sdrRole?: SdrRoleAssumption;
        sdrWaves?: SdrHiringWave[];
        sdrBaseline?: number;
        sdrShowResults?: boolean;
      };
      if (parsed.settings) setSettings(parsed.settings);
      if (parsed.roles) setRoles(parsed.roles);
      if (parsed.waves) setWaves(parsed.waves);
      if (parsed.baseline) setBaseline(parsed.baseline);
      if (parsed.selectedRoles) setSelectedRoles(parsed.selectedRoles);
      if (parsed.activeTab) setActiveTab(parsed.activeTab);
      if (parsed.demandSettings) setDemandSettings(parsed.demandSettings);
      if (parsed.pipelineSettings) setPipelineSettings(parsed.pipelineSettings);
      if (typeof parsed.showResults === 'boolean') setShowResults(parsed.showResults);
      if (parsed.sdrSettings) setSdrSettings(parsed.sdrSettings);
      if (parsed.sdrRole) setSdrRole(parsed.sdrRole);
      if (parsed.sdrWaves) setSdrWaves(parsed.sdrWaves);
      if (typeof parsed.sdrBaseline === 'number') setSdrBaseline(parsed.sdrBaseline);
      if (typeof parsed.sdrShowResults === 'boolean') setSdrShowResults(parsed.sdrShowResults);
    } catch {
      // ignore malformed view
    } finally {
      setHydratedFromUrl(true);
    }
  }, [hydratedFromUrl, searchParams]);

  const saveViewToUrl = () => {
    const payload = {
      settings,
      roles,
      waves,
      baseline,
      selectedRoles,
      showResults,
      activeTab,
      demandSettings,
      pipelineSettings,
      sdrSettings,
      sdrRole,
      sdrWaves,
      sdrBaseline,
      sdrShowResults
    };
    const encoded = compressToEncodedURIComponent(JSON.stringify(payload));
    router.replace(`?view=${encoded}`);
  };

  const copyLink = async () => {
    saveViewToUrl();
    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
      } catch {
        // ignore
      }
    }, 50);
  };

  const downloadPdf = () => {
    window.print();
  };

  const demandData: DemandOutput = useMemo(
    () => calculateDemandPlan(settings, demandSettings),
    [settings, demandSettings]
  );

  const pipelineData: PipelineOutput = useMemo(
    () => calculatePipelinePlan(settings, pipelineSettings),
    [settings, pipelineSettings]
  );

  const getPlannerTabPayload = (): TabViewPayload => {
    if (activeTab === 'capacity') {
      return {
        kind: 'capacity',
        settings,
        roles,
        waves,
        baseline,
        selectedRoles,
        showResults
      };
    }
    if (activeTab === 'demand') {
      return {
        kind: 'demand',
        globals: plannerGlobalsFromSettings(settings),
        demandSettings
      };
    }
    if (activeTab === 'pipeline') {
      return {
        kind: 'pipeline',
        globals: plannerGlobalsFromSettings(settings),
        pipelineSettings
      };
    }
    if (activeTab === 'sdr') {
      return {
        kind: 'sdr',
        settings: sdrSettings,
        sdrRole,
        sdrWaves,
        sdrBaseline,
        showResults: sdrShowResults
      };
    }
    throw new Error('Named views are only available on planner tabs.');
  };

  const applyTabPayload = (payload: TabViewPayload) => {
    if (payload.kind === 'capacity') {
      setSettings(payload.settings);
      setRoles(payload.roles);
      setWaves(payload.waves);
      setBaseline(payload.baseline);
      setSelectedRoles(payload.selectedRoles);
      setShowResults(payload.showResults);
      return;
    }
    if (payload.kind === 'demand') {
      setSettings((s) => mergePlannerGlobals(s, payload.globals));
      setDemandSettings(payload.demandSettings);
      return;
    }
    if (payload.kind === 'sdr') {
      setSdrSettings(payload.settings);
      setSdrRole(payload.sdrRole);
      setSdrWaves(payload.sdrWaves);
      setSdrBaseline(payload.sdrBaseline);
      setSdrShowResults(payload.showResults);
      return;
    }
    setSettings((s) => mergePlannerGlobals(s, payload.globals));
    setPipelineSettings(payload.pipelineSettings);
  };

  return (
    <main>
      <Header
        rightText="Revenue Planning Tools"
        onSaveToUrl={saveViewToUrl}
        onCopyLink={copyLink}
        onDownloadPdf={downloadPdf}
        linkCopied={linkCopied}
      />
      <div className="tabs no-print">
        <button
          type="button"
          className={activeTab === 'home' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
        <button
          type="button"
          className={activeTab === 'capacity' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('capacity')}
        >
          Sales Capacity
        </button>
        <button
          type="button"
          className={activeTab === 'sdr' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('sdr')}
        >
          SDR Capacity
        </button>
        <button
          type="button"
          className={activeTab === 'demand' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('demand')}
        >
          Demand Generation
        </button>
        <button
          type="button"
          className={activeTab === 'pipeline' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('pipeline')}
        >
          Pipeline Planner
        </button>
        {isWorkspaceAdmin ? (
          <button
            type="button"
            className={activeTab === 'admin' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('admin')}
          >
            Admin
          </button>
        ) : null}
      </div>

      {activeTab === 'capacity' ? (
        <SavedViewsToolbar
          tab="capacity"
          getPayload={getPlannerTabPayload}
          onApply={applyTabPayload}
        />
      ) : activeTab === 'sdr' ? (
        <SavedViewsToolbar
          tab="sdr"
          getPayload={getPlannerTabPayload}
          onApply={applyTabPayload}
        />
      ) : activeTab === 'demand' ? (
        <SavedViewsToolbar
          tab="demand"
          getPayload={getPlannerTabPayload}
          onApply={applyTabPayload}
        />
      ) : activeTab === 'pipeline' ? (
        <SavedViewsToolbar
          tab="pipeline"
          getPayload={getPlannerTabPayload}
          onApply={applyTabPayload}
        />
      ) : null}

      {activeTab === 'sdr' && (
        <div className="subtitle">
          <h2 style={{ margin: '0 0 12px', fontSize: '1.25rem' }}>
            SDR Capacity Planner
          </h2>
          <div style={{ marginBottom: 10 }}>
            Model how many Sales Development Representatives you need to meet an
            annual SQL target, using the same ramp, baseline headcount, hiring
            waves, and over-assignment logic as Sales Capacity — with SQLs instead
            of revenue.
          </div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Definitions:</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Annual org SQL target</strong>: total SQLs the SDR team
              should generate over the fiscal period (spread by seasonality).
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Annual SQL quota (per rep)</strong>: expected SQLs per fully
              ramped SDR per year.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Attrition</strong> and <strong>ramp</strong>: same meaning as
              in Sales Capacity; productivity % is % of full monthly SQL quota.
            </li>
            <li>
              <strong>Over-assignment</strong>: cushion between productive
              capacity and assigned quota (SQLs).
            </li>
          </ul>
        </div>
      )}

      {activeTab === 'capacity' && (
        <div className="subtitle">
          <h2 style={{ margin: '0 0 12px', fontSize: '1.25rem' }}>Sales Capacity Planner</h2>
          <div style={{ marginBottom: 10 }}>
            The tool helps you forecast how many salespeople and resources you
            need to hit your revenue targets by modeling headcount,
            productivity, and quotas.
          </div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Definitions:</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Attrition</strong>: enter average yearly attrition
              (percentage of team headcount you risk losing).
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Over-assignment</strong>: difference between your budget
              and the quotas you distribute.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Ramp time</strong>: number of months needed to be fully
              ramped and productive.
            </li>
            <li>
              <strong>Ramp by month</strong>: productivity expected in % of full
              quota.
            </li>
          </ul>
        </div>
      )}

      {activeTab === 'home' ? (
        <>
          <div className="subtitle">
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
              Revenue Planning Tools
            </h2>
            <div style={{ marginTop: 8 }}>
              Choose a planner to start: Sales Capacity, SDR Capacity, Demand
              Generation, or Pipeline Planner.
            </div>
          </div>
          <div className="grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Planner home</div>
                  <div className="panel-subtitle">
                    Quick access to each planning workflow
                  </div>
                </div>
              </div>
              <div className="button-row no-print" style={{ justifyContent: 'flex-start', gap: 8 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setActiveTab('capacity')}
                >
                  Open Sales Capacity
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setActiveTab('sdr')}
                >
                  Open SDR Capacity
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setActiveTab('demand')}
                >
                  Open Demand Generation
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setActiveTab('pipeline')}
                >
                  Open Pipeline Planner
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">What each tool does</div>
                  <div className="panel-subtitle">
                    Use the right planner for each phase
                  </div>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li style={{ marginBottom: 6 }}>
                  <strong>Sales Capacity</strong>: plan headcount and quotas to
                  hit target.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong>SDR Capacity</strong>: plan SDR headcount and SQL quotas
                  to hit an annual SQL target.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong>Demand Generation</strong>: plan MQL and pipeline
                  creation from funnel assumptions.
                </li>
                <li>
                  <strong>Pipeline Planner</strong>: plan weekly pipeline needs
                  from revenue and conversion inputs.
                </li>
              </ul>
            </section>
          </div>
        </>
      ) : activeTab === 'sdr' ? (
        <div className="grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Assumptions</div>
                <div className="panel-subtitle">
                  SQL targets, SDR productivity, baseline, and hiring waves
                </div>
              </div>
              <div className="chips-row">
                <span className="chip">
                  <span className="chip-dot" />
                  SDR · Ramp · Baseline · Attrition
                </span>
              </div>
            </div>

            <GlobalSettingsForm
              value={sdrSettings}
              onChange={setSdrSettings}
              variant="sql"
            />

            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <span className="badge">
                <span className="badge-dot" />
                SDR productivity
              </span>
            </div>
            <SdrRoleAssumptionsTable value={sdrRole} onChange={setSdrRole} />

            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <span className="badge">
                <span className="badge-dot" />
                Existing SDRs at fiscal start
              </span>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="sdr-baseline">SDR headcount at start</label>
                <input
                  id="sdr-baseline"
                  type="number"
                  min={0}
                  value={sdrBaseline}
                  onChange={(e) =>
                    setSdrBaseline(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <span className="badge">
                <span className="badge-dot" />
                Hiring plan
              </span>
            </div>
            <SdrHiringPlanTable value={sdrWaves} onChange={setSdrWaves} />

            <div className="button-row no-print">
              <button
                type="button"
                className="button"
                onClick={handleSdrRecalculate}
              >
                Calculate SDR capacity
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">SQL capacity vs target</div>
                <div className="panel-subtitle">
                  Annual view plus month-by-month breakdown (SQLs)
                </div>
              </div>
            </div>

            <ResultsSummary data={sdrData} variant="sql" />
            <ResultsTable
              data={sdrData}
              roleIds={['SDR']}
              variant="sql"
            />
          </section>
        </div>
      ) : activeTab === 'admin' && isWorkspaceAdmin ? (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div className="subtitle">
            <h2 style={{ margin: '0 0 12px', fontSize: '1.25rem' }}>
              Workspace Administrator
            </h2>
            <div>
              Manage access rights. Assign roles &apos;Admin&apos;, &apos;User&apos;, or
              &apos;Viewer&apos;
            </div>
          </div>
          <WorkspaceAdminPanel />
        </div>
      ) : activeTab === 'capacity' ? (
        <div className="grid">
          <section className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Assumptions</div>
              <div className="panel-subtitle">
                Targets, role productivity, and hiring waves
              </div>
            </div>
            <div className="chips-row">
              <span className="chip">
                <span className="chip-dot" />
                {activeRoles.length > 0
                  ? activeRoles.map((r) => r.id).join(' · ')
                  : 'No roles selected'}
              </span>
              <span className="chip">
                <span className="chip-dot" />
                Ramp · Existing team · Attrition
              </span>
            </div>
          </div>

          <div className="role-toggle-row no-print" aria-label="Role selection">
            <span className="role-toggle-label">Roles</span>
            <label className="role-toggle">
              <input
                type="checkbox"
                checked={selectedRoles.AE}
                onChange={() => toggleRole('AE')}
              />
              <span>AE</span>
            </label>
            <label className="role-toggle">
              <input
                type="checkbox"
                checked={selectedRoles.AM}
                onChange={() => toggleRole('AM')}
              />
              <span>AM</span>
            </label>
          </div>

          <GlobalSettingsForm value={settings} onChange={setSettings} />

          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <span className="badge">
              <span className="badge-dot" />
              Role productivity
            </span>
          </div>
          <RoleAssumptionsTable value={activeRoles} onChange={handleActiveRolesChange} />

          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <span className="badge">
              <span className="badge-dot" />
              Existing team at fiscal start
            </span>
          </div>
          <BaselineForm roles={activeRoles} value={activeBaseline} onChange={setBaseline} />

          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <span className="badge">
              <span className="badge-dot" />
              Hiring plan
            </span>
          </div>
          <HiringPlanTable roles={activeRoles} value={activeWaves} onChange={setWaves} />

          <div className="button-row no-print">
            <button type="button" className="button" onClick={handleRecalculate}>
              Calculate capacity
            </button>
          </div>
          </section>

          <section className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Capacity vs Target</div>
              <div className="panel-subtitle">
                Annual view plus month-by-month breakdown
              </div>
            </div>
          </div>

            <ResultsSummary data={data} />
            <ResultsTable data={data} roleIds={activeRoles.map((r) => r.id)} />
          </section>
        </div>
      ) : activeTab === 'demand' ? (
        <>
        <div className="subtitle">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Sales &amp; Marketing Funnel Planner</h2>
          <div style={{ marginTop: 8 }}>
            Plan your top of the funnel and your Marketing Qualified Leads needs
          </div>
        </div>
        <div className="grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Demand gen assumptions</div>
                <div className="panel-subtitle">
                  Budget, funnel conversion, and revenue mix
                </div>
              </div>
            </div>
            <div className="field-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="dg-rev">Yearly revenue target</label>
                <CurrencyInput
                  id="dg-rev"
                  value={demandSettings.yearlyRevenueTarget}
                  onChange={(n) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      yearlyRevenueTarget: n
                    }))
                  }
                  min={0}
                  placeholder="$0"
                />
              </div>
              <div className="field">
                <label htmlFor="dg-cpl">Target CPL (CPA)</label>
                <CurrencyInput
                  id="dg-cpl"
                  value={demandSettings.targetCpl}
                  onChange={(n) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      targetCpl: n
                    }))
                  }
                  min={0}
                  placeholder="$0"
                />
              </div>
              <div className="field">
                <label htmlFor="dg-budget">Yearly paid media budget</label>
                <CurrencyInput
                  id="dg-budget"
                  value={demandSettings.yearlyPaidMediaBudget}
                  onChange={(n) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      yearlyPaidMediaBudget: n
                    }))
                  }
                  min={0}
                  placeholder="$0"
                />
              </div>
              <div className="field">
                <label htmlFor="dg-mql-paid">% of MQL from paid</label>
                <input
                  id="dg-mql-paid"
                  type="number"
                  min={0}
                  max={100}
                  value={demandSettings.mqlFromPaidPct}
                  onChange={(e) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      mqlFromPaidPct: Number(e.target.value) || 0,
                      mqlFromFreePct:
                        100 - (Number(e.target.value) || 0)
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="dg-mql-free">% of MQL from free</label>
                <input
                  id="dg-mql-free"
                  type="number"
                  min={0}
                  max={100}
                  value={demandSettings.mqlFromFreePct}
                  onChange={(e) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      mqlFromFreePct: Number(e.target.value) || 0,
                      mqlFromPaidPct:
                        100 - (Number(e.target.value) || 0)
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="dg-mql-opp">
                  MQL → Opportunity conversion %
                </label>
                <input
                  id="dg-mql-opp"
                  type="number"
                  min={0}
                  max={100}
                  value={demandSettings.mqlToOpportunityCr}
                  onChange={(e) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      mqlToOpportunityCr: Number(e.target.value) || 0
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="dg-opp-won">
                  Opportunity → Won conversion %
                </label>
                <input
                  id="dg-opp-won"
                  type="number"
                  min={0}
                  max={100}
                  value={demandSettings.opportunityToWonCr}
                  onChange={(e) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      opportunityToWonCr: Number(e.target.value) || 0
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="dg-inbound">% revenue inbound</label>
                <input
                  id="dg-inbound"
                  type="number"
                  min={0}
                  max={100}
                  value={demandSettings.inboundRevenuePct}
                  onChange={(e) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      inboundRevenuePct: Number(e.target.value) || 0,
                      outboundRevenuePct:
                        100 - (Number(e.target.value) || 0)
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="dg-outbound">% revenue outbound</label>
                <input
                  id="dg-outbound"
                  type="number"
                  min={0}
                  max={100}
                  value={demandSettings.outboundRevenuePct}
                  onChange={(e) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      outboundRevenuePct: Number(e.target.value) || 0,
                      inboundRevenuePct:
                        100 - (Number(e.target.value) || 0)
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="dg-deal">Average deal size</label>
                <CurrencyInput
                  id="dg-deal"
                  value={demandSettings.averageDealSize}
                  onChange={(n) =>
                    setDemandSettings((prev) => ({
                      ...prev,
                      averageDealSize: n
                    }))
                  }
                  min={0}
                  placeholder="$0"
                />
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Demand gen outputs</div>
                <div className="panel-subtitle">
                  MQL and pipeline creation by month (inbound)
                </div>
              </div>
            </div>
            <div className="summary-row">
              <div className="summary-card">
                <div className="summary-label">Inbound MQLs / year</div>
                <div className="summary-value">
                  {Math.round(demandData.summary.mqlInboundYear).toLocaleString()}
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Paid MQLs / year</div>
                <div className="summary-value">
                  {Math.round(demandData.summary.mqlPaidYear).toLocaleString()}
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Opportunities / year</div>
                <div className="summary-value">
                  {Math.round(demandData.summary.opportunitiesYear).toLocaleString()}
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Pipeline / year</div>
                <div className="summary-value">
                  ${Math.round(demandData.summary.pipelineYear).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>MQL (total)</th>
                    <th>MQL paid</th>
                    <th>MQL free</th>
                    <th>Opps</th>
                    <th>Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {demandData.months.map((row) => {
                    const d = new Date(row.month);
                    const label = d.toLocaleDateString(undefined, {
                      month: 'short',
                      year: '2-digit'
                    });
                    return (
                      <tr key={row.month}>
                        <td>{label}</td>
                        <td>{Math.round(row.mqlTotal).toLocaleString()}</td>
                        <td>{Math.round(row.mqlPaid).toLocaleString()}</td>
                        <td>{Math.round(row.mqlFree).toLocaleString()}</td>
                        <td>{Math.round(row.opportunities).toLocaleString()}</td>
                        <td>
                          ${Math.round(row.pipeline).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        </>
      ) : (
        <div className="grid grid-pipeline">
          <PipelineSettingsForm value={pipelineSettings} onChange={setPipelineSettings} />
          <PipelineResults data={pipelineData} pipelineSettings={pipelineSettings} />
        </div>
      )}
    </main>
  );
}

