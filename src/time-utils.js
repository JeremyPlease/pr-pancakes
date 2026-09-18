import { formatDistanceToNow } from 'date-fns';

// date-fns hedges its coarse buckets ("about 8 hours", "about 1 month"); the
// approximation is already implied, so drop the qualifier.
export const distanceToNow = (date) =>
  formatDistanceToNow(date).replace(/^about /, '');

export const shortTimeAgo = (date) => {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
