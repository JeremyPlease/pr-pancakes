import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { graphql } from '@octokit/graphql';
import { formatDistanceToNow, addDays } from 'date-fns';
import { initializeAuth, getAuthUrl, getToken, clearToken } from './auth';
import { isRateLimit, handleRateLimit, resetRateLimit, isBlocked, getSecondsUntilRetry } from './simple-rate-limit';
import AnalyticsView from './components/AnalyticsView';
import FocusView from './components/FocusView';

const Container = styled.div`
  margin: 0 auto;
  background-color: #0d1117;
  color: #c9d1d9;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
`;

const LoginButton = styled.button`
  background-color: #f0c46c;
  color: #0d1117;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  font-weight: bold;

  &:hover {
    background-color: #f8d68e;
    transform: translateY(-1px);
    box-shadow: 0 6px 8px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const PRSection = styled.div`
  margin: 0 0 24px;
  background-color: #161b22;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: visible;
  position: relative;
`;

const CollapsibleHeader = styled.div`
display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
  transition: opacity 0.2s ease;

  h2 {
    margin: 0;
    border-bottom: none;
    padding-bottom: 0;
  }

  &:hover {
    opacity: 0.8;
  }
`;

const Caret = styled.span`
  display: inline-block;
  transition: transform 0.2s;
  transform: ${props => props['data-expanded'] === 'true' ? 'rotate(90deg)' : 'none'};
  font-size: 12px;
`;

const CollapsibleContent = styled.div`
  margin-top: 12px;
  display: ${props => props['data-expanded'] === 'true' ? 'block' : 'none'};
`;

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: 8px;
  margin: 0;
  position: relative;

  /* Add smooth scrolling */
  scroll-behavior: smooth;

  /* Hide scrollbar for cleaner look */
  scrollbar-width: thin;

  /* Style webkit scrollbar */
  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #1c2128;
    border-radius: 0 0 8px 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 4px;

    &:hover {
      background: #3f444c;
    }
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: 16px;

  th, td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #30363d;
  }

  th {
    background-color: #1c2128;
    color: #f0c46c;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  tr:last-child td {
    border-bottom: none;
  }
`;

const Th = styled.th`
  text-align: left;
  padding: 14px;
  background-color: #1c2128;
  border-bottom: 2px solid #30363d;
  color: #c9d1d9;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 10px 14px;
  border-bottom: 1px solid #21262d;
  font-size: 14px;
  color: #c9d1d9;
  transition: background-color 0.2s ease;

  &:first-child {
    font-weight: 500;
  }
`;

const PRAuthor = styled.span`
  color: #8b949e;
`;

// "repo #123" reference: dim repo, gold number
const RepoRef = styled.span`
  white-space: nowrap;

  .repo {
    color: #8b949e;
  }

  .num {
    color: #f0c46c;
    font-weight: 600;
  }
`;

// Clamp long PR titles to two lines
const PRTitle = styled.div`
  color: #e6edf3;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 420px;
`;

// Small numeric pill; dims to a dash-like faint number at zero
const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(240, 196, 108, 0.15);
  color: #f0c46c;

  &[data-zero="true"] {
    background: none;
    color: #484f58;
    font-weight: 400;
  }
`;

// Ages get louder as PRs go stale
const AgeText = styled.span`
  white-space: nowrap;

  &[data-staleness="stale"] {
    color: #d29922;
  }

  &[data-staleness="ancient"] {
    color: #f85149;
  }
`;

const DAY_MS = 24 * 60 * 60 * 1000;
const getStaleness = (dateString) => {
  const ageDays = (Date.now() - new Date(dateString).getTime()) / DAY_MS;
  if (ageDays > 90) return 'ancient';
  if (ageDays > 30) return 'stale';
  return 'fresh';
};

const ClickableRow = styled.tr`
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;

  &:hover, &[data-active="true"] {
    background-color: #1c2128;

    /* Subtle highlight effect */
    &::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 3px;
      background-color: #f0c46c;
    }
  }
`;

const ClickableTd = styled(Td)`
  &:hover {
    color: #c9d1d9;
  }
`;

const SortableHeader = styled(Th)`
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: background-color 0.2s;

  &:hover {
    background-color: #2d333b;
  }

  &::after {
    content: '';
    position: absolute;
    right: 8px;
    opacity: ${props => props['data-sort-direction'] ? 1 : 0.3};
    transition: opacity 0.2s;
  }

  &[data-sort-direction="asc"]::after {
    content: '↑';
    color: #f0c46c;
  }

  &[data-sort-direction="desc"]::after {
    content: '↓';
    color: #f0c46c;
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 3px solid rgba(35, 134, 54, 0.2);
  border-radius: 50%;
  border-top: 3px solid #f0c46c;
  animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  margin: 20px auto;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #8b949e;
  gap: 16px;
  background-color: #161b22;
  border-radius: 10px;
  margin: 0 0 24px;
`;

const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 100;
  margin-bottom: 24px;
  background: rgba(13, 17, 23, 0.92);
  backdrop-filter: blur(8px);

  /* Syrup drizzle underline */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #f0c46c 15%, #f8d68e 50%, #f0c46c 85%, transparent 100%);
  }

  .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  h1 {
    font-size: 1.5rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(to right, #f0c46c, #f8d68e, #f0c46c);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    white-space: nowrap;

    &::before {
      content: '🥞';
      font-size: 2rem;
      filter: drop-shadow(0 0 8px rgba(240, 196, 108, 0.4));
      animation: float 3s ease-in-out infinite;
      -webkit-text-fill-color: initial;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
  }

  .header-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  @media (max-width: 768px) {
    /* The stacked header is too tall to pin on small screens */
    position: static;

    .header-inner {
      flex-direction: column;
      gap: 12px;
    }

    .header-buttons {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
    }
  }
`;

// Constrains page content to the same width as the header
const Main = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px 24px;
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(to bottom, #f8d68e, #f0c46c);
  color: #0d1117;
  border: 1px solid transparent;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 2px 8px rgba(240, 196, 108, 0.25);
  position: relative;
  overflow: hidden;

  /* Add subtle shine effect */
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      to bottom right,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    transform: rotate(30deg);
    transition: transform 0.5s;
  }

  &:hover {
    background: linear-gradient(to bottom, #f9dea0, #f8d68e);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(240, 196, 108, 0.35);

    &::after {
      transform: rotate(30deg) translate(50%, 50%);
    }
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  &[data-loading="true"] {
    animation: pulse 1.5s infinite;
    background: linear-gradient(to bottom, #f0c46c, #e0b45c);
    box-shadow: 0 2px 8px rgba(240, 196, 108, 0.3), 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 1;
    }
  }

  svg {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
    transition: transform 0.3s ease;
  }

  &:hover svg {
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

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease-in-out;

  &:hover {
    background: #30363d;
    border-color: #8b949e;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  svg {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
  }

  &:hover svg {
    transform: translateX(2px);
  }
`;

const NavButton = styled(Link)`
  display: flex;
  align-items: center;
  gap: 8px;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease-in-out;

  &.active {
    background: #f0c46c;
    color: #0d1117;
    border-color: #f0c46c;
  }

  &:hover {
    background: #30363d;
    border-color: #8b949e;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &.active:hover {
    background: #f8d68e;
    border-color: #f8d68e;
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
`;

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3a5 5 0 0 1 4.546 2.914.5.5 0 0 0 .908-.417A6 6 0 0 0 8 2C5.201 2 2.872 3.757 2.186 6.244a.5.5 0 1 0 .956.291C3.708 4.389 5.67 3 8 3z"/>
    <path d="M8 13a5 5 0 0 1-4.546-2.914.5.5 0 0 0-.908.417A6 6 0 0 0 8 14c2.799 0 5.128-1.757 5.814-4.244a.5.5 0 1 0-.956-.291C12.292 11.611 10.33 13 8 13z"/>
  </svg>
);

const LogoutIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const GitHubIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    style={{
      verticalAlign: 'middle',
      marginRight: '4px'
    }}
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const DismissButton = styled.button`
  background-color: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  z-index: 1;

  &:hover {
    background-color: #30363d;
    border-color: #8b949e;
    transform: translateY(-1px);
  }

  &:after {
    content: '▼';
    font-size: 8px;
    display: inline-block;
    margin-top: 1px;
    transition: transform 0.2s ease;
  }

  &:hover:after {
    transform: translateY(1px);
  }

  &[data-open="true"] {
    z-index: 1001;
    background-color: #f0c46c;
    color: #0d1117;
    border-color: #f0c46c;
    box-shadow: 0 0 0 2px rgba(240, 196, 108, 0.4);

    &:after {
      transform: rotate(180deg);
    }
  }
`;

const DismissDropdownWrapper = styled.div`
  position: fixed;
  z-index: 1000;
  margin-top: 6px;
`;

const DismissDropdown = styled.div`
  background-color: #1c2128;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 6px 0;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  transform-origin: top left;
  animation: dropdownAppear 0.2s ease;

  @keyframes dropdownAppear {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const DismissOption = styled.div`
  width: 100%;
  text-align: left;
  padding: 8px 16px;
  background: none;
  border: none;
  color: #c9d1d9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: #f0c46c;
    color: #0d1117;
  }
`;

const RestoreButton = styled(DismissButton)`
  background-color: #f0c46c;
  border: none;
  padding: 6px 12px;
  color: #0d1117;

  &:hover {
    background-color: #f0c46c;
  }

  &:after {
    content: none;
  }
`;

const EmptyStateMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #8b949e;
  font-size: 16px;
  background-color: #1c2128;
  border-radius: 8px;
  margin: 16px 0;
  border: 1px dashed #30363d;
`;

const Footer = styled.footer`
  margin-top: 40px;
  padding: 20px 0 28px;
  border-top: 1px solid #21262d;
  text-align: center;
  color: #8b949e;
  font-size: 14px;

  a {
    color: #f0c46c;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .tagline {
    margin-top: 6px;
    font-size: 12px;
    color: #6e7681;
  }
`;

const InfoIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #30363d;
  color: #c9d1d9;
  font-size: 12px;
  margin-left: 8px;
  cursor: help;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    background-color: #f0c46c;
    color: #0d1117;
  }
`;

const TooltipContainer = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 10px 14px;
  background-color: #f0c46c;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: #1c2128;
  font-size: 13px;
  font-weight: normal;
  white-space: nowrap;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  width: max-content;
  max-width: 300px;
  text-align: left;
  text-wrap: auto;
  line-height: 1.5;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: #1c2128 transparent transparent transparent;
  }

  ${InfoIcon}:hover & {
    opacity: 1;
    visibility: visible;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;

  h2 {
    margin: 0;
  }
`;

const PRCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #f0c46c;
  color: #0d1117;
  border-radius: 16px;
  padding: 2px 10px;
  margin-right: 12px;
  margin-left: 0;
  font-size: 14px;
  font-weight: 600;
  min-width: 28px;
  height: 28px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  /* Add subtle shine effect */
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      to bottom right,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    transform: rotate(30deg);
    transition: transform 0.5s;
    z-index: 1;
    opacity: 0.6;
  }

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);

    &::after {
      transform: rotate(30deg) translate(50%, 50%);
    }
  }

  /* Empty sections fade their counter into the background */
  &[data-has-items="false"] {
    background-color: #30363d;
    color: #8b949e;
    box-shadow: none;
  }
`;

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  text-align: center;
  padding: 20px;

  h1 {
    font-size: 3rem;
    margin-bottom: 20px;
    color: #f0c46c;
    display: flex;
    align-items: center;
    gap: 15px;
  }

  p {
    max-width: 600px;
    margin: 0 auto 30px;
    font-size: 1.2rem;
    color: #8b949e;
    line-height: 1.6;
  }
`;

// Create a portal component for the dropdown
const DropdownPortal = ({ children, isOpen }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    children,
    document.body
  );
};

// Add this styled component after the other styled components
const BackgroundRefreshPill = styled.div`
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(13, 17, 23, 0.9);
  border: 1px solid #f0c46c;
  border-top: none;
  border-radius: 0 0 16px 16px;
  padding: 8px 20px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #f0c46c;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: slideDown 0.3s ease;

  @keyframes slideDown {
    from {
      transform: translate(-50%, -100%);
    }
    to {
      transform: translate(-50%, 0);
    }
  }
`;

const RateLimitNotification = styled.div`
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(139, 69, 19, 0.95);
  border: 1px solid #ff6b35;
  border-radius: 8px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1001;
  backdrop-filter: blur(4px);
  animation: slideDown 0.3s ease;
  max-width: 90%;
  text-align: center;

  @keyframes slideDown {
    from {
      transform: translate(-50%, -100%);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }
`;



// Fields common to every PR search below; per-search additions (reviews,
// reviewRequests) are appended where each section needs them.
const PR_CORE_FIELDS = `
  id
  title
  number
  url
  repository {
    name
    owner {
      login
    }
  }
  author {
    login
  }
  createdAt
  updatedAt
  comments(first: 100) {
    totalCount
    nodes {
      author {
        login
        __typename
      }
    }
  }
  reviewThreads(first: 100) {
    nodes {
      isResolved
    }
  }
`;

// Helper function to safely parse localStorage JSON
const safeParseJSON = (key, defaultValue) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to parse localStorage item '${key}':`, error);
    return defaultValue;
  }
};

// Dashboard sections, rendered in order. Each renders a PR table from
// prs[key], with optional extra columns.
const PR_SECTIONS = [
  {
    key: 'authored',
    title: 'Your Pull Requests',
    tooltip: 'Pull requests that you have opened and are still open.'
  },
  {
    key: 'directReview',
    title: 'Needs Your Review',
    tooltip: 'Open pull requests where you have been directly requested as a reviewer.',
    lastReviewColumn: true
  },
  {
    key: 'teamReview',
    title: 'Team Reviews',
    tooltip: 'Open pull requests where one of your teams has been requested to review.',
    teamColumn: true,
    lastReviewColumn: true
  },
  {
    key: 'mentioned',
    title: 'Mentioned',
    tooltip: 'Open pull requests where you have been mentioned in the description or comments.'
  },
  {
    key: 'alreadyReviewed',
    title: 'Already Reviewed',
    tooltip: "Pull requests that you've already reviewed but are still open.",
    lastReviewColumn: true
  }
];

const DISMISS_OPTIONS = [
  { key: 'until-update', label: 'Until next update' },
  { key: 'forever', label: 'Forever' },
  { key: '1day', label: 'For 1 day', days: 1 },
  { key: '3days', label: 'For 3 days', days: 3 },
  { key: '7days', label: 'For 7 days', days: 7 }
];

// Approximate rendered size of the dismiss dropdown, used to keep it on
// screen without measuring a throwaway DOM node.
const DISMISS_DROPDOWN_WIDTH = 200;
const DISMISS_DROPDOWN_HEIGHT = 190;

// Simple countdown shown while rate limited. Lives outside App so it isn't
// redefined (and remounted) on every App render.
const RateLimitCountdown = () => {
  const [seconds, setSeconds] = useState(getSecondsUntilRetry());

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getSecondsUntilRetry());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (seconds <= 0) return 'retrying...';
  return `retrying in ${seconds} seconds`;
};

function App() {
  const [token, setToken] = useState(getToken());
  const location = useLocation();
  const [prs, setPRs] = useState({
    authored: [],
    directReview: [],
    teamReview: [],
    mentioned: [],
    alreadyReviewed: []
  });
  const [loading, setLoading] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [sorting, setSorting] = useState({
    authored: { field: null, direction: null },
    directReview: { field: null, direction: null },
    teamReview: { field: null, direction: null },
    mentioned: { field: null, direction: null },
    alreadyReviewed: { field: null, direction: null }
  });
  const [dismissedPRs, setDismissedPRs] = useState({});
  const [openDismissDropdown, setOpenDismissDropdown] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    authored: safeParseJSON('sectionExpanded_authored', true),
    directReview: safeParseJSON('sectionExpanded_directReview', true),
    teamReview: safeParseJSON('sectionExpanded_teamReview', true),
    mentioned: safeParseJSON('sectionExpanded_mentioned', true),
    alreadyReviewed: safeParseJSON('sectionExpanded_alreadyReviewed', true),
    dismissed: safeParseJSON('sectionExpanded_dismissed', false)
  });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [activeButtonId, setActiveButtonId] = useState(null);

  useEffect(() => {
    // Initialize authentication for local development
    initializeAuth();

    const urlParams = new URLSearchParams(window.location.search);
    const newToken = urlParams.get('token');

    if (newToken) {
      localStorage.setItem('github_token', newToken);
      setToken(newToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const savedDismissedPRs = safeParseJSON('dismissedPRs', {});
    if (savedDismissedPRs && Object.keys(savedDismissedPRs).length > 0) {
      setDismissedPRs(savedDismissedPRs);
    }
  }, []);

  const dismissedPRsHydrated = useRef(false);

  useEffect(() => {
    // Skip the initial mount run so the pre-hydration empty state doesn't
    // wipe stored dismissals; after that, save every change — including an
    // empty object, so removing the last dismissal persists.
    if (!dismissedPRsHydrated.current) {
      dismissedPRsHydrated.current = true;
      return;
    }
    localStorage.setItem('dismissedPRs', JSON.stringify(dismissedPRs));
  }, [dismissedPRs]);

  // Save expanded sections state to localStorage
  useEffect(() => {
    Object.keys(expandedSections).forEach(section => {
      localStorage.setItem(`sectionExpanded_${section}`, JSON.stringify(expandedSections[section]));
    });
  }, [expandedSections]);

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDismissDropdown && !event.target.closest('.dismiss-button')) {
        setOpenDismissDropdown(null);
        setActiveButtonId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDismissDropdown]);

  // Add scroll and resize event handlers to update dropdown position
  useEffect(() => {
    if (!openDismissDropdown) return;

    const updateDropdownPosition = () => {
      const activeButton = document.querySelector(`.dismiss-button[data-pr-id="${openDismissDropdown}"]`);
      if (activeButton) {
        const buttonRect = activeButton.getBoundingClientRect();

        // Keep the dropdown on screen: flip above the button if it would
        // overflow the bottom, clamp to the right/left edges.
        let leftOffset = buttonRect.left;
        let topOffset = buttonRect.bottom;

        if (leftOffset + DISMISS_DROPDOWN_WIDTH > window.innerWidth) {
          leftOffset = Math.max(10, window.innerWidth - DISMISS_DROPDOWN_WIDTH - 10);
        }
        if (topOffset + DISMISS_DROPDOWN_HEIGHT > window.innerHeight) {
          topOffset = Math.max(10, buttonRect.top - DISMISS_DROPDOWN_HEIGHT);
        }
        leftOffset = Math.max(10, leftOffset);

        setDropdownPosition({ top: topOffset, left: leftOffset });
      }
    };

    // Update position on scroll
    window.addEventListener('scroll', updateDropdownPosition, true);
    // Update position on resize
    window.addEventListener('resize', updateDropdownPosition);

    // Initial position update
    updateDropdownPosition();

    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [openDismissDropdown]);

  // Function to handle token expiration
    const handleTokenExpiration = useCallback(() => {
    console.log('Authentication token expired or invalid. Redirecting to auth...');
    clearToken();
    setToken(null);
    window.location.href = getAuthUrl();
  }, []);

  // Tracks an in-flight fetch. A ref (not state) so the guard below always
  // sees the current value — a stale closure here let concurrent fetches
  // through.
  const fetchInProgressRef = useRef(false);

  const fetchPRs = useCallback(async (isBackgroundRefresh = false) => {
    // Prevent multiple simultaneous fetches
    if (fetchInProgressRef.current) {
      return;
    }

    // Don't fetch if we're currently being rate limited
    if (isBlocked()) {
      console.log('Rate limited, skipping fetch');
      return;
    }

    fetchInProgressRef.current = true;
    // If this is a background refresh, set backgroundRefreshing instead of loading
    if (isBackgroundRefresh) {
      setBackgroundRefreshing(true);
    } else {
      setLoading(true);
    }

    const graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });

    try {
      const query = `
        query {
          viewer {
            login
            organizations(first: 10) {
              nodes {
                teams(first: 10) {
                  nodes {
                    name
                  }
                }
              }
            }
          }
          authoredPRs: search(query: "is:pr is:open author:@me archived:false", type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
                ${PR_CORE_FIELDS}
                reviewRequests {
                  totalCount
                }
                reviews(first: 100) {
                  totalCount
                  nodes {
                    state
                    author {
                      login
                    }
                    submittedAt
                    url
                    comments(first: 2) {
                      totalCount
                      nodes {
                        replyTo {
                          id
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          reviewRequestedPRs: search(query: "is:pr is:open review-requested:@me archived:false", type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
                ${PR_CORE_FIELDS}
                reviews(first: 10) {
                  nodes {
                    author {
                      login
                    }
                    submittedAt
                    state
                  }
                }
                reviewRequests(first: 10) {
                  nodes {
                    requestedReviewer {
                      ... on Team {
                        name
                      }
                      ... on User {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
          mentionedPRs: search(query: "is:pr is:open mentions:@me -author:@me archived:false", type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
                ${PR_CORE_FIELDS}
                reviews {
                  totalCount
                }
              }
            }
          }
          alreadyReviewedPRs: search(query: "is:pr is:open -author:@me -review-requested:@me reviewed-by:@me archived:false", type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
                ${PR_CORE_FIELDS}
                reviews(first: 10) {
                  nodes {
                    author {
                      login
                    }
                    submittedAt
                    state
                  }
                }
              }
            }
          }
        }
      `;

      const result = await graphqlWithAuth(query).catch(e => {
        console.error('GraphQL error:', e);

        // Simple rate limit handling
        if (isRateLimit(e)) {
          handleRateLimit(fetchPRs);
          return null;
        }

        // Check if the error is a 401 unauthorized error
        if (e.status === 401 || (e.errors && e.errors.some(err => err.type === 'UNAUTHORIZED'))) {
          handleTokenExpiration();
          return null;
        }
        return e.data;
      });

      // If result is null (due to auth error), exit early
      if (result === null) return;

      const userTeams = result.viewer?.organizations?.nodes
        .filter(org => org?.teams)
        .flatMap(org => org?.teams?.nodes?.map(team => team.name)) || [];

      const processPRs = (prs) => {
        return prs.map(pr => {
          // Get the latest review from each reviewer, filtering out comment-only reviews that are just thread responses
          const latestReviewsByAuthor = pr.reviews?.nodes?.reduce((acc, review) => {
            const authorLogin = review.author?.login;
            if (!authorLogin) return acc;

            // Skip COMMENTED reviews that are just replies
            if (review.state === 'COMMENTED' &&
                review.comments?.totalCount === 1 &&
                review.comments?.nodes?.[0]?.replyTo) {
              return acc;
            }

            const existingReview = acc[authorLogin];
            if (!existingReview || new Date(review.submittedAt) > new Date(existingReview.submittedAt)) {
              acc[authorLogin] = review;
            }
            return acc;
          }, {}) || {};

          // Count the latest review states
          const reviewStates = Object.values(latestReviewsByAuthor).reduce((acc, review) => {
            acc[review.state] = (acc[review.state] || 0) + 1;
            return acc;
          }, {});

          const reviewCounts = {
            approved: reviewStates.APPROVED || 0,
            commented: reviewStates.COMMENTED || 0,
            changes: reviewStates.CHANGES_REQUESTED || 0,
            pending: pr.reviewRequests?.totalCount || 0
          };

          const totalNonPendingReviews = reviewCounts.approved + reviewCounts.commented + reviewCounts.changes;

          return {
            ...pr,
            reviewCounts,
            totalNonPendingReviews,
            unresolvedThreads: pr.reviewThreads?.nodes?.filter(thread => !thread.isResolved)?.length || 0,
            totalComments: ((pr.comments?.nodes?.filter(comment =>
              comment?.author?.login &&
              comment.author.__typename !== 'Bot'
            )?.length || 0) + (pr.reviews?.totalCount || 0))
          };
        });
      };

      // Annotate a PR with the viewer's most recent review ("2 days ago
      // (approved)" / "Never")
      const withUserLastReview = (pr) => {
        const userReview = pr.reviews?.nodes
          ?.filter(review => review.author?.login === result.viewer?.login)
          ?.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

        return {
          ...pr,
          lastReview: userReview
            ? `${formatDistanceToNow(new Date(userReview.submittedAt))} ago (${userReview.state.toLowerCase()})`
            : 'Never',
          lastReviewDate: userReview ? userReview.submittedAt : null
        };
      };

      const processReviewPRs = (prs) => {
        const directReviewPRs = [];
        const teamReviewPRs = [];

        prs.nodes?.forEach(pr => {
          const teamNames = pr.reviewRequests?.nodes
            ?.map(request => request.requestedReviewer?.name)
            ?.filter(name => name) || [];

          const prWithReview = { ...withUserLastReview(pr), teamNames };

          // Check if user is directly requested for review
          const isDirectlyRequested = pr.reviewRequests?.nodes
            ?.some(request => request.requestedReviewer?.login === result.viewer?.login) || false;

          // Check if user's team is requested for review
          const isTeamRequested = teamNames.some(team => userTeams.includes(team));

          if (isDirectlyRequested) {
            directReviewPRs.push(prWithReview);
          } else if (isTeamRequested) {
            teamReviewPRs.push(prWithReview);
          }
        });

        return { directReview: directReviewPRs, teamReview: teamReviewPRs };
      };

      const { directReview, teamReview } = processReviewPRs(result.reviewRequestedPRs || { nodes: [] });

      const authoredPRs = processPRs(result.authoredPRs?.nodes || []);
      const allReviewPRs = [...directReview, ...teamReview];

      const mentionedPRs = processPRs(result.mentionedPRs?.nodes || []).filter(pr =>
        !authoredPRs.some(authored => authored.id === pr.id) &&
        !allReviewPRs.some(reviewed => reviewed.id === pr.id)
      );

      const alreadyReviewedPRs = processPRs(result.alreadyReviewedPRs?.nodes || []).map(withUserLastReview).filter(pr =>
        !authoredPRs.some(authored => authored.id === pr.id) &&
        !allReviewPRs.some(reviewed => reviewed.id === pr.id) &&
        !mentionedPRs.some(mentioned => mentioned.id === pr.id)
      );

      setPRs({
        authored: authoredPRs,
        directReview: processPRs(directReview),
        teamReview: processPRs(teamReview),
        mentioned: mentionedPRs,
        alreadyReviewed: alreadyReviewedPRs
      });

      // All searches above are is:open, so a merged/closed PR disappears from
      // the results — drop its dismissal so it doesn't sit in the Dismissed
      // section indefinitely. Skip pruning if any search may be truncated by
      // the 100-result cap, since absence then wouldn't prove the PR closed.
      const rawSearchResults = [
        result.authoredPRs?.nodes || [],
        result.reviewRequestedPRs?.nodes || [],
        result.mentionedPRs?.nodes || [],
        result.alreadyReviewedPRs?.nodes || []
      ];
      if (rawSearchResults.every(nodes => nodes.length < 100)) {
        const openPRUpdates = new Map(rawSearchResults.flat().map(pr => [pr.id, pr.updatedAt]));
        setDismissedPRs(prev => {
          const staleIds = Object.keys(prev).filter(id => {
            if (!openPRUpdates.has(id)) return true; // merged or closed
            // An until-update dismissal is spent once the PR has been updated;
            // the PR is back in its main section, so drop the stale entry.
            return prev[id].dismissedUntil === 'until-update' &&
              openPRUpdates.get(id) !== prev[id].lastUpdateTime;
          });
          if (staleIds.length === 0) return prev;
          const next = { ...prev };
          staleIds.forEach(id => delete next[id]);
          return next;
        });
      }

      // Reset rate limiting on successful request
      resetRateLimit();
    } catch (error) {
      console.error('Error fetching PRs:', error);

      // Simple rate limit handling
      if (isRateLimit(error)) {
        handleRateLimit(fetchPRs);
        return; // Exit early for rate limit errors
      }

      // Check if the error is a 401 unauthorized error
      if (error.status === 401 ||
          (error.errors && error.errors.some(err => err.type === 'UNAUTHORIZED')) ||
          (error.message && error.message.includes('401'))) {
        handleTokenExpiration();
      }
    } finally {
      setLoading(false);
      setBackgroundRefreshing(false);
      fetchInProgressRef.current = false;
    }
  }, [token, handleTokenExpiration]);

  useEffect(() => {
    if (token) {
      fetchPRs();
    }
  }, [token, fetchPRs]);

  // Refresh PRs when returning to the page, but not on analytics —
  // that view manages its own data.
  useEffect(() => {
    const handleWindowFocus = () => {
      if (token && location.pathname !== '/analytics') {
        fetchPRs(true); // Pass true to indicate this is a background refresh
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [token, fetchPRs, location.pathname]);

  const handleLogin = () => {
    // Clear any existing token before redirecting
    clearToken();
    window.location.href = getAuthUrl();
  };

  const getSortedPRs = (prs, sortConfig) => {
    // direction cycles asc -> desc -> null (unsorted)
    if (!sortConfig.field || !sortConfig.direction) return prs;

    return [...prs].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.field) {
        case 'number': {
          // Group by repository, then numeric PR number
          const repoDiff = a.repository.name.localeCompare(b.repository.name);
          const diff = repoDiff !== 0 ? repoDiff : a.number - b.number;
          return sortConfig.direction === 'asc' ? diff : -diff;
        }
        case 'team':
          aValue = (a.teamNames || []).join(', ');
          bValue = (b.teamNames || []).join(', ');
          break;
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'author':
          aValue = a.author.login;
          bValue = b.author.login;
          break;
        case 'age':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'updated':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        case 'comments':
          aValue = a.totalComments;
          bValue = b.totalComments;
          break;
        case 'unresolved':
          aValue = a.unresolvedThreads;
          bValue = b.unresolvedThreads;
          break;
        case 'lastReview':
          aValue = a.lastReviewDate ? new Date(a.lastReviewDate) : new Date(0);
          bValue = b.lastReviewDate ? new Date(b.lastReviewDate) : new Date(0);
          break;
        case 'reviews':
          aValue = a.totalNonPendingReviews;
          bValue = b.totalNonPendingReviews;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const handleSort = (section, field) => {
    setSorting(prev => {
      const newSorting = { ...prev };
      if (prev[section].field === field) {
        // Toggle direction if same field
        newSorting[section] = {
          field,
          direction: prev[section].direction === 'asc' ? 'desc' :
                     prev[section].direction === 'desc' ? null : 'asc'
        };
      } else {
        // New field, start with ascending
        newSorting[section] = { field, direction: 'asc' };
      }
      return newSorting;
    });
  };

  const handleDismissClick = (event, prId) => {
    event.stopPropagation();

    if (openDismissDropdown === prId) {
      setOpenDismissDropdown(null);
      setActiveButtonId(null);
    } else {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: buttonRect.bottom,
        left: buttonRect.left
      });
      setOpenDismissDropdown(prId);
      setActiveButtonId(prId);
    }
  };

  const handleDismiss = (pr, option) => {
    const now = new Date();
    const until = option.days ? addDays(now, option.days).toISOString() : option.key;

    // Extract only the necessary PR information to avoid circular references
    const simplifiedPR = {
      id: pr.id,
      title: pr.title,
      number: pr.number,
      url: pr.url,
      repository: {
        name: pr.repository.name,
        owner: {
          login: pr.repository.owner.login
        }
      },
      author: {
        login: pr.author.login
      }
    };

    setDismissedPRs(prev => ({
      ...prev,
      [pr.id]: {
        pr: simplifiedPR,
        dismissedAt: now.toISOString(),
        dismissedUntil: until,
        lastUpdateTime: pr.updatedAt
      }
    }));
    setOpenDismissDropdown(null);
    setActiveButtonId(null);
  };

  const handleRestore = (prId) => {
    setDismissedPRs(prev => {
      const newDismissed = { ...prev };
      delete newDismissed[prId];
      return newDismissed;
    });
    setActiveButtonId(null);
  };

  const isDismissed = (pr) => {
    const dismissal = dismissedPRs[pr.id];
    if (!dismissal || !dismissal.pr) return false;

    if (dismissal.dismissedUntil === 'forever') return true;
    if (dismissal.dismissedUntil === 'until-update' && pr.updatedAt === dismissal.lastUpdateTime) return true;
    if (dismissal.dismissedUntil && new Date(dismissal.dismissedUntil) > new Date()) return true;

    // If we get here, the dismissal has expired - mark for cleanup but don't restore immediately
    // to avoid side effects during render
    return false;
  };

  // Separate function to check and clean up expired dismissals
  const cleanupExpiredDismissals = useCallback(() => {
    const now = new Date();
    const expiredIds = [];

    Object.entries(dismissedPRs).forEach(([prId, dismissal]) => {
      if (!dismissal || !dismissal.pr) return;

      // Check if dismissal has expired
      if (dismissal.dismissedUntil !== 'forever' &&
          dismissal.dismissedUntil !== 'until-update' &&
          dismissal.dismissedUntil &&
          new Date(dismissal.dismissedUntil) <= now) {
        expiredIds.push(prId);
      }
    });

    // Clean up expired dismissals
    if (expiredIds.length > 0) {
      setDismissedPRs(prev => {
        const newDismissed = { ...prev };
        expiredIds.forEach(id => delete newDismissed[id]);
        return newDismissed;
      });
    }
  }, [dismissedPRs]);

  // Clean up expired dismissals periodically
  useEffect(() => {
    const interval = setInterval(cleanupExpiredDismissals, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [cleanupExpiredDismissals]);

  const handleLogout = () => {
    clearToken();
    // Reset all state to initial values
    setToken(null);
    setPRs({
      authored: [],
      directReview: [],
      teamReview: [],
      mentioned: [],
      alreadyReviewed: []
    });
    setSorting({
      authored: { field: null, direction: null },
      directReview: { field: null, direction: null },
      teamReview: { field: null, direction: null },
      mentioned: { field: null, direction: null },
      alreadyReviewed: { field: null, direction: null }
    });
  };

  const handleRefresh = () => {
    // Check if there are already PRs loaded
    const hasPRs = Object.values(prs).some(section => section.length > 0);

    // If PRs are already loaded, use background refreshing
    if (hasPRs) {
      fetchPRs(true); // Pass true to indicate this is a background refresh
    } else {
      fetchPRs(false); // Use full loading indicator if no PRs are loaded
    }
  };

  // Persistence is handled by the expandedSections effect above
  const toggleSectionExpanded = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Open the PR on GitHub unless the click came from a dismiss/restore button
  const handleRowClick = (url, event) => {
    if (!event.target.closest('.dismiss-button')) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setOpenDismissDropdown(null);
      setActiveButtonId(null);
    }
  };

  const renderPRTable = (prs, section, includeTeamColumn = false, includeLastReviewColumn = false) => {
    const sortConfig = sorting[section];
    const filteredPRs = getSortedPRs(prs, sortConfig)
      .filter(pr => !isDismissed(pr));

    if (filteredPRs.length === 0) {
      return <EmptyStateMessage>🥞 Nothing on this plate — all clear!</EmptyStateMessage>;
    }

    return (
      <TableContainer className="table-container">
        <Table>
          <thead>
            <tr>
              <SortableHeader
                onClick={() => handleSort(section, 'number')}
                data-sort-direction={sortConfig.field === 'number' ? sortConfig.direction : null}
              >
                #
              </SortableHeader>
              <SortableHeader
                onClick={() => handleSort(section, 'title')}
                data-sort-direction={sortConfig.field === 'title' ? sortConfig.direction : null}
              >
                Title
              </SortableHeader>
              <SortableHeader
                onClick={() => handleSort(section, 'author')}
                data-sort-direction={sortConfig.field === 'author' ? sortConfig.direction : null}
              >
                Author
              </SortableHeader>
              {includeTeamColumn && (
                <SortableHeader
                  onClick={() => handleSort(section, 'team')}
                  data-sort-direction={sortConfig.field === 'team' ? sortConfig.direction : null}
                >
                  Team
                </SortableHeader>
              )}
              <SortableHeader
                onClick={() => handleSort(section, 'age')}
                data-sort-direction={sortConfig.field === 'age' ? sortConfig.direction : null}
              >
                Age
              </SortableHeader>
              <SortableHeader
                onClick={() => handleSort(section, 'updated')}
                data-sort-direction={sortConfig.field === 'updated' ? sortConfig.direction : null}
              >
                Last Updated
              </SortableHeader>
              {section === 'authored' && (
                <SortableHeader
                  onClick={() => handleSort(section, 'reviews')}
                  data-sort-direction={sortConfig.field === 'reviews' ? sortConfig.direction : null}
                >
                  Reviews
                </SortableHeader>
              )}
              <SortableHeader
                onClick={() => handleSort(section, 'comments')}
                data-sort-direction={sortConfig.field === 'comments' ? sortConfig.direction : null}
              >
                Comments
              </SortableHeader>
              <SortableHeader
                onClick={() => handleSort(section, 'unresolved')}
                data-sort-direction={sortConfig.field === 'unresolved' ? sortConfig.direction : null}
              >
                Unresolved
              </SortableHeader>
              {includeLastReviewColumn && (
                <SortableHeader
                  onClick={() => handleSort(section, 'lastReview')}
                  data-sort-direction={sortConfig.field === 'lastReview' ? sortConfig.direction : null}
                >
                  Your Last Review
                </SortableHeader>
              )}
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {filteredPRs.map((pr) => (
              <ClickableRow
                key={pr.id}
                onClick={(e) => handleRowClick(pr.url, e)}
                data-active={activeButtonId === pr.id}
              >
                <ClickableTd>
                  <RepoRef>
                    <span className="repo">{pr.repository.name}</span>
                    <span className="num">#{pr.number}</span>
                  </RepoRef>
                </ClickableTd>
                <ClickableTd>
                  <PRTitle title={pr.title}>{pr.title}</PRTitle>
                </ClickableTd>
                <ClickableTd>
                  <PRAuthor>{pr.author.login}</PRAuthor>
                </ClickableTd>
                {includeTeamColumn && (
                  <ClickableTd>
                    {pr.teamNames.join(', ')}
                  </ClickableTd>
                )}
                <ClickableTd>
                  <AgeText data-staleness={getStaleness(pr.createdAt)}>
                    {formatDistanceToNow(new Date(pr.createdAt))} ago
                  </AgeText>
                </ClickableTd>
                <ClickableTd>
                  <AgeText>{formatDistanceToNow(new Date(pr.updatedAt))} ago</AgeText>
                </ClickableTd>
                {section === 'authored' && (
                  <ClickableTd style={{ whiteSpace: 'nowrap' }}>
                    {pr.reviewCounts.approved > 0 && `✅ ${pr.reviewCounts.approved} `}
                    {pr.reviewCounts.commented > 0 && `💬 ${pr.reviewCounts.commented} `}
                    {pr.reviewCounts.changes > 0 && `❌ ${pr.reviewCounts.changes} `}
                    {pr.reviewCounts.pending > 0 && `🟠 ${pr.reviewCounts.pending}`}
                    {!pr.reviewCounts.approved && !pr.reviewCounts.commented && !pr.reviewCounts.changes && !pr.reviewCounts.pending && '–'}
                  </ClickableTd>
                )}
                <ClickableTd>
                  <CountBadge data-zero={(pr.totalComments === 0).toString()}>
                    {pr.totalComments}
                  </CountBadge>
                </ClickableTd>
                <ClickableTd>
                  <CountBadge data-zero={(pr.unresolvedThreads === 0).toString()}>
                    {pr.unresolvedThreads}
                  </CountBadge>
                </ClickableTd>
                {includeLastReviewColumn && <ClickableTd>{pr.lastReview}</ClickableTd>}
                <Td style={{ position: 'relative' }}>
                  <DismissButton
                    onClick={(e) => handleDismissClick(e, pr.id)}
                    className="dismiss-button"
                    data-open={openDismissDropdown === pr.id}
                    data-pr-id={pr.id}
                  >
                    Dismiss
                  </DismissButton>
                </Td>
              </ClickableRow>
            ))}
          </tbody>
        </Table>
      </TableContainer>
    );
  };

  const renderDismissedPRs = () => {
    const dismissedPRsList = Object.values(dismissedPRs)
      .filter(({ dismissedUntil, pr }) => {
        if (!pr) return false; // Skip entries with missing PR data
        if (dismissedUntil === 'forever' || dismissedUntil === 'until-update') return true;
        const untilDate = new Date(dismissedUntil);
        const now = new Date();
        return untilDate > now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.dismissedAt);
        const dateB = new Date(b.dismissedAt);
        if (dateB > dateA) return 1;
        if (dateB < dateA) return -1;
        return 0;
      });

    return (
      <PRSection>
        <CollapsibleHeader onClick={() => toggleSectionExpanded('dismissed')}>
          <Caret data-expanded={expandedSections.dismissed.toString()}>▶</Caret>
          <SectionHeader>
            <PRCount data-has-items={dismissedPRsList.length > 0 ? "true" : "false"}>
              {dismissedPRsList.length}
            </PRCount>
            <h2>Dismissed Pull Requests</h2>
            <InfoIcon onClick={(e) => e.stopPropagation()}>
              i
              <TooltipContainer>
                Pull requests you've dismissed from the other sections.
              </TooltipContainer>
            </InfoIcon>
          </SectionHeader>
        </CollapsibleHeader>
        <CollapsibleContent data-expanded={expandedSections.dismissed.toString()}>
          {dismissedPRsList.length === 0 ? (
            <EmptyStateMessage>🎉 No dismissed PRs!</EmptyStateMessage>
          ) : (
            <TableContainer className="table-container">
              <Table>
                <thead>
                  <tr>
                    <Th>Repository</Th>
                    <Th>Title</Th>
                    <Th>Author</Th>
                    <Th>Dismissed Until</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {dismissedPRsList.map(({ pr, dismissedUntil }) => (
                    <ClickableRow
                      key={pr.id}
                      onClick={(e) => handleRowClick(pr.url, e)}
                      data-active={activeButtonId === pr.id}
                    >
                      <ClickableTd>{`${pr.repository.owner.login}/${pr.repository.name}`}</ClickableTd>
                      <ClickableTd>
                        {pr.title} (#{pr.number})
                      </ClickableTd>
                      <ClickableTd>
                        <PRAuthor>{pr.author.login}</PRAuthor>
                      </ClickableTd>
                      <ClickableTd>
                        {dismissedUntil === 'forever' ? 'Forever' :
                         dismissedUntil === 'until-update' ? 'Until updated' :
                         formatDistanceToNow(new Date(dismissedUntil)) + ' remaining'}
                      </ClickableTd>
                      <Td>
                        <RestoreButton
                          onClick={() => handleRestore(pr.id)}
                          data-pr-id={pr.id}
                          className="dismiss-button"
                        >
                          Restore
                        </RestoreButton>
                      </Td>
                    </ClickableRow>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          )}
        </CollapsibleContent>
      </PRSection>
    );
  };

  const findPRById = (prId) =>
    prId ? Object.values(prs).flat().find(pr => pr?.id === prId) || null : null;

  if (!token) {
    return (
      <Container>
        <LoginContainer>
          <h1>🥞 PR Pancakes</h1>
          <p>A delicious way to manage your GitHub pull requests! Connect your GitHub account to start tracking all your PRs in one place.</p>
          <LoginButton onClick={handleLogin}>
            Connect with GitHub
          </LoginButton>
        </LoginContainer>
        <Footer>
          <p>🥞 PR Pancakes | <a href="https://prpancakes.com" target="_blank" rel="noopener noreferrer">prpancakes.com</a> | <a href="https://github.com/jeremyplease/pr-pancakes" target="_blank" rel="noopener noreferrer"><GitHubIcon />GitHub</a></p>
        </Footer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <div className="header-inner">
          <h1>PR Pancakes</h1>
          <div className="header-buttons">
            <NavButton to="/" className={location.pathname === '/' ? 'active' : ''}>
              📋 PR Dashboard
            </NavButton>
            <NavButton to="/focus" className={location.pathname === '/focus' ? 'active' : ''}>
              🥞 Short Stack
            </NavButton>
            <NavButton to="/analytics" className={location.pathname === '/analytics' ? 'active' : ''}>
              📈 Analytics
            </NavButton>
            {location.pathname !== '/analytics' && (
              <RefreshButton
                onClick={handleRefresh}
                disabled={loading || backgroundRefreshing}
                data-loading={loading || backgroundRefreshing}
              >
                <RefreshIcon /> {loading ? 'Refreshing...' : backgroundRefreshing ? 'Refreshing...' : 'Refresh PRs'}
              </RefreshButton>
            )}
            <LogoutButton onClick={handleLogout} title="Log out">
              <LogoutIcon />
            </LogoutButton>
          </div>
        </div>
      </Header>

      {backgroundRefreshing && (
        <BackgroundRefreshPill>
          <LoadingSpinner style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
          Refreshing PRs...
        </BackgroundRefreshPill>
      )}

      {isBlocked() && (
        <RateLimitNotification>
          ⚠️ Rate limited - <RateLimitCountdown />
        </RateLimitNotification>
      )}

      <Main>
      <Routes>
        <Route path="/" element={
          loading ? (
            <LoadingOverlay>
              <LoadingSpinner />
              <div>Flipping Pull Request Pancakes... 🥞</div>
            </LoadingOverlay>
          ) : (
            <>
              {PR_SECTIONS.map(({ key, title, tooltip, teamColumn, lastReviewColumn }) => {
                const visibleCount = prs[key].filter(pr => !isDismissed(pr)).length;
                return (
                  <PRSection key={key}>
                    <CollapsibleHeader onClick={() => toggleSectionExpanded(key)}>
                      <Caret data-expanded={expandedSections[key].toString()}>▶</Caret>
                      <SectionHeader>
                        <PRCount data-has-items={visibleCount > 0 ? "true" : "false"}>
                          {visibleCount}
                        </PRCount>
                        <h2>{title}</h2>
                        <InfoIcon onClick={(e) => e.stopPropagation()}>
                          i
                          <TooltipContainer>
                            {tooltip}
                          </TooltipContainer>
                        </InfoIcon>
                      </SectionHeader>
                    </CollapsibleHeader>
                    <CollapsibleContent data-expanded={expandedSections[key].toString()}>
                      {renderPRTable(prs[key], key, !!teamColumn, !!lastReviewColumn)}
                    </CollapsibleContent>
                  </PRSection>
                );
              })}

              {renderDismissedPRs()}
            </>
          )
        } />
        <Route path="/focus" element={
          <FocusView
            prs={prs}
            isDismissed={isDismissed}
            loading={loading}
          />
        } />
        <Route path="/analytics" element={
          <AnalyticsView
            token={token}
            onTokenExpired={handleTokenExpiration}
          />
        } />
      </Routes>
      </Main>

      <DropdownPortal isOpen={openDismissDropdown !== null}>
        <DismissDropdownWrapper style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}>
          <DismissDropdown onClick={e => e.stopPropagation()}>
            {DISMISS_OPTIONS.map(option => (
              <DismissOption
                key={option.key}
                onClick={(e) => {
                  e.stopPropagation();
                  const pr = findPRById(openDismissDropdown);
                  if (pr) handleDismiss(pr, option);
                }}
              >
                {option.label}
              </DismissOption>
            ))}
          </DismissDropdown>
        </DismissDropdownWrapper>
      </DropdownPortal>

      <Footer>
        <p>🥞 PR Pancakes | <a href="https://prpancakes.com" target="_blank" rel="noopener noreferrer">prpancakes.com</a> | <a href="https://github.com/jeremyplease/pr-pancakes" target="_blank" rel="noopener noreferrer"><GitHubIcon />GitHub</a></p>
        <p className="tagline">Serving your pull requests hot off the griddle.</p>
      </Footer>
    </Container>
  );
}

export default App;
