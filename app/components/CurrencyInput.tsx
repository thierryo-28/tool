import React, { useEffect, useMemo, useState } from 'react';

interface Props {
  id?: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  step?: number;
  placeholder?: string;
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '';
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  return formatter.format(value);
}

function parseCurrencyInput(raw: string): number {
  // Keep digits, dot, and minus; remove commas, currency symbols, spaces, etc.
  const normalized = raw.replace(/[^\d.-]/g, '');
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export const CurrencyInput: React.FC<Props> = ({
  id,
  value,
  onChange,
  min = 0,
  placeholder
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const formatted = useMemo(() => formatCurrency(value), [value]);
  const [text, setText] = useState(formatted);

  useEffect(() => {
    if (!isEditing) setText(formatted);
  }, [formatted, isEditing]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={isEditing ? text : formatted}
      onFocus={() => {
        setIsEditing(true);
        setText(String(value || 0));
      }}
      onBlur={() => {
        setIsEditing(false);
        const next = Math.max(min, parseCurrencyInput(text));
        onChange(next);
      }}
      onChange={(e) => {
        const nextText = e.target.value;
        setText(nextText);
        onChange(Math.max(min, parseCurrencyInput(nextText)));
      }}
      style={{ textAlign: 'right' }}
    />
  );
};

