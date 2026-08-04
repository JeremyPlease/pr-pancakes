import dayjs from 'dayjs';

// "2d 5h" / "3h 12m" / "45m" — compact duration for stat tiles
export const formatDurationMs = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return 'N/A';

  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// p in [0, 1] over an ascending-sorted array
export const percentile = (sortedValues, p) =>
  sortedValues.length ? sortedValues[Math.max(0, Math.ceil(sortedValues.length * p) - 1)] : 0;

// Walk every review request in the processed review data and classify it the
// same way everywhere: submitted (with response time), missed (PR closed
// without your review), or still pending. All analytics cards derive from
// this so their numbers always agree.
export const collectReviewOutcomes = (data, dateRange, excludeWeekends) => {
  const outcomes = {
    totalRequests: 0,
    submitted: 0,
    missed: 0,
    pending: 0,
    responseTimes: [],
    reviewTimestamps: []
  };

  (data || []).forEach(pr => {
    pr.reviewRequestEvents.forEach(requestEvent => {
      const requestTime = dayjs(requestEvent.requestedAt);
      const review = requestEvent.matchingReview;
      const reviewTime = review ? dayjs(review.submittedAt) : null;

      // Keep the event if either the request or its response falls in range
      if (
        (requestTime.isBefore(dateRange.start) || requestTime.isAfter(dateRange.end)) &&
        (!reviewTime || reviewTime.isBefore(dateRange.start) || reviewTime.isAfter(dateRange.end))
      ) {
        return;
      }

      outcomes.totalRequests++;

      if (review) {
        outcomes.submitted++;
        outcomes.responseTimes.push(
          excludeWeekends
            ? calculateBusinessDaysMs(requestTime, review.submittedAt)
            : dayjs(review.submittedAt).diff(requestTime)
        );
        outcomes.reviewTimestamps.push(review.submittedAt);
      } else {
        const prClosed = pr.mergedAt || pr.closedAt;
        if (prClosed && dayjs(prClosed).isAfter(requestTime)) {
          outcomes.missed++;
        } else {
          outcomes.pending++;
        }
      }
    });
  });

  return outcomes;
};

// Calculate elapsed milliseconds between two dates counting only weekdays
// (Monday–Friday). Partial days are counted by actual elapsed time.
export const calculateBusinessDaysMs = (startDate, endDate) => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  if (end.isBefore(start)) {
    return 0;
  }

  let current = start.clone();
  let businessMs = 0;

  while (current.isBefore(end)) {
    const dayOfWeek = current.day(); // 0 = Sunday, 6 = Saturday
    const nextDay = current.add(1, 'day');

    // Only count weekdays (Monday = 1 to Friday = 5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dayEnd = nextDay.isAfter(end) ? end : nextDay;
      businessMs += dayEnd.diff(current);
    }

    current = nextDay;
  }

  return businessMs;
};
