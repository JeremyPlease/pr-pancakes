import React from 'react';
import styled from 'styled-components';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { calculateBusinessDaysMs } from '../analytics-utils';

// Extend dayjs with duration plugin
dayjs.extend(duration);

const ChartContainer = styled.div`
  background-color: #161b22;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
`;

const ChartTitle = styled.h3`
  color: #f0c46c;
  margin: 0;
  font-size: 1.2rem;
`;

const MetricSelector = styled.select`
  background-color: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #f0c46c;
    box-shadow: 0 0 0 2px rgba(240, 196, 108, 0.2);
  }

  option {
    background-color: #21262d;
    color: #c9d1d9;
  }
`;

const ChartWrapper = styled.div`
  height: 400px;
  width: 100%;
`;

const NoDataMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #8b949e;
  font-size: 16px;
  text-align: center;
`;

const CHART_METRICS = [
  { key: 'reviewCounts', label: 'Reviews Requested vs Submitted', type: 'bar' },
  { key: 'averageResponseTime', label: 'Average Response Time', type: 'line' },
  { key: 'p90ResponseTime', label: 'P90 Response Time', type: 'line' }
];

const msToHours = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return 0;

  const hours = dayjs.duration(milliseconds).asHours();

  return Math.round(hours * 10) / 10; // Round to 1 decimal place
};

const CustomTooltip = ({ active, payload, label, metric }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '12px',
        color: '#c9d1d9'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{`Date: ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: '4px 0', color: entry.color }}>
            {`${entry.name || entry.dataKey}: ${
              metric.type === 'line' && entry.dataKey.includes('Time')
                ? `${entry.value}h`
                : entry.value
            }`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const VelocityChart = ({ data, dateRange, metric, onMetricChange, timezone, excludeWeekends }) => {
  // Process data into chart format
  const processChartData = () => {
    if (!data || data.length === 0) {
      return [];
    }

    const bucketSize = dateRange.end.diff(dateRange.start, 'days') <= 30 ? 'day' : 'week';
    // Key buckets by the bucket's start date; the WW week-of-year format token
    // would require extra dayjs plugins, and a plain date works for both sizes.
    const bucketKeyFor = (time) => time.startOf(bucketSize).format('YYYY-MM-DD');
    const buckets = new Map();

    // Initialize buckets
    let current = dateRange.start.startOf(bucketSize);
    while (current.isBefore(dateRange.end)) {
      buckets.set(bucketKeyFor(current), {
        date: current.format('MMM D'),
        reviewsRequested: 0,
        reviewsSubmitted: 0,
        responseTimes: []
      });
      current = current.add(1, bucketSize);
    }

    // Populate buckets with data
    data.forEach(pr => {
      pr.reviewRequestEvents.forEach(requestEvent => {
        const requestTime = dayjs(requestEvent.requestedAt).tz(timezone);

        if (requestTime.isBefore(dateRange.start) || requestTime.isAfter(dateRange.end)) {
          return;
        }

        const bucket = buckets.get(bucketKeyFor(requestTime));
        if (!bucket) {
          return;
        }

        bucket.reviewsRequested++;

        const review = requestEvent.matchingReview;
        if (review) {
          bucket.reviewsSubmitted++;
          const responseTime = excludeWeekends
            ? calculateBusinessDaysMs(requestEvent.requestedAt, review.submittedAt)
            : dayjs(review.submittedAt).diff(dayjs(requestEvent.requestedAt));
          bucket.responseTimes.push(responseTime);
        }
      });
    });

    // Calculate aggregated metrics for each bucket
    return Array.from(buckets.values()).map(bucket => {
      const avgResponseTime = bucket.responseTimes.length > 0
        ? bucket.responseTimes.reduce((sum, time) => sum + time, 0) / bucket.responseTimes.length
        : 0;

      const sortedTimes = [...bucket.responseTimes].sort((a, b) => a - b);
      const p90ResponseTime = sortedTimes.length > 0
        ? sortedTimes[Math.max(0, Math.ceil(sortedTimes.length * 0.9) - 1)]
        : 0;

      return {
        date: bucket.date,
        reviewsRequested: bucket.reviewsRequested,
        reviewsSubmitted: bucket.reviewsSubmitted,
        averageResponseTime: msToHours(avgResponseTime),
        p90ResponseTime: msToHours(p90ResponseTime)
      };
    });
  };

  const chartData = processChartData();
  const selectedMetric = CHART_METRICS.find(m => m.key === metric) || CHART_METRICS[0];

  if (chartData.length === 0) {
    return (
      <ChartContainer>
        <ChartHeader>
          <ChartTitle>📈 Review Velocity Chart</ChartTitle>
        </ChartHeader>
        <NoDataMessage>
          No data available for the selected date range.
          <br />
          Try selecting a different time period or check if you have any review requests.
        </NoDataMessage>
      </ChartContainer>
    );
  }

  const renderChart = () => {
    if (selectedMetric.type === 'bar') {
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="date"
            stroke="#8b949e"
            fontSize={12}
          />
          <YAxis
            stroke="#8b949e"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
          <Legend />
          <Bar
            dataKey="reviewsRequested"
            fill="#6e7681"
            name="Reviews Requested"
          />
          <Bar
            dataKey="reviewsSubmitted"
            fill="#f0c46c"
            name="Reviews Submitted"
          />
        </BarChart>
      );
    } else {
      const dataKey = selectedMetric.key;
      return (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="date"
            stroke="#8b949e"
            fontSize={12}
          />
          <YAxis
            stroke="#8b949e"
            fontSize={12}
            label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#8b949e' } }}
          />
          <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#f0c46c"
            strokeWidth={3}
            dot={{ fill: '#f0c46c', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#f0c46c', strokeWidth: 2 }}
          />
        </LineChart>
      );
    }
  };

  return (
    <ChartContainer>
      <ChartHeader>
        <ChartTitle>📈 Review Velocity Chart</ChartTitle>
        <MetricSelector
          value={metric}
          onChange={(e) => onMetricChange(e.target.value)}
        >
          {CHART_METRICS.map(m => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </MetricSelector>
      </ChartHeader>

      <ChartWrapper>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </ChartWrapper>
    </ChartContainer>
  );
};

export default VelocityChart;
