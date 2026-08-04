import dayjs from 'dayjs';

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
