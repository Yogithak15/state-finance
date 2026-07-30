import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExpandIcon, CloseIcon } from './icons';
import './ExpandableChart.css';

// ─────────────────────────────────────────────────────────────────────────────
//  Wraps a chart with a "view larger" button that opens the same chart, at a
//  much bigger size, in a full-screen modal — mainly for mobile, where a
//  360px-tall chart with a dozen data series is cramped.
//
//  `children` is a render-prop that receives the height to use for
//  ResponsiveContainer: the caller's own fixed height inline (e.g. 360), or
//  "100%" inside the modal (whose body has an explicit CSS height, which is
//  what ResponsiveContainer's "100%" resolves against). This lets the exact
//  same chart JSX — same data, same selected states/filters — render at
//  either size, without duplicating any chart-building logic.
// ─────────────────────────────────────────────────────────────────────────────

interface ExpandableChartProps {
  title: string;
  height: number;
  className?: string;
  children: (height: number | '100%') => React.ReactNode;
}

export const ExpandableChart: React.FC<ExpandableChartProps> = ({ title, height, className, children }) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [expanded]);

  return (
    <>
      <div className={`expandable-chart${className ? ` ${className}` : ''}`}>
        <button
          type="button"
          className="expandable-chart-trigger"
          onClick={() => setExpanded(true)}
          aria-label={`View "${title}" larger`}
        >
          <ExpandIcon width={13} height={13} />
        </button>
        {children(height)}
      </div>

      {expanded &&
        createPortal(
          <div className="expandable-chart-overlay" onClick={() => setExpanded(false)}>
            <div
              className="expandable-chart-modal"
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="expandable-chart-modal-header">
                <span className="expandable-chart-modal-title">{title}</span>
                <button
                  type="button"
                  className="expandable-chart-modal-close"
                  onClick={() => setExpanded(false)}
                  aria-label="Close"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>
              <div className="expandable-chart-modal-body">{children('100%')}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default ExpandableChart;
