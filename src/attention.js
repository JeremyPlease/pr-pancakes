import { graphql } from '@octokit/graphql';

export const ATTENTION_CONFIG = {
  lookbackDays: 30,
  staleDays: 90,
  ageWarnDays: 2,
  ageAlertDays: 4,
  hotCommentCount: 20,
  sizeBuckets: [['XS', 50], ['S', 200], ['M', 500], ['L', 1000]],
  fyiIgnoreTitles: ['^release[:/ ]', '^chore: merge master back']
};

const DAY = 86400000;
const MAX_THREADS = 40;
const MAX_COMMENTS = 30;
const MAX_THREAD_COMMENTS = 15;

const ACTOR = 'author{__typename login}';
const REVIEWER = 'requestedReviewer{__typename ... on User{login} ... on Team{slug}}';
const PR_FIELDS = `
  id number title url state isDraft mergeable reviewDecision createdAt updatedAt closedAt body
  additions deletions changedFiles totalCommentsCount
  ${ACTOR} repository{nameWithOwner}
  viewerLatestReview{state submittedAt}
  reviewRequests(first:20){nodes{${REVIEWER}}}
  latestReviews(first:20){nodes{${ACTOR} state submittedAt}}
  commits(last:1){nodes{commit{committedDate statusCheckRollup{state}}}}
  comments(last:${MAX_COMMENTS}){totalCount nodes{${ACTOR} createdAt body url}}
  reviews(last:30){nodes{${ACTOR} state submittedAt body url}}
  reviewThreads(last:${MAX_THREADS}){totalCount nodes{isResolved comments(last:${MAX_THREAD_COMMENTS}){totalCount nodes{${ACTOR} createdAt body url}}}}
  timelineItems(last:30,itemTypes:[REVIEW_REQUESTED_EVENT,READY_FOR_REVIEW_EVENT,MERGED_EVENT,CLOSED_EVENT]){nodes{
    __typename
    ... on ReviewRequestedEvent{createdAt ${REVIEWER}}
    ... on ReadyForReviewEvent{createdAt}
    ... on MergedEvent{actor{login}}
    ... on ClosedEvent{actor{login}}
  }}`;
const VIEWER_QUERY = 'query{viewer{login}}';
const SEARCH_QUERY = `query($q:String!,$endCursor:String){search(query:$q,type:ISSUE,first:20,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{... on PullRequest{${PR_FIELDS}}}}}`;
const PR_QUERY = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){${PR_FIELDS}}}}`;

const maxAt = items => items.map(i => i.at).filter(Boolean).sort().at(-1) ?? '';
const minAt = items => items.map(i => i.at).filter(Boolean).sort()[0] ?? '';
const unquoted = text => (text ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(line => !line.trimStart().startsWith('>')).join('\n');
const snippet = text => unquoted(text).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 220);
const requestedLogins = nodes => nodes.map(n => n.requestedReviewer?.login ?? n.requestedReviewer?.slug).filter(Boolean);
const reviewRequestEvents = pr => pr.timelineItems.nodes.filter(e => e.__typename === 'ReviewRequestedEvent');

const activities = pr => [
  ...pr.comments.nodes.map(c => ({ kind: 'comment', author: c.author, at: c.createdAt, text: c.body, url: c.url })),
  ...pr.reviews.nodes.map(r => ({ kind: 'review', state: r.state, author: r.author, at: r.submittedAt, text: r.body, url: r.url })),
  ...pr.reviewThreads.nodes.flatMap(t => t.comments.nodes.map(c => ({ kind: 'thread', author: c.author, at: c.createdAt })))
].filter(a => a.at);

export const buildCards = (found, login, now = Date.now(), config = ATTENTION_CONFIG) => {
  const daysAgo = n => new Date(now - n * DAY).toISOString();
  const lookbackStart = daysAgo(config.lookbackDays);
  const staleStart = daysAgo(config.staleDays);
  const isMe = a => a?.login === login;
  const isOther = a => !!a && a.__typename !== 'Bot' && !isMe(a);
  const mentionsMe = text => new RegExp(`@${login}\\b`, 'i').test(unquoted(text));

  const conversationReasons = (pr, mine, myLast) => {
    const fresh = a => isOther(a.author) && a.at > myLast && a.at >= lookbackStart;
    const threads = pr.reviewThreads.nodes
      .filter(t => mine || t.comments.nodes.some(c => isMe(c.author) || mentionsMe(c.body)))
      .map(t => ({ last: t.comments.nodes.at(-1), resolved: t.isResolved }))
      .filter(({ last }) => last && fresh({ author: last.author, at: last.createdAt }))
      .map(({ last, resolved }) => ({ kind: 'reply', who: last.author.login, at: last.createdAt, text: snippet(last.body), url: last.url, resolved }));
    const comments = activities(pr)
      .filter(a => a.kind === 'comment' && fresh(a) && (mine || myLast || mentionsMe(a.text)))
      .map(a => ({ kind: mentionsMe(a.text) ? 'mention' : 'comment', who: a.author.login, at: a.at, text: snippet(a.text), url: a.url }));
    const reviews = activities(pr)
      .filter(a => a.kind === 'review' && fresh(a) && snippet(a.text) && (mine || mentionsMe(a.text)))
      .map(a => ({ kind: mentionsMe(a.text) ? 'mention' : 'review', who: a.author.login, at: a.at, text: snippet(`${a.state.replace('_', ' ').toLowerCase()} — ${a.text}`), url: a.url }));
    const body = !mine && !myLast && mentionsMe(pr.body) && pr.createdAt >= lookbackStart
      ? [{ kind: 'mention', who: pr.author?.login, at: pr.createdAt, text: 'Mentioned you in the PR description', url: pr.url }]
      : [];
    return [...threads, ...comments, ...reviews, ...body];
  };

  const reviewReasons = (pr, sources, mine) => {
    if (pr.state !== 'OPEN' || mine) return [];
    const requests = reviewRequestEvents(pr);
    const direct = pr.reviewRequests.nodes.some(n => isMe(n.requestedReviewer));
    if (direct) {
      const at = maxAt(requests.filter(e => isMe(e.requestedReviewer)).map(e => ({ at: e.createdAt }))) || pr.createdAt;
      return [{ kind: 'review-direct', at, url: pr.url, text: pr.viewerLatestReview ? 'Re-review requested from you' : 'Review requested from you' }];
    }
    if (pr.isDraft) return [];
    if (sources.includes('requested')) {
      const teams = pr.reviewRequests.nodes.map(n => n.requestedReviewer?.slug).filter(Boolean);
      const at = maxAt(requests.filter(e => e.requestedReviewer?.slug).map(e => ({ at: e.createdAt }))) || pr.createdAt;
      return [{ kind: 'review-team', at, url: pr.url, text: `Review requested from team ${teams.join(', ')}` }];
    }
    const review = pr.viewerLatestReview;
    const pushed = pr.commits.nodes[0]?.commit.committedDate;
    if (!review?.submittedAt || !pushed || pushed <= review.submittedAt) return [];
    return review.state === 'APPROVED'
      ? [{ kind: 'fyi-commits', at: pushed, url: `${pr.url}/commits`, text: 'New commits since you approved' }]
      : [{ kind: 'updated', at: pushed, url: `${pr.url}/files`, text: `New commits since your review (${review.state.replace('_', ' ').toLowerCase()})` }];
  };

  const ownStatusReasons = (pr, mine) => {
    if (pr.state !== 'OPEN' || !mine) return [];
    const commit = pr.commits.nodes[0]?.commit;
    const reviewAt = state => maxAt(pr.latestReviews.nodes.filter(r => r.state === state).map(r => ({ at: r.submittedAt })));
    const reviewers = state => pr.latestReviews.nodes.filter(r => r.state === state).map(r => r.author?.login).join(', ');
    const waitingOn = requestedLogins(pr.reviewRequests.nodes);
    const requestedAt = maxAt(reviewRequestEvents(pr).map(e => ({ at: e.createdAt })));
    const reason = (kind, at, text) => ({ kind, at: at || pr.createdAt, url: pr.url, text });
    const problems = [
      ['FAILURE', 'ERROR'].includes(commit?.statusCheckRollup?.state) && reason('ci-failing', commit.committedDate, 'CI is failing'),
      pr.mergeable === 'CONFLICTING' && reason('conflicts', commit?.committedDate, 'Has merge conflicts')
    ].filter(Boolean);
    const stillRequested = waitingOn.length ? ` · still requested: ${waitingOn.join(', ')}` : '';
    const status =
      pr.reviewDecision === 'CHANGES_REQUESTED' ? reason('changes-requested', reviewAt('CHANGES_REQUESTED'), `Changes requested by ${reviewers('CHANGES_REQUESTED')}`)
      : pr.reviewDecision === 'APPROVED' ? reason('approved', reviewAt('APPROVED'), `Approved by ${reviewers('APPROVED')} — ready to merge${stillRequested}`)
      : pr.isDraft ? reason('draft', pr.createdAt, 'Still a draft')
      : waitingOn.length ? reason('waiting', requestedAt, `Waiting on ${waitingOn.join(', ')}`)
      : reason('no-reviewer', pr.createdAt, 'No reviewer requested');
    return [...problems, status];
  };

  const closedReasons = (pr, sources, myLast) => {
    const ignored = config.fyiIgnoreTitles.some(p => new RegExp(p, 'i').test(pr.title));
    if (pr.state === 'OPEN' || !sources.includes('closedRequested') || pr.viewerLatestReview || myLast || ignored) return [];
    const event = pr.timelineItems.nodes.findLast(e => ['MergedEvent', 'ClosedEvent'].includes(e.__typename));
    const verb = pr.state === 'MERGED' ? 'Merged' : 'Closed';
    return [{ kind: 'fyi-closed', at: pr.closedAt, url: pr.url, text: `${verb} by ${event?.actor?.login ?? 'someone'} without your review` }];
  };

  const sectionOf = (pr, mine, reasons) => {
    const kinds = reasons.map(r => r.kind);
    const has = (...wanted) => wanted.some(k => kinds.includes(k));
    const section =
      mine && pr.state === 'OPEN' ? 'mine'
      : has('review-direct') ? 'direct'
      : has('reply', 'mention', 'comment', 'review') ? 'replies'
      : has('updated') ? 'updated'
      : has('review-team') ? 'team'
      : 'fyi';
    const quiet = pr.updatedAt < staleStart && maxAt(reasons) < staleStart;
    return quiet && ['direct', 'updated', 'team'].includes(section) ? 'stale' : section;
  };

  const sizeOf = lines => (config.sizeBuckets.find(([, max]) => lines < max) ?? ['XL'])[0];
  const ageLevel = days => (days >= config.ageAlertDays ? 'alert' : days >= config.ageWarnDays ? 'warn' : 'ok');

  const toCard = ({ pr, sources }) => {
    const mine = isMe(pr.author);
    const myLast = maxAt(activities(pr).filter(a => isMe(a.author)));
    const reasons = [
      ...reviewReasons(pr, sources, mine),
      ...ownStatusReasons(pr, mine),
      ...conversationReasons(pr, mine, myLast),
      ...closedReasons(pr, sources, myLast)
    ].sort((a, b) => b.at.localeCompare(a.at));
    if (!reasons.length) return null;
    const section = sectionOf(pr, mine, reasons);
    const readyAt = maxAt(pr.timelineItems.nodes.filter(e => e.__typename === 'ReadyForReviewEvent').map(e => ({ at: e.createdAt }))) || pr.createdAt;
    const ageDays = Math.floor((now - Date.parse(section === 'mine' ? readyAt : minAt(reasons))) / DAY);
    const commentCount = pr.totalCommentsCount ?? 0;
    return {
      id: pr.id,
      url: pr.url,
      repo: pr.repository.nameWithOwner.split('/')[1],
      number: pr.number,
      title: pr.title,
      author: pr.author?.login ?? 'ghost',
      state: pr.state,
      isDraft: pr.isDraft,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      size: sizeOf(pr.additions + pr.deletions),
      commentCount,
      hot: commentCount >= config.hotCommentCount,
      unresolvedThreads: pr.reviewThreads.nodes.filter(t => !t.isResolved).length,
      ci: pr.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
      truncated: pr.reviewThreads.totalCount > MAX_THREADS || pr.comments.totalCount > MAX_COMMENTS || pr.reviewThreads.nodes.some(t => t.comments.totalCount > MAX_THREAD_COMMENTS),
      section,
      reasons,
      ageDays,
      ageLevel: section === 'fyi' || pr.isDraft ? 'neutral' : ageLevel(ageDays),
      key: `${pr.url}@${maxAt(reasons)}|${[...new Set(reasons.map(r => r.kind))].sort().join(',')}`
    };
  };

  const newestFirst = ['replies', 'fyi'];
  const byPriority = (a, b) =>
    a.isDraft - b.isDraft ||
    (newestFirst.includes(a.section) ? maxAt(b.reasons).localeCompare(maxAt(a.reasons)) : b.ageDays - a.ageDays);

  return found.map(toCard).filter(Boolean).sort(byPriority);
};

const searchAll = async (gql, q, endCursor = null) => {
  const { nodes, pageInfo } = (await gql(SEARCH_QUERY, { q, endCursor })).search;
  const prs = nodes.filter(n => n?.url);
  return pageInfo.hasNextPage ? [...prs, ...await searchAll(gql, q, pageInfo.endCursor)] : prs;
};

const participatingPrUrls = async (token, since, page = 1) => {
  const perPage = 50;
  const response = await fetch(
    `https://api.github.com/notifications?all=true&participating=true&since=${since}&per_page=${perPage}&page=${page}`,
    { headers: { authorization: `token ${token}`, accept: 'application/vnd.github+json' } }
  );
  if (!response.ok) return [];
  const notifications = await response.json();
  const urls = notifications
    .filter(n => n.subject.type === 'PullRequest' && n.reason !== 'review_requested')
    .map(n => `${n.repository.html_url}/pull/${n.subject.url.split('/').pop()}`);
  return notifications.length === perPage ? [...urls, ...await participatingPrUrls(token, since, page + 1)] : urls;
};

const fetchPr = async (gql, url) => {
  const [, owner, name, number] = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  const result = await gql(PR_QUERY, { owner, name, number: Number(number) }).catch(() => null);
  return result?.repository?.pullRequest ?? null;
};

const inBatches = async (items, size, fn) =>
  items.length
    ? [...await Promise.all(items.slice(0, size).map(fn)), ...await inBatches(items.slice(size), size, fn)]
    : [];

export const fetchAttention = async token => {
  const authed = graphql.defaults({ headers: { authorization: `token ${token}` } });
  const gql = (query, vars) => authed(query, vars).catch(error => {
    if (!error.data) throw error;
    return error.data;
  });
  const now = Date.now();
  const lookbackStart = new Date(now - ATTENTION_CONFIG.lookbackDays * DAY).toISOString();
  const since = lookbackStart.slice(0, 10);
  const queries = {
    involves: `involves:@me updated:>=${since}`,
    reviewed: `reviewed-by:@me updated:>=${since}`,
    requested: 'is:open review-requested:@me',
    closedRequested: `is:closed user-review-requested:@me closed:>=${since}`,
    authored: 'is:open author:@me'
  };

  const [viewer, notified, ...results] = await Promise.all([
    gql(VIEWER_QUERY),
    participatingPrUrls(token, lookbackStart).catch(() => []),
    ...Object.values(queries).map(q => searchAll(gql, `is:pr archived:false ${q}`))
  ]);

  const sourcesByUrl = Object.keys(queries).reduce(
    (acc, source, i) => results[i].reduce((inner, pr) => ({ ...inner, [pr.url]: [...(inner[pr.url] ?? []), source] }), acc),
    {}
  );
  const searched = [...new Map(results.flat().map(pr => [pr.url, pr])).values()]
    .map(pr => ({ pr, sources: sourcesByUrl[pr.url] }));
  const extraUrls = [...new Set(notified)].filter(url => !sourcesByUrl[url]);
  const extras = (await inBatches(extraUrls, 5, url => fetchPr(gql, url)))
    .filter(Boolean)
    .map(pr => ({ pr, sources: ['notification'] }));

  return {
    generatedAt: new Date(now).toISOString(),
    login: viewer.viewer.login,
    prs: buildCards([...searched, ...extras], viewer.viewer.login, now)
  };
};
