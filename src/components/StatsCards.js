import React from 'react';
import { collectReviewOutcomes, formatDurationMs, percentile } from '../analytics-utils';
import StatTiles from './StatTiles';

const StatsCards = ({ data, dateRange, excludeWeekends }) => {
  const outcomes = collectReviewOutcomes(data, dateRange, excludeWeekends);
  const sortedTimes = [...outcomes.responseTimes].sort((a, b) => a - b);

  const responseRate = outcomes.totalRequests > 0
    ? Math.round((outcomes.submitted / outcomes.totalRequests) * 100)
    : null;

  const items = [
    {
      icon: '✅',
      title: 'Reviews Submitted',
      value: outcomes.submitted,
      subtext: `${outcomes.totalRequests} requests in range`
    },
    {
      icon: '🎯',
      title: 'Response Rate',
      value: responseRate === null ? 'N/A' : `${responseRate}%`,
      subtext: 'requests you responded to',
      status: responseRate === null ? undefined :
        responseRate >= 80 ? 'good' :
        responseRate >= 50 ? 'warning' : 'serious'
    },
    {
      icon: '❌',
      title: 'Reviews Missed',
      value: outcomes.missed,
      subtext: 'PR closed without your review',
      status: outcomes.missed > 0 ? 'serious' : undefined
    },
    {
      icon: '⏳',
      title: 'Still Pending',
      value: outcomes.pending,
      subtext: 'awaiting your review'
    },
    {
      icon: '🕐',
      title: 'Median Response',
      value: formatDurationMs(percentile(sortedTimes, 0.5)),
      subtext: 'your typical turnaround'
    },
    {
      icon: '📈',
      title: 'P90 Response',
      value: formatDurationMs(percentile(sortedTimes, 0.9)),
      subtext: '90th percentile'
    },
    {
      icon: '⚡',
      title: 'Fastest Response',
      value: formatDurationMs(sortedTimes[0]),
      subtext: 'best turnaround'
    },
    {
      icon: '🐌',
      title: 'Slowest Response',
      value: formatDurationMs(sortedTimes[sortedTimes.length - 1]),
      subtext: 'longest turnaround'
    }
  ];

  return <StatTiles items={items} />;
};

export default StatsCards;
