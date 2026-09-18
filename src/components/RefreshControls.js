import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { shortTimeAgo } from '../time-utils';

const Controls = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 8px;
  row-gap: 2px;
`;

const RefreshIconButton = styled.button`
  grid-row: span 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover:not(:disabled) {
    background: #30363d;
    border-color: #f0c46c;
    color: #f0c46c;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  svg {
    transition: transform 0.3s ease;
  }

  &:hover:not(:disabled) svg {
    transform: rotate(180deg);
  }

  &[data-loading="true"] svg {
    animation: icon-spin 1.5s linear infinite;
  }

  @keyframes icon-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Feather "rotate-cw"
const RefreshIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const AutoSwitch = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  background: none;
  border: none;
  color: #8b949e;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.2s ease;

  .track {
    position: relative;
    width: 24px;
    height: 14px;
    border-radius: 7px;
    background: #21262d;
    border: 1px solid #30363d;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #8b949e;
    transition: all 0.2s ease;
  }

  &:hover .track {
    border-color: #f0c46c;
  }

  &:focus-visible {
    outline: 2px solid #f0c46c;
    outline-offset: 3px;
    border-radius: 4px;
  }

  &[aria-checked="true"] {
    color: #f0c46c;
  }

  &[aria-checked="true"] .track {
    background: rgba(240, 196, 108, 0.2);
    border-color: #f0c46c;
  }

  &[aria-checked="true"] .track::after {
    left: 12px;
    background: #f0c46c;
    box-shadow: 0 0 6px rgba(240, 196, 108, 0.6);
  }
`;

const Tooltip = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 10px;
  padding: 10px 14px;
  width: max-content;
  max-width: 260px;
  background-color: #f0c46c;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  color: #1c2128;
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s, visibility 0.2s;

  ${AutoSwitch}:hover ~ &,
  ${AutoSwitch}:focus-visible ~ & {
    opacity: 1;
    visibility: visible;
  }

  @media (max-width: 768px) {
    left: auto;
    right: 0;
  }
`;

const LastRefreshedText = styled.span`
  color: #6e7681;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  cursor: default;
`;

const LastRefreshed = ({ at }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(tick => tick + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!at) return <LastRefreshedText>—</LastRefreshedText>;

  return (
    <LastRefreshedText title={`Last refreshed ${new Date(at).toLocaleString()}`}>
      {shortTimeAgo(at)}
    </LastRefreshedText>
  );
};

const RefreshControls = ({ onRefresh, refreshing, autoRefresh, onToggleAutoRefresh, lastRefreshedAt }) => (
  <Controls>
    <RefreshIconButton
      onClick={onRefresh}
      disabled={refreshing}
      data-loading={refreshing.toString()}
      title="Refresh PRs"
      aria-label="Refresh PRs"
    >
      <RefreshIcon />
    </RefreshIconButton>
    <AutoSwitch
      type="button"
      role="switch"
      aria-checked={autoRefresh}
      aria-label="Auto refresh"
      aria-describedby="auto-refresh-tooltip"
      onClick={onToggleAutoRefresh}
    >
      <span className="track" />
      Auto
    </AutoSwitch>
    <LastRefreshed at={lastRefreshedAt} />
    <Tooltip id="auto-refresh-tooltip" role="tooltip">
      <strong>Auto refresh</strong> — reloads your PRs whenever you come back to this tab.
      Off: only the refresh button reloads.
    </Tooltip>
  </Controls>
);

export default RefreshControls;
