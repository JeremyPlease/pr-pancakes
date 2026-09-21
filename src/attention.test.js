import { buildCards } from './attention';

jest.mock('@octokit/graphql', () => ({ graphql: { defaults: jest.fn() } }));

const NOW = Date.parse('2026-09-18T12:00:00Z');
const me = { __typename: 'User', login: 'me' };
const alice = { __typename: 'User', login: 'alice' };

const makePr = overrides => ({
  id: 'PR_1',
  number: 1,
  title: 'feat: pancakes',
  url: 'https://github.com/acme/griddle/pull/1',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  reviewDecision: null,
  createdAt: '2026-09-10T00:00:00Z',
  updatedAt: '2026-09-17T00:00:00Z',
  closedAt: null,
  body: '',
  additions: 10,
  deletions: 5,
  changedFiles: 2,
  totalCommentsCount: 1,
  author: alice,
  repository: { nameWithOwner: 'acme/griddle' },
  viewerLatestReview: null,
  reviewRequests: { nodes: [] },
  latestReviews: { nodes: [] },
  commits: { nodes: [{ commit: { committedDate: '2026-09-16T00:00:00Z', statusCheckRollup: { state: 'SUCCESS' } } }] },
  comments: { totalCount: 0, nodes: [] },
  reviews: { nodes: [] },
  reviewThreads: { totalCount: 0, nodes: [] },
  timelineItems: { nodes: [] },
  ...overrides
});

const cardFor = (pr, sources) => buildCards([{ pr, sources }], 'me', NOW)[0];

describe('buildCards', () => {
  it('puts a direct review request in the direct section, aged from the request', () => {
    const card = cardFor(makePr({
      reviewRequests: { nodes: [{ requestedReviewer: me }] },
      timelineItems: { nodes: [{ __typename: 'ReviewRequestedEvent', createdAt: '2026-09-15T12:00:00Z', requestedReviewer: me }] }
    }), ['requested']);

    expect(card).toMatchObject({ section: 'direct', ageDays: 3, ageLevel: 'warn', size: 'XS', repo: 'griddle' });
    expect(card.reasons[0].text).toBe('Review requested from you');
  });

  it('surfaces replies after my last activity, even on merged PRs', () => {
    const card = cardFor(makePr({
      state: 'MERGED',
      comments: {
        totalCount: 2,
        nodes: [
          { author: me, createdAt: '2026-09-12T00:00:00Z', body: 'why?', url: 'c1' },
          { author: alice, createdAt: '2026-09-13T00:00:00Z', body: '> why?\nbecause syrup', url: 'c2' }
        ]
      }
    }), ['involves']);

    expect(card.section).toBe('replies');
    expect(card.reasons).toEqual([expect.objectContaining({ kind: 'comment', who: 'alice', text: 'because syrup' })]);
  });

  it('reports status problems on my own PRs and changes the key when reasons change', () => {
    const mine = makePr({ author: me, reviewDecision: 'APPROVED', latestReviews: { nodes: [{ author: alice, state: 'APPROVED', submittedAt: '2026-09-16T00:00:00Z' }] } });
    const approved = cardFor(mine, ['authored']);
    const conflicting = cardFor({ ...mine, mergeable: 'CONFLICTING' }, ['authored']);

    expect(approved.section).toBe('mine');
    expect(approved.reasons.map(r => r.kind)).toEqual(['approved']);
    expect(conflicting.reasons.map(r => r.kind).sort()).toEqual(['approved', 'conflicts']);
    expect(conflicting.key).not.toBe(approved.key);
  });

  const teamRequest = { __typename: 'ReviewRequestedEvent', createdAt: '2026-09-17T09:00:00Z', requestedReviewer: { __typename: 'Team', slug: 'syrup' } };
  const aliceReview = { author: alice, state: 'COMMENTED', submittedAt: '2026-09-17T11:00:00Z' };

  it('keeps an open team request in FYI after a teammate reviewed and the request vanished', () => {
    const card = cardFor(makePr({ timelineItems: { nodes: [teamRequest] }, latestReviews: { nodes: [aliceReview] } }), ['reviewNotification']);

    expect(card.section).toBe('fyi');
    expect(card.reasons[0].text).toBe('Review requested from team syrup — already reviewed by alice');
  });

  it('shows team-requested PRs merged without my review, but not ones I reviewed', () => {
    const merged = makePr({
      state: 'MERGED',
      closedAt: '2026-09-17T12:00:00Z',
      timelineItems: { nodes: [teamRequest, { __typename: 'MergedEvent', actor: { login: 'alice' } }] }
    });
    const approvedByMe = { ...merged, viewerLatestReview: { state: 'APPROVED', submittedAt: '2026-09-17T10:00:00Z' } };

    expect(cardFor(merged, ['closedRequested'])).toMatchObject({ section: 'fyi', reasons: [expect.objectContaining({ text: 'Merged by alice without a review from team syrup' })] });
    expect(cardFor(approvedByMe, ['closedRequested'])).toBeUndefined();
  });

  it('drops PRs with nothing to act on', () => {
    expect(buildCards([{ pr: makePr(), sources: ['involves'] }], 'me', NOW)).toEqual([]);
  });
});
