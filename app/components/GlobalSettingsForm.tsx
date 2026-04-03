import React from 'react';
import { GlobalSettings } from '@/lib/types';
import { CurrencyInput } from './CurrencyInput';

interface Props {
  value: GlobalSettings;
  onChange(value: GlobalSettings): void;
  /** `sql`: annual target is org SQLs/year (SDR tab). Default: revenue ($). */
  variant?: 'revenue' | 'sql';
}

export const GlobalSettingsForm: React.FC<Props> = ({
  value,
  onChange,
  variant = 'revenue'
}) => {
  const handleNumberChange =
    (field: keyof GlobalSettings) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next: GlobalSettings = {
        ...value,
        [field]: Number(e.target.value) || 0
      };
      onChange(next);
    };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, fiscalYearStart: e.target.value });
  };

  const setQuarterWeight = (index: 0 | 1 | 2 | 3, pct: number) => {
    const next = { ...value };
    const qw = [...next.seasonality.quarterWeightsPct] as [
      number,
      number,
      number,
      number
    ];
    qw[index] = pct;
    next.seasonality = { ...next.seasonality, quarterWeightsPct: qw };
    onChange(next);
  };

  const setWithinQuarter = (index: 0 | 1 | 2, pct: number) => {
    const next = { ...value };
    const wq = [...next.seasonality.withinQuarterPct] as [number, number, number];
    wq[index] = pct;
    next.seasonality = { ...next.seasonality, withinQuarterPct: wq };
    onChange(next);
  };

  return (
    <div>
      <div className="field-grid">
      <div className="field">
        <label htmlFor="fiscalYearStart">Fiscal Year Start</label>
        <input
          id="fiscalYearStart"
          type="date"
          value={value.fiscalYearStart.slice(0, 10)}
          onChange={handleDateChange}
        />
      </div>
      <div className="field">
        <label htmlFor="months">Months</label>
        <input
          id="months"
          type="number"
          min={1}
          max={24}
          value={value.months}
          onChange={handleNumberChange('months')}
        />
      </div>
      <div className="field">
        <label htmlFor="annualTarget">
          {variant === 'sql' ? 'Annual org SQL target' : 'Annual Target'}
        </label>
        {variant === 'sql' ? (
          <input
            id="annualTarget"
            type="number"
            min={0}
            step={1}
            value={Math.round(value.companyTargetAnnual)}
            onChange={(e) =>
              onChange({
                ...value,
                companyTargetAnnual: Number(e.target.value) || 0
              })
            }
          />
        ) : (
          <CurrencyInput
            id="annualTarget"
            value={value.companyTargetAnnual}
            onChange={(n) => onChange({ ...value, companyTargetAnnual: n })}
            min={0}
            placeholder="$0"
          />
        )}
      </div>
      <div className="field">
        <label htmlFor="overAssignment">Over-Assignment %</label>
        <input
          id="overAssignment"
          type="number"
          min={0}
          max={200}
          step={5}
          value={Math.round(value.overAssignmentPct * 100)}
          onChange={(e) =>
            onChange({
              ...value,
              overAssignmentPct: (Number(e.target.value) || 0) / 100
            })
          }
        />
      </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="panel-subtitle" style={{ marginBottom: 8 }}>
          Seasonality (target distribution)
        </div>
        <div className="seasonality-grid">
          <div className="seasonality-col">
            <div className="seasonality-col-title">Seasonality by quarter</div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="q1">Q1 %</label>
                <input
                  id="q1"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value.seasonality.quarterWeightsPct[0]}
                  onChange={(e) =>
                    setQuarterWeight(0, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="q2">Q2 %</label>
                <input
                  id="q2"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value.seasonality.quarterWeightsPct[1]}
                  onChange={(e) =>
                    setQuarterWeight(1, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="q3">Q3 %</label>
                <input
                  id="q3"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value.seasonality.quarterWeightsPct[2]}
                  onChange={(e) =>
                    setQuarterWeight(2, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="q4">Q4 %</label>
                <input
                  id="q4"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value.seasonality.quarterWeightsPct[3]}
                  onChange={(e) =>
                    setQuarterWeight(3, Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </div>
          <div className="seasonality-col">
            <div className="seasonality-col-title">Monthly distribution</div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="m1">Month 1 in Qtr %</label>
                <input
                  id="m1"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value.seasonality.withinQuarterPct[0]}
                  onChange={(e) =>
                    setWithinQuarter(0, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="m2">Month 2 in Qtr %</label>
                <input
                  id="m2"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value.seasonality.withinQuarterPct[1]}
                  onChange={(e) =>
                    setWithinQuarter(1, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="m3">Month 3 in Qtr %</label>
                <input
                  id="m3"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value.seasonality.withinQuarterPct[2]}
                  onChange={(e) =>
                    setWithinQuarter(2, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="field" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

