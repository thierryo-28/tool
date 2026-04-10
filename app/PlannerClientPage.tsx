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
  SdrCapacityOutput,
  SdrPipelineAssumptions
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
import { SdrPipelineAssumptionsForm } from './components/SdrPipelineAssumptionsForm';
import { BaselineForm } from './components/BaselineForm';
import { Header } from './components/Header';
import { ResultsSummary } from './components/ResultsSummary';
import { ResultsTable } from './components/ResultsTable';
import { CurrencyInput } from './components/CurrencyInput';
import { PipelineSettingsForm } from './components/PipelineSettingsForm';
import { PipelineResults } from './components/PipelineResults';
import { SavedViewsToolbar } from './components/SavedViewsToolbar';
import { WorkspaceAdminPanel } from './components/WorkspaceAdminPanel';
import type { SavedPlannerTab, SavedViewRecord } from '@/lib/savedViews';
import { listViewsForTab } from '@/lib/savedViews';
import {
  isRemoteViewsEnabled,
  listRemoteViewsForTab
} from '@/lib/remoteSavedViews';
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

function defaultSdrPipelineAssumptions(): SdrPipelineAssumptions {
  return {
    sqlToOpportunityPct: 100,
    averageOpportunitySize: 50_000,
    opportunityToWonPct: 25,
    salesCycleWeeks: 12
  };
}

type WorkspaceAccessRole = 'admin' | 'user' | 'viewer' | null | 'loading';
type SummarySelections = {
  demand: string;
  pipeline: string;
  sdr: string;
  capacity: string;
};

type SummarySelectedMeta = {
  demand: SavedViewRecord | null;
  pipeline: SavedViewRecord | null;
  sdr: SavedViewRecord | null;
  capacity: SavedViewRecord | null;
};

type SummaryRecipeRecord = {
  id: string;
  name: string;
  updatedAt: string;
  selections: SummarySelections;
};

const SUMMARY_RECIPES_STORAGE_KEY = 'revenuePlanner.summaryRecipes.v1';

function newSummaryRecipeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function loadSummaryRecipes(): SummaryRecipeRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(SUMMARY_RECIPES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is SummaryRecipeRecord =>
          !!row &&
          typeof row === 'object' &&
          typeof (row as SummaryRecipeRecord).id === 'string' &&
          typeof (row as SummaryRecipeRecord).name === 'string' &&
          typeof (row as SummaryRecipeRecord).updatedAt === 'string' &&
          typeof (row as SummaryRecipeRecord).selections === 'object'
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function persistSummaryRecipes(recipes: SummaryRecipeRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    SUMMARY_RECIPES_STORAGE_KEY,
    JSON.stringify(recipes)
  );
}

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

  type TabId =
    | 'home'
    | 'capacity'
    | 'sdr'
    | 'demand'
    | 'pipeline'
    | 'summary'
    | 'admin';
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
  const [sdrPipeline, setSdrPipeline] = useState<SdrPipelineAssumptions>(() =>
    defaultSdrPipelineAssumptions()
  );
  const [sdrShowResults, setSdrShowResults] = useState(false);
  const [summarySelections, setSummarySelections] = useState<SummarySelections>({
    demand: '',
    pipeline: '',
    sdr: '',
    capacity: ''
  });
  const [summaryViews, setSummaryViews] = useState<
    Record<SavedPlannerTab, SavedViewRecord[]>
  >({
    demand: [],
    pipeline: [],
    sdr: [],
    capacity: []
  });
  const [summaryWarnings, setSummaryWarnings] = useState<string[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryRecipeError, setSummaryRecipeError] = useState<string | null>(null);
  const [summaryModeNotice, setSummaryModeNotice] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [summaryShowDetails, setSummaryShowDetails] = useState(false);
  const [summarySelectedMeta, setSummarySelectedMeta] = useState<SummarySelectedMeta>({
    demand: null,
    pipeline: null,
    sdr: null,
    capacity: null
  });
  const [summaryRecipes, setSummaryRecipes] = useState<SummaryRecipeRecord[]>([]);
  const [summaryRecipeName, setSummaryRecipeName] = useState('');
  const [summaryRecipeLoadId, setSummaryRecipeLoadId] = useState('');
  const [summaryDemandOutput, setSummaryDemandOutput] = useState<DemandOutput | null>(
    null
  );
  const [summaryPipelineOutput, setSummaryPipelineOutput] =
    useState<PipelineOutput | null>(null);
  const [summarySdrOutput, setSummarySdrOutput] = useState<SdrCapacityOutput | null>(
    null
  );
  const [summaryCapacityOutput, setSummaryCapacityOutput] =
    useState<CapacityOutput | null>(null);

  const isWorkspaceAdmin = workspaceAccessRole === 'admin';

  const formatCurrency = (n: number): string =>
    `$${Math.round(n).toLocaleString()}`;

  const formatNumber = (n: number): string =>
    Math.round(n).toLocaleString();

  const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  const refreshSummaryViews = async () => {
    const tabs: SavedPlannerTab[] = ['demand', 'pipeline', 'sdr', 'capacity'];
    setSummaryLoading(true);
    if (!isRemoteViewsEnabled()) {
      setSummaryViews({
        demand: listViewsForTab('demand'),
        pipeline: listViewsForTab('pipeline'),
        sdr: listViewsForTab('sdr'),
        capacity: listViewsForTab('capacity')
      });
      setSummaryModeNotice(null);
      setSummaryLoading(false);
      return;
    }
    try {
      const [demandViews, pipelineViews, sdrViews, capacityViews] =
        await Promise.all(tabs.map((tab) => listRemoteViewsForTab(tab)));
      setSummaryViews({
        demand: demandViews,
        pipeline: pipelineViews,
        sdr: sdrViews,
        capacity: capacityViews
      });
      setSummaryModeNotice(null);
    } catch {
      setSummaryViews({
        demand: listViewsForTab('demand'),
        pipeline: listViewsForTab('pipeline'),
        sdr: listViewsForTab('sdr'),
        capacity: listViewsForTab('capacity')
      });
      setSummaryModeNotice('Using local saved views (remote unavailable).');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'summary') return;
    void refreshSummaryViews();
    setSummaryRecipes(loadSummaryRecipes());
  }, [activeTab]);

  useEffect(() => {
    setSummaryGenerated(false);
    setSummaryWarnings([]);
    setSummaryError(null);
  }, [summarySelections]);

  const handleSaveSummaryRecipe = () => {
    setSummaryRecipeError(null);
    const trimmed = summaryRecipeName.trim().slice(0, 80);
    if (!trimmed) {
      setSummaryRecipeError('Enter a recipe name.');
      return;
    }
    if (
      !summarySelections.demand ||
      !summarySelections.pipeline ||
      !summarySelections.sdr ||
      !summarySelections.capacity
    ) {
      setSummaryRecipeError('Select all four views before saving a recipe.');
      return;
    }
    const now = new Date().toISOString();
    const all = loadSummaryRecipes();
    const existing = all.find((r) => r.name.toLowerCase() === trimmed.toLowerCase());
    const next = existing
      ? all.map((r) =>
          r.id === existing.id
            ? {
                ...r,
                name: trimmed,
                updatedAt: now,
                selections: summarySelections
              }
            : r
        )
      : [
          ...all,
          {
            id: newSummaryRecipeId(),
            name: trimmed,
            updatedAt: now,
            selections: summarySelections
          }
        ];
    persistSummaryRecipes(next);
    setSummaryRecipes(loadSummaryRecipes());
    setSummaryRecipeName('');
  };

  const handleLoadSummaryRecipe = (id: string) => {
    if (!id) return;
    const recipe = summaryRecipes.find((r) => r.id === id);
    if (!recipe) {
      setSummaryRecipeError('Recipe not found.');
      return;
    }
    setSummaryRecipeError(null);
    setSummarySelections(recipe.selections);
    setSummaryRecipeLoadId('');
  };

  const handleGenerateSummary = () => {
    setSummaryError(null);
    setSummaryRecipeError(null);
    const selectedDemand = summaryViews.demand.find(
      (v) => v.id === summarySelections.demand
    );
    const selectedPipeline = summaryViews.pipeline.find(
      (v) => v.id === summarySelections.pipeline
    );
    const selectedSdr = summaryViews.sdr.find((v) => v.id === summarySelections.sdr);
    const selectedCapacity = summaryViews.capacity.find(
      (v) => v.id === summarySelections.capacity
    );

    if (!selectedDemand || !selectedPipeline || !selectedSdr || !selectedCapacity) {
      setSummaryError('Please select one saved view for each planner.');
      return;
    }

    const demandPayload = selectedDemand.payload;
    const pipelinePayload = selectedPipeline.payload;
    const sdrPayload = selectedSdr.payload;
    const capacityPayload = selectedCapacity.payload;

    if (
      demandPayload.kind !== 'demand' ||
      pipelinePayload.kind !== 'pipeline' ||
      sdrPayload.kind !== 'sdr' ||
      capacityPayload.kind !== 'capacity'
    ) {
      setSummaryError(
        'One selected view does not match its planner type. Please reselect views.'
      );
      return;
    }

    const demandGlobal = mergePlannerGlobals(defaultGlobalSettings(), demandPayload.globals);
    const pipelineGlobal = mergePlannerGlobals(
      defaultGlobalSettings(),
      pipelinePayload.globals
    );

    const nextDemand = calculateDemandPlan(demandGlobal, demandPayload.demandSettings);
    const nextPipeline = calculatePipelinePlan(
      pipelineGlobal,
      pipelinePayload.pipelineSettings
    );
    const nextSdr = calculateSdrCapacity(
      sdrPayload.settings,
      sdrPayload.sdrRole,
      sdrPayload.sdrWaves,
      sdrPayload.sdrBaseline,
      sdrPayload.sdrPipeline ?? defaultSdrPipelineAssumptions()
    );
    const nextCapacity = calculateCapacity(
      capacityPayload.settings,
      capacityPayload.roles,
      capacityPayload.waves,
      capacityPayload.baseline
    );

    const warningSet = new Set<string>();
    const fiscalStarts = [
      demandGlobal.fiscalYearStart,
      pipelineGlobal.fiscalYearStart,
      sdrPayload.settings.fiscalYearStart,
      capacityPayload.settings.fiscalYearStart
    ];
    const months = [
      demandGlobal.months,
      pipelineGlobal.months,
      sdrPayload.settings.months,
      capacityPayload.settings.months
    ];

    if (new Set(fiscalStarts).size > 1) {
      warningSet.add(
        'Selected views use different fiscal year start dates; month/week timelines may not align exactly.'
      );
    }
    if (new Set(months).size > 1) {
      warningSet.add(
        'Selected views use different planning horizons (months); totals are valid per planner but not perfectly time-aligned.'
      );
    }

    setSummaryWarnings(Array.from(warningSet));
    setSummarySelectedMeta({
      demand: selectedDemand,
      pipeline: selectedPipeline,
      sdr: selectedSdr,
      capacity: selectedCapacity
    });
    setSummaryDemandOutput(nextDemand);
    setSummaryPipelineOutput(nextPipeline);
    setSummarySdrOutput(nextSdr);
    setSummaryCapacityOutput(nextCapacity);
    setSummaryGenerated(true);
  };

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
    return calculateSdrCapacity(
      sdrSettings,
      sdrRole,
      sdrWaves,
      sdrBaseline,
      sdrPipeline
    );
  }, [sdrSettings, sdrRole, sdrWaves, sdrBaseline, sdrPipeline, sdrShowResults]);

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
        sdrPipeline?: SdrPipelineAssumptions;
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
      if (parsed.sdrPipeline) setSdrPipeline(parsed.sdrPipeline);
      if (typeof parsed.sdrShowResults === 'boolean')
        setSdrShowResults(parsed.sdrShowResults);
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
      sdrPipeline,
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
        sdrPipeline,
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
      setSdrPipeline(
        payload.sdrPipeline ?? defaultSdrPipelineAssumptions()
      );
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
        <button
          type="button"
          className={activeTab === 'sdr' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('sdr')}
        >
          SDR Capacity
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
          className={activeTab === 'summary' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('summary')}
        >
          Summary
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

      {activeTab === 'demand' ? (
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
      ) : activeTab === 'sdr' ? (
        <SavedViewsToolbar
          tab="sdr"
          getPayload={getPlannerTabPayload}
          onApply={applyTabPayload}
        />
      ) : activeTab === 'capacity' ? (
        <SavedViewsToolbar
          tab="capacity"
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
            <div style={{ marginTop: 8, lineHeight: 1.45 }}>
              Choose a planner to start: Demand Generation, Pipeline Planner, SDR
              Capacity, or Sales Capacity. Each planning tool works
              independently. Use the Summary tab to generate a consolidated and
              shareable view.
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
                  onClick={() => setActiveTab('capacity')}
                >
                  Open Sales Capacity
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
                  <strong>Demand Generation</strong>: plan MQL and pipeline
                  creation from funnel assumptions.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong>Pipeline Planner</strong>: plan weekly pipeline needs
                  from revenue and conversion inputs.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong>SDR Capacity</strong>: plan SDR headcount and SQL quotas
                  to hit an annual SQL target.
                </li>
                <li>
                  <strong>Sales Capacity</strong>: plan headcount and quotas to
                  hit target.
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
                  SQL targets, pipeline $ inputs, productivity, baseline, hiring
                </div>
              </div>
            </div>

            <GlobalSettingsForm
              value={sdrSettings}
              onChange={setSdrSettings}
              variant="sql"
            />

            <div style={{ marginTop: 14 }}>
              <div className="panel-subtitle" style={{ marginBottom: 8 }}>
                Pipeline &amp; revenue from SQL capacity
              </div>
            </div>
            <SdrPipelineAssumptionsForm
              value={sdrPipeline}
              onChange={setSdrPipeline}
            />

            <div style={{ marginTop: 14 }}>
              <div className="panel-subtitle" style={{ marginBottom: 8 }}>
                SDR productivity
              </div>
            </div>
            <SdrRoleAssumptionsTable value={sdrRole} onChange={setSdrRole} />

            <div style={{ marginTop: 14 }}>
              <div className="panel-subtitle" style={{ marginBottom: 8 }}>
                Existing SDRs at fiscal start
              </div>
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

            <div style={{ marginTop: 14 }}>
              <div className="panel-subtitle" style={{ marginBottom: 8 }}>
                Hiring plan
              </div>
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
                  SQLs, pipeline $ and expected revenue by month (capacity-based)
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

          <div style={{ marginTop: 14 }}>
            <div className="panel-subtitle" style={{ marginBottom: 8 }}>
              Role productivity
            </div>
          </div>
          <RoleAssumptionsTable value={activeRoles} onChange={handleActiveRolesChange} />

          <div style={{ marginTop: 14 }}>
            <div className="panel-subtitle" style={{ marginBottom: 8 }}>
              Existing team at fiscal start
            </div>
          </div>
          <BaselineForm roles={activeRoles} value={activeBaseline} onChange={setBaseline} />

          <div style={{ marginTop: 14 }}>
            <div className="panel-subtitle" style={{ marginBottom: 8 }}>
              Hiring plan
            </div>
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
          <div style={{ marginTop: 8, lineHeight: 1.45 }}>
            Plan your top of the funnel and your Marketing Qualified Leads needs.
            You need several inputs taken from your CRM and/or your paid media
            dashboard.
          </div>
        </div>
        <div className="grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Demand Generation Assumptions</div>
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
                <div className="panel-title">Demand Generation Outputs</div>
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
      ) : activeTab === 'summary' ? (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div className="subtitle">
            <h2 style={{ margin: '0 0 12px', fontSize: '1.25rem' }}>
              Summary
            </h2>
            <div>
              Select one saved view per planner, then generate a consolidated and
              shareable overview.
            </div>
          </div>
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Summary inputs</div>
                <div className="panel-subtitle">
                  Pick the named views to include
                </div>
              </div>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="summary-demand-view">Demand Generation view</label>
                <select
                  id="summary-demand-view"
                  value={summarySelections.demand}
                  onChange={(e) =>
                    setSummarySelections((prev) => ({
                      ...prev,
                      demand: e.target.value
                    }))
                  }
                >
                  <option value="">Select…</option>
                  {summaryViews.demand.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="summary-pipeline-view">Pipeline Planner view</label>
                <select
                  id="summary-pipeline-view"
                  value={summarySelections.pipeline}
                  onChange={(e) =>
                    setSummarySelections((prev) => ({
                      ...prev,
                      pipeline: e.target.value
                    }))
                  }
                >
                  <option value="">Select…</option>
                  {summaryViews.pipeline.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="summary-sdr-view">SDR Capacity view</label>
                <select
                  id="summary-sdr-view"
                  value={summarySelections.sdr}
                  onChange={(e) =>
                    setSummarySelections((prev) => ({ ...prev, sdr: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {summaryViews.sdr.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="summary-capacity-view">Sales Capacity view</label>
                <select
                  id="summary-capacity-view"
                  value={summarySelections.capacity}
                  onChange={(e) =>
                    setSummarySelections((prev) => ({
                      ...prev,
                      capacity: e.target.value
                    }))
                  }
                >
                  <option value="">Select…</option>
                  {summaryViews.capacity.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-grid" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="summary-recipe-name">Save Summary recipe</label>
                <input
                  id="summary-recipe-name"
                  type="text"
                  maxLength={80}
                  value={summaryRecipeName}
                  onChange={(e) => setSummaryRecipeName(e.target.value)}
                  placeholder="e.g. Q3 board package"
                />
              </div>
              <div className="field">
                <label htmlFor="summary-recipe-load">Load recipe</label>
                <select
                  id="summary-recipe-load"
                  value={summaryRecipeLoadId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSummaryRecipeLoadId(v);
                    handleLoadSummaryRecipe(v);
                  }}
                >
                  <option value="">Select...</option>
                  {summaryRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="button-row no-print" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void refreshSummaryViews()}
              >
                Refresh views
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleSaveSummaryRecipe}
              >
                Save recipe
              </button>
              <button type="button" className="button" onClick={handleGenerateSummary}>
                Generate summary
              </button>
            </div>
            <label
              className="no-print"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8 }}
            >
              <input
                type="checkbox"
                checked={summaryShowDetails}
                onChange={(e) => setSummaryShowDetails(e.target.checked)}
              />
              Show detailed tables
            </label>
            {summaryLoading ? (
              <div style={{ marginTop: 8 }}>Loading saved views…</div>
            ) : null}
            {summaryModeNotice ? (
              <div className="saved-views-error" style={{ marginTop: 8 }}>
                {summaryModeNotice}
              </div>
            ) : null}
            {summaryError ? (
              <div className="saved-views-error" style={{ marginTop: 8 }}>
                {summaryError}
              </div>
            ) : null}
            {summaryRecipeError ? (
              <div className="saved-views-error" style={{ marginTop: 8 }}>
                {summaryRecipeError}
              </div>
            ) : null}
          </section>
          {summaryWarnings.length > 0 ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Summary warnings</div>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {summaryWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {summaryGenerated ? (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Demand Generation</div>
                    <div className="panel-subtitle">Annual output snapshot</div>
                    {summarySelectedMeta.demand ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          fontSize: 12,
                          color: 'var(--muted)'
                        }}
                      >
                        <span className="chip">View: {summarySelectedMeta.demand.name}</span>
                        <span className="chip">
                          Last updated: {formatDateTime(summarySelectedMeta.demand.updatedAt)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {summaryDemandOutput ? (
                  <>
                    <div className="summary-row">
                      <div className="summary-card">
                        <div className="summary-label">Inbound MQLs / year</div>
                        <div className="summary-value">
                          {formatNumber(summaryDemandOutput.summary.mqlInboundYear)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Opportunities / year</div>
                        <div className="summary-value">
                          {formatNumber(summaryDemandOutput.summary.opportunitiesYear)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Pipeline / year</div>
                        <div className="summary-value">
                          {formatCurrency(summaryDemandOutput.summary.pipelineYear)}
                        </div>
                      </div>
                    </div>
                    {summaryShowDetails ? (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>MQL total</th>
                              <th>Opportunities</th>
                              <th>Pipeline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryDemandOutput.months.map((row) => (
                              <tr key={row.month}>
                                <td>
                                  {new Date(row.month).toLocaleDateString(undefined, {
                                    month: 'short',
                                    year: '2-digit'
                                  })}
                                </td>
                                <td>{formatNumber(row.mqlTotal)}</td>
                                <td>{formatNumber(row.opportunities)}</td>
                                <td>{formatCurrency(row.pipeline)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Pipeline Planner</div>
                    <div className="panel-subtitle">Annual output snapshot</div>
                    {summarySelectedMeta.pipeline ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          fontSize: 12,
                          color: 'var(--muted)'
                        }}
                      >
                        <span className="chip">View: {summarySelectedMeta.pipeline.name}</span>
                        <span className="chip">
                          Last updated: {formatDateTime(summarySelectedMeta.pipeline.updatedAt)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {summaryPipelineOutput ? (
                  <>
                    <div className="summary-row">
                      <div className="summary-card">
                        <div className="summary-label">Won target / year</div>
                        <div className="summary-value">
                          {formatCurrency(summaryPipelineOutput.summary.wonTotalYear)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Pipeline required / year</div>
                        <div className="summary-value">
                          {formatCurrency(summaryPipelineOutput.summary.pipelineTotalYear)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Opportunities / year</div>
                        <div className="summary-value">
                          {formatNumber(summaryPipelineOutput.summary.oppsTotalYear)}
                        </div>
                      </div>
                    </div>
                    {summaryShowDetails ? (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Week</th>
                              <th>Won total</th>
                              <th>Pipeline total</th>
                              <th>Opps total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryPipelineOutput.weeks.map((row) => (
                              <tr key={row.week}>
                                <td>
                                  {new Date(row.week).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: '2-digit'
                                  })}
                                </td>
                                <td>{formatCurrency(row.wonInbound + row.wonOutbound)}</td>
                                <td>{formatCurrency(row.pipelineTotal)}</td>
                                <td>{formatNumber(row.oppsTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">SDR Capacity</div>
                    <div className="panel-subtitle">Annual output snapshot</div>
                    {summarySelectedMeta.sdr ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          fontSize: 12,
                          color: 'var(--muted)'
                        }}
                      >
                        <span className="chip">View: {summarySelectedMeta.sdr.name}</span>
                        <span className="chip">
                          Last updated: {formatDateTime(summarySelectedMeta.sdr.updatedAt)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {summarySdrOutput ? (
                  <>
                    <div className="summary-row">
                      <div className="summary-card">
                        <div className="summary-label">SQL target / year</div>
                        <div className="summary-value">
                          {formatNumber(summarySdrOutput.summary.annualTarget)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Annual SQL capacity</div>
                        <div className="summary-value">
                          {formatNumber(summarySdrOutput.summary.annualCapacity)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Assigned SQL quota / year</div>
                        <div className="summary-value">
                          {formatNumber(summarySdrOutput.summary.annualAssignedQuota)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Annual SQL gap</div>
                        <div className="summary-value">
                          {formatNumber(summarySdrOutput.summary.annualGap)}
                        </div>
                      </div>
                    </div>
                    <div className="summary-row" style={{ marginTop: 10 }}>
                      <div className="summary-card">
                        <div className="summary-label">Pipeline from SQLs / year</div>
                        <div className="summary-value">
                          {formatCurrency(summarySdrOutput.summary.annualPipelineValue)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Expected revenue / year</div>
                        <div className="summary-value">
                          {formatCurrency(summarySdrOutput.summary.annualExpectedRevenue)}
                        </div>
                      </div>
                    </div>
                    {summaryShowDetails ? (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>SQL target</th>
                              <th>SQL capacity</th>
                              <th>Assigned quota</th>
                              <th>Gap</th>
                              <th>Opportunities</th>
                              <th>Pipeline value</th>
                              <th>Expected revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summarySdrOutput.months.map((row) => (
                              <tr key={row.month}>
                                <td>
                                  {new Date(row.month).toLocaleDateString(undefined, {
                                    month: 'short',
                                    year: '2-digit'
                                  })}
                                </td>
                                <td>{formatNumber(row.target)}</td>
                                <td>{formatNumber(row.capacity)}</td>
                                <td>{formatNumber(row.assignedQuota)}</td>
                                <td>{formatNumber(row.gap)}</td>
                                <td>{formatNumber(row.opportunities)}</td>
                                <td>{formatCurrency(row.pipelineValue)}</td>
                                <td>{formatCurrency(row.expectedRevenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Sales Capacity</div>
                    <div className="panel-subtitle">Annual output snapshot</div>
                    {summarySelectedMeta.capacity ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          fontSize: 12,
                          color: 'var(--muted)'
                        }}
                      >
                        <span className="chip">View: {summarySelectedMeta.capacity.name}</span>
                        <span className="chip">
                          Last updated: {formatDateTime(summarySelectedMeta.capacity.updatedAt)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {summaryCapacityOutput ? (
                  <>
                    <div className="summary-row">
                      <div className="summary-card">
                        <div className="summary-label">Revenue target / year</div>
                        <div className="summary-value">
                          {formatCurrency(summaryCapacityOutput.summary.annualTarget)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Assigned quota / year</div>
                        <div className="summary-value">
                          {formatCurrency(summaryCapacityOutput.summary.annualAssignedQuota)}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Annual gap</div>
                        <div className="summary-value">
                          {formatCurrency(summaryCapacityOutput.summary.annualGap)}
                        </div>
                      </div>
                    </div>
                    {summaryShowDetails ? (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Target</th>
                              <th>Assigned quota</th>
                              <th>Gap</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryCapacityOutput.months.map((row) => (
                              <tr key={row.month}>
                                <td>
                                  {new Date(row.month).toLocaleDateString(undefined, {
                                    month: 'short',
                                    year: '2-digit'
                                  })}
                                </td>
                                <td>{formatCurrency(row.target)}</td>
                                <td>{formatCurrency(row.assignedQuota)}</td>
                                <td>{formatCurrency(row.gap)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </section>
            </>
          ) : null}
          {!summaryGenerated ? (
            <section className="panel">
              <div>
                Summary results will appear here after you select all four views
                and click "Generate summary".
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-pipeline">
          <PipelineSettingsForm value={pipelineSettings} onChange={setPipelineSettings} />
          <PipelineResults data={pipelineData} pipelineSettings={pipelineSettings} />
        </div>
      )}
    </main>
  );
}

