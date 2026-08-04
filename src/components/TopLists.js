import React from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const Card = styled.div`
  background-color: #161b22;
  border-radius: 10px;
  padding: 16px 20px;
  border: 1px solid #21262d;
`;

const CardTitle = styled.h3`
  color: #f0c46c;
  margin: 0 0 2px;
  font-size: 1rem;
`;

const CardSubtitle = styled.p`
  color: #8b949e;
  font-size: 12px;
  margin: 0 0 14px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(120px, 220px) 1fr 36px;
  align-items: center;
  gap: 12px;
  padding: 5px 0;
  font-size: 13px;

  .name {
    color: #c9d1d9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-track {
    height: 8px;
    border-radius: 4px;
    background-color: #21262d;
    overflow: hidden;
  }

  .bar {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, #bf8700, #d4a72c);
    min-width: 4px;
  }

  .count {
    color: #8b949e;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`;

const NoData = styled.div`
  color: #6e7681;
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
`;

const TOP_N = 6;

const rankedCounts = (counts) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N);

const RankedList = ({ entries }) => {
  if (entries.length === 0) {
    return <NoData>No review requests in this range.</NoData>;
  }
  const max = entries[0][1];
  return entries.map(([name, count]) => (
    <Row key={name}>
      <span className="name" title={name}>{name}</span>
      <span className="bar-track">
        <span className="bar" style={{ display: 'block', width: `${(count / max) * 100}%` }} />
      </span>
      <span className="count">{count}</span>
    </Row>
  ));
};

// Ranks repos and PR authors by review requests made to you in the range
const TopLists = ({ data, dateRange }) => {
  const repoCounts = {};
  const authorCounts = {};

  (data || []).forEach(pr => {
    pr.reviewRequestEvents.forEach(requestEvent => {
      const requestTime = dayjs(requestEvent.requestedAt);
      if (requestTime.isBefore(dateRange.start) || requestTime.isAfter(dateRange.end)) return;

      const repo = pr.repository?.nameWithOwner || 'unknown';
      const author = pr.author?.login || 'unknown';
      repoCounts[repo] = (repoCounts[repo] || 0) + 1;
      authorCounts[author] = (authorCounts[author] || 0) + 1;
    });
  });

  return (
    <Grid>
      <Card>
        <CardTitle>🏷️ Busiest Repos</CardTitle>
        <CardSubtitle>Where your review requests come from</CardSubtitle>
        <RankedList entries={rankedCounts(repoCounts)} />
      </Card>
      <Card>
        <CardTitle>🧑‍🍳 Top Requesters</CardTitle>
        <CardSubtitle>Whose PRs land on your plate the most</CardSubtitle>
        <RankedList entries={rankedCounts(authorCounts)} />
      </Card>
    </Grid>
  );
};

export default TopLists;
