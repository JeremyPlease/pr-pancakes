import React from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { calculateBusinessDaysMs } from '../analytics-utils';

// Extend dayjs with duration plugin
dayjs.extend(duration);

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled.div`
  background-color: #161b22;
  border-radius: 10px;
  padding: 18px 20px;
  border: 1px solid #21262d;
`;

const StatTitle = styled.h3`
  color: #8b949e;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

// Hero numbers wear text ink; color is reserved for status (missed > 0)
const StatValue = styled.div`
  color: #f0f6fc;
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;

  &[data-status="serious"] {
    color: #f85149;
  }
`;

const StatSubtext = styled.div`
  color: #8b949e;
  font-size: 12px;
  margin-top: 4px;
`;

const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return 'N/A';

  const duration = dayjs.duration(milliseconds);
  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const StatsCards = ({ data, dateRange, excludeWeekends }) => {
  // Calculate statistics from the raw data
  const calculateStats = () => {
    const stats = {
      totalReviews: 0,
      totalMissed: 0,
      totalRequests: 0,
      responseTimes: [],
      fastest: 0,
      slowest: 0,
      average: 0,
      p90: 0
    };

    if (!data || data.length === 0) {
      return stats;
    }

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

        stats.totalRequests++;

        if (review) {
          // Review was submitted
          const responseTime = excludeWeekends
            ? calculateBusinessDaysMs(requestTime, review.submittedAt)
            : dayjs(review.submittedAt).diff(requestTime);
          stats.responseTimes.push(responseTime);
          stats.totalReviews++;
        } else {
          // Check if this is a missed review (PR merged/closed without review)
          const prClosed = pr.mergedAt || pr.closedAt;
          if (prClosed && dayjs(prClosed).isAfter(requestTime)) {
            stats.totalMissed++;
          }
        }
      });
    });

    // Calculate time-based statistics
    if (stats.responseTimes.length > 0) {
      const sortedTimes = [...stats.responseTimes].sort((a, b) => a - b);

      stats.fastest = sortedTimes[0];
      stats.slowest = sortedTimes[sortedTimes.length - 1];
      stats.average = sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length;

      // P90 (90th percentile)
      const p90Index = Math.max(0, Math.ceil(sortedTimes.length * 0.9) - 1);
      stats.p90 = sortedTimes[p90Index];
    }

    return stats;
  };

  const stats = calculateStats();

  const statItems = [
    {
      title: 'Reviews Submitted',
      value: stats.totalReviews,
      subtext: `${stats.totalRequests} total requests`,
      icon: '✅'
    },
    {
      title: 'Reviews Missed',
      value: stats.totalMissed,
      subtext: 'PR merged without review',
      icon: '❌',
      status: stats.totalMissed > 0 ? 'serious' : undefined
    },
    {
      title: 'Fastest Response',
      value: formatDuration(stats.fastest),
      subtext: 'Best time to review',
      icon: '⚡'
    },
    {
      title: 'Slowest Response',
      value: formatDuration(stats.slowest),
      subtext: 'Longest time to review',
      icon: '🐌'
    },
    {
      title: 'Average Response',
      value: formatDuration(stats.average),
      subtext: 'Mean response time',
      icon: '📊'
    },
    {
      title: 'P90 Response Time',
      value: formatDuration(stats.p90),
      subtext: '90th percentile',
      icon: '📈'
    }
  ];

  return (
    <StatsContainer>
      {statItems.map((item, index) => (
        <StatCard key={index}>
          <StatTitle>
            {item.icon} {item.title}
          </StatTitle>
          <StatValue data-status={item.status}>{item.value}</StatValue>
          <StatSubtext>{item.subtext}</StatSubtext>
        </StatCard>
      ))}
    </StatsContainer>
  );
};

export default StatsCards;
