import React from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { calculateBusinessDaysMs } from '../analytics-utils';

// Extend dayjs with plugins
dayjs.extend(duration);
dayjs.extend(relativeTime);

const TableContainer = styled.div`
  background-color: #161b22;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const TableHeader = styled.h3`
  color: #f0c46c;
  margin: 0 0 20px 0;
  font-size: 1.2rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
`;

const Th = styled.th`
  background-color: #21262d;
  color: #c9d1d9;
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid #30363d;

  &:not(:last-child) {
    border-right: 1px solid #30363d;
  }
`;

const Td = styled.td`
  padding: 16px;
  border-bottom: 1px solid #30363d;
  font-size: 14px;
  color: #c9d1d9;

  &:not(:last-child) {
    border-right: 1px solid #30363d;
  }
`;

const Tr = styled.tr`
  &:hover {
    background-color: #1c2128;
  }

  &:last-child td {
    border-bottom: none;
  }
`;

const StatusBadge = styled.span`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;

  &.submitted {
    background-color: rgba(46, 160, 67, 0.2);
    color: #2ea043;
  }

  &.missed {
    background-color: rgba(248, 81, 73, 0.2);
    color: #f85149;
  }

  &.pending {
    background-color: rgba(240, 196, 108, 0.2);
    color: #f0c46c;
  }
`;

const PRLink = styled.a`
  color: #58a6ff;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  flex-wrap: wrap;
  gap: 16px;
`;

const PaginationButton = styled.button`
  background-color: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: #30363d;
    border-color: #8b949e;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PaginationInfo = styled.span`
  color: #8b949e;
  font-size: 14px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #8b949e;
  font-size: 16px;
`;

const ITEMS_PER_PAGE = 25;

const formatDateTime = (dateString, timezone) => {
  if (!dateString) return 'N/A';
  return dayjs(dateString).tz(timezone).format('MMM D, YYYY [at] h:mm A');
};

const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return 'N/A';

  const duration = dayjs.duration(milliseconds);
  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const ReviewTable = ({ data, dateRange, page, onPageChange, timezone, excludeWeekends }) => {
  // Process data into table rows
  const processTableData = () => {
    if (!data || data.length === 0) {
      return [];
    }

    const rows = [];

    data.forEach(pr => {
      pr.reviewRequestEvents.forEach(requestEvent => {
        const requestTime = dayjs(requestEvent.requestedAt);
        const review = requestEvent.matchingReview;
        const reviewTime = review ? dayjs(review.submittedAt) : null;

        // Check if this is within our date range
        if (
          (requestTime.isBefore(dateRange.start) || requestTime.isAfter(dateRange.end)) &&
          (!reviewTime || reviewTime.isBefore(dateRange.start) || reviewTime.isAfter(dateRange.end))
        ) {
          return;
        }

        let status, respondedAt, responseTime;

        if (review) {
          status = 'submitted';
          respondedAt = review.submittedAt;
          responseTime = excludeWeekends
            ? calculateBusinessDaysMs(requestTime, review.submittedAt)
            : dayjs(review.submittedAt).diff(requestTime);
        } else {
          // Check if this is a missed review (PR merged/closed without review)
          const prClosed = pr.mergedAt || pr.closedAt;
          if (prClosed && dayjs(prClosed).isAfter(requestTime)) {
            status = 'missed';
            respondedAt = null;
            responseTime = null;
          } else {
            status = 'pending';
            respondedAt = null;
            responseTime = null;
          }
        }

        rows.push({
          id: `${pr.id}-${requestEvent.id}`,
          repo: pr.repository.nameWithOwner,
          number: pr.number,
          title: pr.title,
          url: pr.url,
          author: pr.author.login,
          requestedTo: requestEvent.requestedTo,
          requestedAt: requestEvent.requestedAt,
          respondedAt,
          responseTime,
          status
        });
      });
    });

    // Sort by requested date (newest first)
    return rows.sort((a, b) => dayjs(b.requestedAt).valueOf() - dayjs(a.requestedAt).valueOf());
  };

  const tableData = processTableData();
  const totalPages = Math.ceil(tableData.length / ITEMS_PER_PAGE);
  const startIndex = page * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageData = tableData.slice(startIndex, endIndex);

  if (tableData.length === 0) {
    return (
      <TableContainer>
        <TableHeader>📋 Review Request Details</TableHeader>
        <EmptyMessage>
          No review requests found for the selected date range.
          <br />
          Try selecting a different time period.
        </EmptyMessage>
      </TableContainer>
    );
  }

  const handlePreviousPage = () => {
    if (page > 0) {
      onPageChange(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages - 1) {
      onPageChange(page + 1);
    }
  };

  return (
    <TableContainer>
      <TableHeader>📋 Review Request Details</TableHeader>

      <Table>
        <thead>
          <tr>
            <Th>Repository / PR</Th>
            <Th>PR Author</Th>
            <Th>Requested To</Th>
            <Th>Requested At</Th>
            <Th>Responded At</Th>
            <Th>Response Time</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {currentPageData.map(row => (
            <Tr key={row.id}>
              <Td>
                <PRLink href={row.url} target="_blank" rel="noopener noreferrer">
                  {row.repo} #{row.number}
                </PRLink>
                <div style={{
                  color: '#8b949e',
                  fontSize: '12px',
                  marginTop: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '300px'
                }}>
                  {row.title}
                </div>
              </Td>
              <Td>{row.author}</Td>
              <Td>{row.requestedTo}</Td>
              <Td>{formatDateTime(row.requestedAt, timezone)}</Td>
              <Td>{row.respondedAt ? formatDateTime(row.respondedAt, timezone) : 'N/A'}</Td>
              <Td>{formatDuration(row.responseTime)}</Td>
              <Td>
                <StatusBadge className={row.status}>
                  {row.status === 'submitted' ? '✅ Submitted' :
                   row.status === 'missed' ? '❌ Missed' :
                   '⏳ Pending'}
                </StatusBadge>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <PaginationContainer>
        <PaginationInfo>
          Showing {startIndex + 1}-{Math.min(endIndex, tableData.length)} of {tableData.length} review requests
        </PaginationInfo>

        <div style={{ display: 'flex', gap: '8px' }}>
          <PaginationButton
            onClick={handlePreviousPage}
            disabled={page === 0}
          >
            ← Previous
          </PaginationButton>

          <PaginationButton
            onClick={handleNextPage}
            disabled={page >= totalPages - 1}
          >
            Next →
          </PaginationButton>
        </div>
      </PaginationContainer>
    </TableContainer>
  );
};

export default ReviewTable;
