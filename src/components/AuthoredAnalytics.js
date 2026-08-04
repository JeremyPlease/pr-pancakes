import React from 'react';
import styled from 'styled-components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { calculateBusinessDaysMs, formatDurationMs, percentile } from '../analytics-utils';
import StatTiles from './StatTiles';

// Same validated pair as the review velocity chart: blue = opened, gold = merged
const COLOR_OPENED = '#2f81f7';
const COLOR_MERGED = '#bf8700';
const COLOR_GRID = '#21262d';
const COLOR_AXIS_TEXT = '#8b949e';

const ChartCard = styled.div`
  background-color: #161b22;
  border-radius: 10px;
  padding: 16px 20px;
  border: 1px solid #21262d;
  margin-bottom: 24px;
`;

const CardTitle = styled.h3`
  color: #f0c46c;
  margin: 0 0 2px;
  font-size: 1rem;
`;

const CardSubtitle = styled.p`
  color: #8b949e;
  font-size: 12px;
  margin: 0 0 12px;
`;

const ChartWrap = styled.div`
  height: 260px;
`;

const NoData = styled.div`
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6e7681;
  font-size: 13px;
`;

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      backgroundColor: '#1c2128',
      border: '1px solid #30363d',
      borderRadius: '6px',
      padding: '8px 12px',
      color: '#c9d1d9',
      fontSize: '13px'
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ margin: '2px 0', color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

const inRange = (dateString, dateRange) => {
  if (!dateString) return false;
  const t = dayjs(dateString);
  return !t.isBefore(dateRange.start) && !t.isAfter(dateRange.end);
};

const AuthoredAnalytics = ({ data, dateRange, excludeWeekends, timezone }) => {
  const opened = (data || []).filter(pr => inRange(pr.createdAt, dateRange));
  const merged = (data || []).filter(pr => inRange(pr.mergedAt, dateRange));

  const elapsed = (from, to) =>
    excludeWeekends ? calculateBusinessDaysMs(from, to) : dayjs(to).diff(dayjs(from));

  const timesToMerge = merged
    .map(pr => elapsed(pr.createdAt, pr.mergedAt))
    .sort((a, b) => a - b);

  // How long your PRs wait for their first review from someone else
  const waitsForReview = opened
    .filter(pr => pr.firstReviewAt)
    .map(pr => elapsed(pr.createdAt, pr.firstReviewAt))
    .sort((a, b) => a - b);

  const sizes = opened
    .map(pr => (pr.additions || 0) + (pr.deletions || 0))
    .sort((a, b) => a - b);

  const mergedOfOpened = opened.filter(pr => pr.mergedAt).length;
  const mergeRate = opened.length > 0 ? Math.round((mergedOfOpened / opened.length) * 100) : null;

  const items = [
    {
      icon: '🚀',
      title: 'PRs Opened',
      value: opened.length,
      subtext: 'created in this range'
    },
    {
      icon: '🎉',
      title: 'PRs Merged',
      value: merged.length,
      subtext: 'merged in this range'
    },
    {
      icon: '🔄',
      title: 'Merge Rate',
      value: mergeRate === null ? 'N/A' : `${mergeRate}%`,
      subtext: 'of PRs opened in range, merged by now'
    },
    {
      icon: '⏱️',
      title: 'Median Time to Merge',
      value: formatDurationMs(percentile(timesToMerge, 0.5)),
      subtext: 'open → merged'
    },
    {
      icon: '👀',
      title: 'Median Wait for Review',
      value: formatDurationMs(percentile(waitsForReview, 0.5)),
      subtext: 'open → first review received'
    },
    {
      icon: '📦',
      title: 'Median PR Size',
      value: sizes.length ? `${percentile(sizes, 0.5)}` : 'N/A',
      subtext: 'lines changed (+/−)'
    }
  ];

  // Bucket opened/merged counts by day (≤30-day ranges) or week
  const bucketSize = dateRange.end.diff(dateRange.start, 'days') <= 30 ? 'day' : 'week';
  const bucketKeyFor = (time) => time.startOf(bucketSize).format('YYYY-MM-DD');
  const buckets = new Map();

  let current = dateRange.start.startOf(bucketSize);
  while (current.isBefore(dateRange.end)) {
    buckets.set(bucketKeyFor(current), {
      date: current.format('MMM D'),
      opened: 0,
      merged: 0
    });
    current = current.add(1, bucketSize);
  }

  opened.forEach(pr => {
    const bucket = buckets.get(bucketKeyFor(dayjs(pr.createdAt).tz(timezone)));
    if (bucket) bucket.opened++;
  });
  merged.forEach(pr => {
    const bucket = buckets.get(bucketKeyFor(dayjs(pr.mergedAt).tz(timezone)));
    if (bucket) bucket.merged++;
  });

  const chartData = Array.from(buckets.values());
  const hasActivity = opened.length > 0 || merged.length > 0;

  return (
    <>
      <StatTiles items={items} />
      <ChartCard>
        <CardTitle>🚀 Shipping Rhythm</CardTitle>
        <CardSubtitle>Your PRs opened vs merged over time</CardSubtitle>
        {hasActivity ? (
          <ChartWrap>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid vertical={false} stroke={COLOR_GRID} />
                <XAxis dataKey="date" stroke={COLOR_AXIS_TEXT} fontSize={12} axisLine={false} tickLine={false} />
                <YAxis stroke={COLOR_AXIS_TEXT} fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(240, 196, 108, 0.06)' }} />
                <Legend />
                <Bar dataKey="opened" fill={COLOR_OPENED} name="Opened" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="merged" fill={COLOR_MERGED} name="Merged" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrap>
        ) : (
          <NoData>No authored PR activity in this range.</NoData>
        )}
      </ChartCard>
    </>
  );
};

export default AuthoredAnalytics;
