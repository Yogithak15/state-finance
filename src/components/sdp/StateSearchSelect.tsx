import React, { useEffect, useRef, useState } from 'react';
import './StateSearchSelect.css';

interface StateSearchSelectProps {
  states: string[];
  value: string;
  onChange: (state: string) => void;
}

const StateSearchSelect: React.FC<StateSearchSelectProps> = ({ states, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = states.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()));

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="state-search-select" ref={containerRef}>
      <button
        type="button"
        className="state-search-select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value || 'Select a state'}</span>
        <span className="state-search-select-caret">▾</span>
      </button>
      {open && (
        <div className="state-search-select-popover">
          <input
            type="text"
            autoFocus
            className="state-search-select-input"
            placeholder="Search states…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="state-search-select-list">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                className={`state-search-select-option${name === value ? ' selected' : ''}`}
                onClick={() => handleSelect(name)}
              >
                {name}
              </button>
            ))}
            {filtered.length === 0 && (
              <span className="state-search-select-empty">No states match “{search}”.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StateSearchSelect;
