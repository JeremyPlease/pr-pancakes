import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { graphql } from '@octokit/graphql';
import { formatDistanceToNow, addDays } from 'date-fns';

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
max-width: 1200px;
  margin: 24px auto;
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
  padding: 14px;
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

const CommentCount = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8b949e;
`;

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
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #8b949e;
  gap: 16px;
  background-color: #161b22;
  border-radius: 10px;
  margin: 24px auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding: 8px 0;
  position: relative;
  background: linear-gradient(to right, rgba(240, 196, 108, 0.05), rgba(240, 196, 108, 0.1), rgba(240, 196, 108, 0.05));
  padding-left: calc((100vw - 1200px) / 2);
  padding-right: calc((100vw - 1200px) / 2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  /* Add subtle background pattern */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      radial-gradient(circle at 25% 25%, rgba(240, 196, 108, 0.05) 2%, transparent 2.5%),
      radial-gradient(circle at 75% 75%, rgba(240, 196, 108, 0.05) 2%, transparent 2.5%);
    background-size: 24px 24px;
    border-radius: 16px;
    opacity: 0.8;
    z-index: 0;
  }

  /* Create a gradient border bottom */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #f0c46c 0%, #f8d68e 50%, #f0c46c 100%);
    border-radius: 3px;
    box-shadow: 0 1px 3px rgba(240, 196, 108, 0.3);
  }

  h1 {
    font-size: 2rem;
    margin: 0;
    color: #f0c46c;
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 800;
    letter-spacing: -0.5px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    position: relative;
    background: linear-gradient(to right, #f0c46c, #f8d68e, #f0c46c);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    z-index: 1;

    /* Add a subtle glow effect */
    &::before {
      content: '🥞';
      font-size: 3rem;
      margin-right: 8px;
      filter: drop-shadow(0 0 8px rgba(240, 196, 108, 0.4));
      animation: float 3s ease-in-out infinite;
      -webkit-text-fill-color: initial;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
  }

  /* Ensure buttons are above the pattern */
  .header-buttons {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;

    h1 {
      font-size: 2.4rem;
    }

    .header-buttons {
      width: 100%;
      justify-content: center;
    }
  }
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(to bottom, #f8d68e, #f0c46c);
  color: #0d1117;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: bold;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 4px 12px rgba(240, 196, 108, 0.3), 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  letter-spacing: 0.5px;

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
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 15px rgba(240, 196, 108, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);

    &::after {
      transform: rotate(30deg) translate(50%, 50%);
    }
  }

  &:active {
    transform: translateY(1px) scale(0.98);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    style={{
      filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1))'
    }}
    className="refresh-icon"
  >
    <style>
      {`
        .refresh-icon {
          transition: transform 0.3s ease;
        }
        button:hover .refresh-icon {
          transform: rotate(180deg);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        button[data-loading="true"] .refresh-icon {
          animation: spin 1.5s linear infinite;
        }
      `}
    </style>
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
  padding-top: 20px;
  border-top: 1px solid #30363d;
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

  /* Pulse animation when count is greater than 0 */
  @keyframes subtle-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  &[data-has-items="true"] {
    animation: subtle-pulse 2s infinite ease-in-out;
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

function App() {
  const [token, setToken] = useState(localStorage.getItem('github_token'));
  const [prs, setPRs] = useState({
    authored: [],
    directReview: [],
    teamReview: [],
    mentioned: [],
    alreadyReviewed: []
  });
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState({
    authored: { field: null, direction: null },
    directReview: { field: null, direction: null },
    teamReview: { field: null, direction: null },
    mentioned: { field: null, direction: null },
    alreadyReviewed: { field: null, direction: null }
  });
  const [dismissedPRs, setDismissedPRs] = useState({});
  const [openDismissDropdown, setOpenDismissDropdown] = useState(null);
  const [isDismissedSectionExpanded, setIsDismissedSectionExpanded] = useState(
    JSON.parse(localStorage.getItem('sectionExpanded_dismissed') || 'false')
  );
  const [expandedSections, setExpandedSections] = useState({
    authored: JSON.parse(localStorage.getItem('sectionExpanded_authored') || 'true'),
    directReview: JSON.parse(localStorage.getItem('sectionExpanded_directReview') || 'true'),
    teamReview: JSON.parse(localStorage.getItem('sectionExpanded_teamReview') || 'true'),
    mentioned: JSON.parse(localStorage.getItem('sectionExpanded_mentioned') || 'true'),
    alreadyReviewed: JSON.parse(localStorage.getItem('sectionExpanded_alreadyReviewed') || 'true')
  });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [activeButtonId, setActiveButtonId] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const newToken = urlParams.get('token');

    if (newToken) {
      localStorage.setItem('github_token', newToken);
      setToken(newToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const savedDismissedPRs = localStorage.getItem('dismissedPRs');
    if (savedDismissedPRs) {
      setDismissedPRs(JSON.parse(savedDismissedPRs));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('dismissedPRs', JSON.stringify(dismissedPRs));
  }, [dismissedPRs]);

  // Save expanded sections state to localStorage
  useEffect(() => {
    Object.keys(expandedSections).forEach(section => {
      localStorage.setItem(`sectionExpanded_${section}`, JSON.stringify(expandedSections[section]));
    });
  }, [expandedSections]);

  // Save dismissed section expanded state to localStorage
  useEffect(() => {
    localStorage.setItem('sectionExpanded_dismissed', JSON.stringify(isDismissedSectionExpanded));
  }, [isDismissedSectionExpanded]);

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

        // Find the parent table container to check for horizontal scrolling
        const tableContainer = activeButton.closest('.table-container');
        let leftOffset = buttonRect.left;

        // If the table is scrolled horizontally, adjust the dropdown position
        if (tableContainer) {
          // Ensure the dropdown doesn't go off-screen to the right
          const viewportWidth = window.innerWidth;
          const dropdownWidth = 200; // Approximate width of dropdown

          if (leftOffset + dropdownWidth > viewportWidth) {
            leftOffset = Math.max(0, viewportWidth - dropdownWidth - 10);
          }
        }

        setDropdownPosition({
          top: buttonRect.bottom,
          left: leftOffset
        });
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

  const fetchPRs = useCallback(async () => {
    setLoading(true);
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
                name
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
                comments {
                  totalCount
                }
                reviews {
                  totalCount
                }
                reviewThreads(first: 100) {
                  nodes {
                    isResolved
                  }
                }
              }
            }
          }
          reviewRequestedPRs: search(query: "is:pr is:open review-requested:@me archived:false", type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
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
                comments {
                  totalCount
                }
                reviews(first: 10) {
                  nodes {
                    author {
                      login
                    }
                    submittedAt
                    state
                  }
                }
                reviewThreads(first: 100) {
                  nodes {
                    isResolved
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
                comments {
                  totalCount
                }
                reviews {
                  totalCount
                }
                reviewThreads(first: 100) {
                  nodes {
                    isResolved
                  }
                }
              }
            }
          }
          alreadyReviewedPRs: search(query: "is:pr is:open -author:@me -review-requested:@me reviewed-by:@me archived:false", type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
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
                comments {
                  totalCount
                }
                reviews(first: 10) {
                  nodes {
                    author {
                      login
                    }
                    submittedAt
                    state
                  }
                }
                reviewThreads(first: 100) {
                  nodes {
                    isResolved
                  }
                }
              }
            }
          }
        }
      `;

      const result = await graphqlWithAuth(query).catch(e => {
        console.error('GraphQL error:', e);
        return e.data;
      });

      const userTeams = result.viewer.organizations.nodes
        .filter(org => org?.teams)
        .flatMap(org => org?.teams?.nodes?.map(team => team.name));

      const processPRs = (prs) => {
        return prs.map(pr => ({
          ...pr,
          unresolvedThreads: pr.reviewThreads.nodes.filter(thread => !thread.isResolved).length,
          totalComments: (pr.comments?.totalCount || 0) + (pr.reviews?.totalCount || 0)
        }));
      };

      const processReviewPRs = (prs) => {
        const directReview = [];
        const teamReview = [];

        prs.nodes.forEach(pr => {
          const teamNames = pr.reviewRequests.nodes
            .map(request => request.requestedReviewer?.name)
            .filter(name => name);

          const userReview = pr.reviews.nodes
            .filter(review => review.author.login === result.viewer.login)
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

          const lastReview = userReview
            ? `${formatDistanceToNow(new Date(userReview.submittedAt))} ago (${userReview.state.toLowerCase()})`
            : 'Never';

          const prWithReview = {
            ...pr,
            teamNames,
            lastReview,
            lastReviewDate: userReview ? userReview.submittedAt : null
          };

          // Check if user is directly requested for review
          const isDirectlyRequested = pr.reviewRequests.nodes
            .some(request => request.requestedReviewer?.login === result.viewer.login);

          // Check if user's team is requested for review
          const isTeamRequested = teamNames.some(team => userTeams.includes(team));

          if (isDirectlyRequested) {
            directReview.push(prWithReview);
          } else if (isTeamRequested) {
            teamReview.push(prWithReview);
          }
        });

        return { directReview, teamReview };
      };

      const { directReview, teamReview } = processReviewPRs(result.reviewRequestedPRs);

      const authoredPRs = processPRs(result.authoredPRs.nodes);
      const allReviewPRs = [...directReview, ...teamReview];

      const mentionedPRs = processPRs(result.mentionedPRs.nodes).filter(pr =>
        !authoredPRs.some(authored => authored.id === pr.id) &&
        !allReviewPRs.some(reviewed => reviewed.id === pr.id)
      );

      const processAlreadyReviewedPRs = (prs) => {
        return prs.map(pr => {
          const userReview = pr.reviews.nodes
            .filter(review => review.author.login === result.viewer.login)
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

          const lastReview = userReview
            ? `${formatDistanceToNow(new Date(userReview.submittedAt))} ago (${userReview.state.toLowerCase()})`
            : 'Never';

          return {
            ...pr,
            lastReview,
            lastReviewDate: userReview ? userReview.submittedAt : null,
            unresolvedThreads: pr.reviewThreads.nodes.filter(thread => !thread.isResolved).length,
            totalComments: (pr.comments?.totalCount || 0) + (pr.reviews?.totalCount || 0)
          };
        });
      };

      const alreadyReviewedPRs = processAlreadyReviewedPRs(result.alreadyReviewedPRs.nodes).filter(pr =>
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
    } catch (error) {
      console.error('Error fetching PRs:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPRs();
    }
  }, [token, fetchPRs]);

  const handleLogin = () => {
    window.location.href = 'https://prpancakes.com/auth';
  };

  const getSortedPRs = (prs, sortConfig) => {
    if (!sortConfig.field) return prs;

    return [...prs].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.field) {
        case 'number':
          aValue = `${a.repository.name}/${a.number}`;
          bValue = `${b.repository.name}/${b.number}`;
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

  const handleDismissOptionClick = (event, pr, option) => {
    event.stopPropagation(); // Prevent the click from bubbling up
    handleDismiss(pr, option);
  };

  const handleDismiss = (pr, option) => {
    const now = new Date();
    let until;

    switch (option) {
      case 'forever':
        until = 'forever';
        break;
      case 'until-update':
        until = 'until-update';
        break;
      case '1day':
        until = addDays(now, 1).toISOString();
        break;
      case '3days':
        until = addDays(now, 3).toISOString();
        break;
      case '7days':
        until = addDays(now, 7).toISOString();
        break;
      default:
        return;
    }

    setDismissedPRs(prev => ({
      ...prev,
      [pr.id]: {
        pr,
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
    if (!dismissal) return false;

    if (dismissal.dismissedUntil === 'forever') return true;
    if (dismissal.dismissedUntil === 'until-update' && pr.updatedAt === dismissal.lastUpdateTime) return true;
    if (dismissal.dismissedUntil && new Date(dismissal.dismissedUntil) > new Date()) return true;

    // If we get here, the dismissal has expired
    handleRestore(pr.id);
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('github_token');
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
    fetchPRs();
  };

  const toggleSectionExpanded = (section) => {
    if (section === 'dismissed') {
      const newState = !isDismissedSectionExpanded;
      setIsDismissedSectionExpanded(newState);
      localStorage.setItem('sectionExpanded_dismissed', JSON.stringify(newState));
    } else {
      setExpandedSections(prev => {
        const newState = {
          ...prev,
          [section]: !prev[section]
        };
        localStorage.setItem(`sectionExpanded_${section}`, JSON.stringify(newState[section]));
        return newState;
      });
    }
  };

  const renderPRTable = (prs, section, includeTeamColumn = false, includeLastReviewColumn = false) => {
    const sortConfig = sorting[section];
    const filteredPRs = getSortedPRs(prs, sortConfig)
      .filter(pr => !isDismissed(pr));

    if (filteredPRs.length === 0) {
      return <EmptyStateMessage>🎉 No PRs here!</EmptyStateMessage>;
    }

    const handleRowClick = (url, event) => {
      // Prevent click if it's coming from the dismiss button
      if (!event.target.closest('.dismiss-button')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        setOpenDismissDropdown(null);
        setActiveButtonId(null);
      }
    };

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
                <ClickableTd>{pr.repository.name}#{pr.number}</ClickableTd>
                <ClickableTd>
                  {pr.title} (#{pr.number})
                </ClickableTd>
                <ClickableTd>
                  <PRAuthor>{pr.author.login}</PRAuthor>
                </ClickableTd>
                {includeTeamColumn && (
                  <ClickableTd>
                    {pr.teamNames.join(', ')}
                  </ClickableTd>
                )}
                <ClickableTd>{formatDistanceToNow(new Date(pr.createdAt))} ago</ClickableTd>
                <ClickableTd>{formatDistanceToNow(new Date(pr.updatedAt))} ago</ClickableTd>
                <ClickableTd>
                  <CommentCount>
                    {pr.totalComments}
                  </CommentCount>
                </ClickableTd>
                <ClickableTd>{pr.unresolvedThreads}</ClickableTd>
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

    const handleDismissedRowClick = (url, event) => {
      // Prevent click if it's coming from the restore button
      if (!event.target.closest('.dismiss-button')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        setOpenDismissDropdown(null);
        setActiveButtonId(null);
      }
    };

    return (
      <PRSection>
        <CollapsibleHeader onClick={() => toggleSectionExpanded('dismissed')}>
          <Caret data-expanded={isDismissedSectionExpanded.toString()}>▶</Caret>
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
        <CollapsibleContent data-expanded={isDismissedSectionExpanded.toString()}>
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
                      onClick={(e) => handleDismissedRowClick(pr.url, e)}
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

  // Helper function to find PR by ID
  const findPRById = (prId) => {
    if (!prId) return null;

    const allPRs = [
      ...(Array.isArray(prs.authored) ? prs.authored : []),
      ...(Array.isArray(prs.directReview) ? prs.directReview : []),
      ...(Array.isArray(prs.teamReview) ? prs.teamReview : []),
      ...(Array.isArray(prs.mentioned) ? prs.mentioned : []),
      ...(Array.isArray(prs.alreadyReviewed) ? prs.alreadyReviewed : [])
    ];

    // Use a type-safe approach to find the PR
    for (let i = 0; i < allPRs.length; i++) {
      /** @type {{ id: string }} */
      const pr = allPRs[i];
      if (pr && pr.id === prId) {
        return pr;
      }
    }

    return null;
  };

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
        <h1>PR Pancakes</h1>
        <div className="header-buttons">
          <RefreshButton
            onClick={handleRefresh}
            disabled={loading}
            data-loading={loading}
          >
            <RefreshIcon /> {loading ? 'Refreshing...' : 'Refresh PRs'}
          </RefreshButton>
          <LogoutButton onClick={handleLogout}>
            <LogoutIcon />
          </LogoutButton>
        </div>
      </Header>

      {loading ? (
        <LoadingOverlay>
          <LoadingSpinner />
          <div>Flipping Pull Request Pancakes... 🥞</div>
        </LoadingOverlay>
      ) : (
        <>
          <PRSection>
            <CollapsibleHeader onClick={() => toggleSectionExpanded('authored')}>
              <Caret data-expanded={expandedSections.authored.toString()}>▶</Caret>
              <SectionHeader>
                <PRCount data-has-items={prs.authored.filter(pr => !isDismissed(pr)).length > 0 ? "true" : "false"}>
                  {prs.authored.filter(pr => !isDismissed(pr)).length}
                </PRCount>
                <h2>Your Pull Requests</h2>
                <InfoIcon onClick={(e) => e.stopPropagation()}>
                  i
                  <TooltipContainer>
                    Pull requests that you have opened and are still open.
                  </TooltipContainer>
                </InfoIcon>
              </SectionHeader>
            </CollapsibleHeader>
            <CollapsibleContent data-expanded={expandedSections.authored.toString()}>
              {renderPRTable(prs.authored, 'authored')}
            </CollapsibleContent>
          </PRSection>

          <PRSection>
            <CollapsibleHeader onClick={() => toggleSectionExpanded('directReview')}>
              <Caret data-expanded={expandedSections.directReview.toString()}>▶</Caret>
              <SectionHeader>
                <PRCount data-has-items={prs.directReview.filter(pr => !isDismissed(pr)).length > 0 ? "true" : "false"}>
                  {prs.directReview.filter(pr => !isDismissed(pr)).length}
                </PRCount>
                <h2>Needs Your Review</h2>
                <InfoIcon onClick={(e) => e.stopPropagation()}>
                  i
                  <TooltipContainer>
                    Open pull requests where you have been directly requested as a reviewer.
                  </TooltipContainer>
                </InfoIcon>
              </SectionHeader>
            </CollapsibleHeader>
            <CollapsibleContent data-expanded={expandedSections.directReview.toString()}>
              {renderPRTable(prs.directReview, 'directReview', false, true)}
            </CollapsibleContent>
          </PRSection>

          <PRSection>
            <CollapsibleHeader onClick={() => toggleSectionExpanded('teamReview')}>
              <Caret data-expanded={expandedSections.teamReview.toString()}>▶</Caret>
              <SectionHeader>
                <PRCount data-has-items={prs.teamReview.filter(pr => !isDismissed(pr)).length > 0 ? "true" : "false"}>
                  {prs.teamReview.filter(pr => !isDismissed(pr)).length}
                </PRCount>
                <h2>Team Reviews</h2>
                <InfoIcon onClick={(e) => e.stopPropagation()}>
                  i
                  <TooltipContainer>
                    Open pull requests where one of your teams has been requested to review.
                  </TooltipContainer>
                </InfoIcon>
              </SectionHeader>
            </CollapsibleHeader>
            <CollapsibleContent data-expanded={expandedSections.teamReview.toString()}>
              {renderPRTable(prs.teamReview, 'teamReview', true, true)}
            </CollapsibleContent>
          </PRSection>

          <PRSection>
            <CollapsibleHeader onClick={() => toggleSectionExpanded('mentioned')}>
              <Caret data-expanded={expandedSections.mentioned.toString()}>▶</Caret>
              <SectionHeader>
                <PRCount data-has-items={prs.mentioned.filter(pr => !isDismissed(pr)).length > 0 ? "true" : "false"}>
                  {prs.mentioned.filter(pr => !isDismissed(pr)).length}
                </PRCount>
                <h2>Mentioned</h2>
                <InfoIcon onClick={(e) => e.stopPropagation()}>
                  i
                  <TooltipContainer>
                    Open pull requests where you have been mentioned in the description or comments.
                  </TooltipContainer>
                </InfoIcon>
              </SectionHeader>
            </CollapsibleHeader>
            <CollapsibleContent data-expanded={expandedSections.mentioned.toString()}>
              {renderPRTable(prs.mentioned, 'mentioned')}
            </CollapsibleContent>
          </PRSection>

          <PRSection>
            <CollapsibleHeader onClick={() => toggleSectionExpanded('alreadyReviewed')}>
              <Caret data-expanded={expandedSections.alreadyReviewed.toString()}>▶</Caret>
              <SectionHeader>
                <PRCount data-has-items={prs.alreadyReviewed.filter(pr => !isDismissed(pr)).length > 0 ? "true" : "false"}>
                  {prs.alreadyReviewed.filter(pr => !isDismissed(pr)).length}
                </PRCount>
                <h2>Already Reviewed</h2>
                <InfoIcon onClick={(e) => e.stopPropagation()}>
                  i
                  <TooltipContainer>
                    Pull requests that you've already reviewed but are still open.
                  </TooltipContainer>
                </InfoIcon>
              </SectionHeader>
            </CollapsibleHeader>
            <CollapsibleContent data-expanded={expandedSections.alreadyReviewed.toString()}>
              {renderPRTable(prs.alreadyReviewed, 'alreadyReviewed', false, true)}
            </CollapsibleContent>
          </PRSection>

          {renderDismissedPRs()}
        </>
      )}

      <DropdownPortal isOpen={openDismissDropdown !== null}>
        <DismissDropdownWrapper style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}>
          <DismissDropdown onClick={e => e.stopPropagation()}>
            <DismissOption onClick={(e) => {
              const pr = findPRById(openDismissDropdown);
              if (pr) handleDismissOptionClick(e, pr, 'until-update');
            }}>
              Until next update
            </DismissOption>
            <DismissOption onClick={(e) => {
              const pr = findPRById(openDismissDropdown);
              if (pr) handleDismissOptionClick(e, pr, 'forever');
            }}>
              Forever
            </DismissOption>
            <DismissOption onClick={(e) => {
              const pr = findPRById(openDismissDropdown);
              if (pr) handleDismissOptionClick(e, pr, '1day');
            }}>
              For 1 day
            </DismissOption>
            <DismissOption onClick={(e) => {
              const pr = findPRById(openDismissDropdown);
              if (pr) handleDismissOptionClick(e, pr, '3days');
            }}>
              For 3 days
            </DismissOption>
            <DismissOption onClick={(e) => {
              const pr = findPRById(openDismissDropdown);
              if (pr) handleDismissOptionClick(e, pr, '7days');
            }}>
              For 7 days
            </DismissOption>
          </DismissDropdown>
        </DismissDropdownWrapper>
      </DropdownPortal>

      <Footer>
        <p>🥞 PR Pancakes | <a href="https://prpancakes.com" target="_blank" rel="noopener noreferrer">prpancakes.com</a> | <a href="https://github.com/jeremyplease/pr-pancakes" target="_blank" rel="noopener noreferrer"><GitHubIcon />GitHub</a></p>
      </Footer>
    </Container>
  );
}

export default App;
