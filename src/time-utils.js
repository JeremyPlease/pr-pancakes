import { formatDistanceToNow } from 'date-fns';

// date-fns hedges its coarse buckets ("about 8 hours", "about 1 month"); the
// approximation is already implied, so drop the qualifier.
export const distanceToNow = (date) =>
  formatDistanceToNow(date).replace(/^about /, '');
