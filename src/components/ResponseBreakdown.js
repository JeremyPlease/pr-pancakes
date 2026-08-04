import React from 'react';
import styled from 'styled-components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { collectReviewOutcomes } from '../analytics-utils';

const COLOR_SUBMITTED = '#bf8700';
const COLOR_GRID = '#21262d';
const COLOR_AXIS_TEXT = '#8b949e';

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
  margin: 0 0 12px;
`;

const ChartWrap = styled.div`
  height: 220px;
`;

const NoData = styled.div`
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6e7681;
  font-size: 13px;
`;

// Ascending buckets; max = upper bound in ms
const HISTOGRAM_BUCKETS = [
  { label: '<1h', max: 3600000 },
  { label: '1–4h', max: 4 * 3600000 },
  { label: '4–24h', max: 24 * 3600000 },
  { label: '1–3d', max: 3 * 86400000 },
  { label: '3–7d', max: 7 * 86400000 },
  { label: '>7d', max: Infinity }
];

// Monday-first work week
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DarkTooltip = ({ active, payload, label, unit }) => {
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
      <strong>{label}</strong>: {payload[0].value} {unit}
    </div>
  );
};

const SmallBarChart = ({ data, unit }) => (
  <ChartWrap>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke={COLOR_GRID} />
        <XAxis dataKey="label" stroke={COLOR_AXIS_TEXT} fontSize={12} axisLine={false} tickLine={false} />
        <YAxis stroke={COLOR_AXIS_TEXT} fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<DarkTooltip unit={unit} />} cursor={{ fill: 'rgba(240, 196, 108, 0.06)' }} />
        <Bar dataKey="count" fill={COLOR_SUBMITTED} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  </ChartWrap>
);

const ResponseBreakdown = ({ data, dateRange, excludeWeekends, timezone }) => {
  const outcomes = collectReviewOutcomes(data, dateRange, excludeWeekends);

  const histogramData = HISTOGRAM_BUCKETS.map((bucket, index) => ({
    label: bucket.label,
    count: outcomes.responseTimes.filter(ms => {
      const lower = index === 0 ? -1 : HISTOGRAM_BUCKETS[index - 1].max;
      return ms > lower && ms <= bucket.max;
    }).length
  }));

  const weekdayCounts = WEEKDAYS.map(label => ({ label, count: 0 }));
  outcomes.reviewTimestamps.forEach(ts => {
    // dayjs: 0 = Sunday … 6 = Saturday; remap to Monday-first
    const day = dayjs(ts).tz(timezone).day();
    weekdayCounts[(day + 6) % 7].count++;
  });

  const hasReviews = outcomes.responseTimes.length > 0;

  return (
    <Grid>
      <Card>
        <CardTitle>⏱️ Response Time Spread</CardTitle>
        <CardSubtitle>How long review requests wait before you respond</CardSubtitle>
        {hasReviews
          ? <SmallBarChart data={histogramData} unit="reviews" />
          : <NoData>No submitted reviews in this range.</NoData>}
      </Card>
      <Card>
        <CardTitle>📅 Griddle Schedule</CardTitle>
        <CardSubtitle>Which weekdays you flip the most reviews</CardSubtitle>
        {hasReviews
          ? <SmallBarChart data={weekdayCounts} unit="reviews" />
          : <NoData>No submitted reviews in this range.</NoData>}
      </Card>
    </Grid>
  );
};

export default ResponseBreakdown;
