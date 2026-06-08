'use client';

import React from 'react';

interface Props {
  rightText?: string;
  onDownloadPdf?: () => void;
}

export const Header: React.FC<Props> = ({
  rightText,
  onDownloadPdf
}) => {
  return (
    <div className="planner-toolbar no-print">
      <div className="planner-toolbar-text">
        <div className="app-header-kicker">Planner</div>
        <div className="app-header-title">{rightText ?? 'Sales Capacity'}</div>
      </div>
      <div className="app-header-actions">
        <button
          type="button"
          className="button button-small"
          onClick={onDownloadPdf}
          disabled={!onDownloadPdf}
        >
          Download PDF
        </button>
      </div>
    </div>
  );
};
