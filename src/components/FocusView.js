import React from 'react';
import styled from 'styled-components';
import { distanceToNow } from '../time-utils';

const FocusContainer = styled.div`
  padding: 4px 0 20px;
`;

const PageTitle = styled.h1`
  color: #f0c46c;
  margin: 0 0 4px;
  font-size: 1.4rem;
  font-weight: 700;
`;

const PageSubtitle = styled.p`
  color: #8b949e;
  margin: 0 0 24px;
  font-size: 14px;
`;

const Bucket = styled.section`
  margin-bottom: 28px;
`;

const BucketHeader = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 4px;

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: #f0f6fc;
  }

  .count {
    color: #8b949e;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
`;

const BucketDesc = styled.p`
  color: #8b949e;
  font-size: 13px;
  margin: 0 0 12px;
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Card = styled.button`
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  text-align: left;
  background-color: #161b22;
  border: 1px solid #21262d;
  border-left: 3px solid ${props => props.$accent};
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  color: #c9d1d9;
  font-size: 14px;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background-color: #1c2128;
    border-color: #30363d;
    border-left-color: ${props => props.$accent};
  }

  .ref {
    white-space: nowrap;
    flex-shrink: 0;

    .repo { color: #8b949e; }
    .num { color: #f0c46c; font-weight: 600; }
  }

  .title {
    flex: 1;
    min-width: 0;
    color: #e6edf3;
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  .meta {
    flex-shrink: 0;
    color: #8b949e;
    font-size: 13px;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    flex-wrap: wrap;
    gap: 4px 12px;

    .title {
      flex-basis: 100%;
      white-space: normal;
    }
  }
`;

const EmptyBucket = styled.div`
  color: #6e7681;
  font-size: 13px;
  padding: 10px 16px;
  background-color: #161b22;
  border: 1px dashed #21262d;
  border-radius: 8px;
`;

const AllClear = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  gap: 8px;
  background-color: #161b22;
  border-radius: 10px;
  color: #8b949e;
  text-align: center;

  .big { font-size: 44px; }
  .headline { font-size: 18px; color: #e6edf3; }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 3px solid rgba(240, 196, 108, 0.2);
  border-radius: 50%;
  border-top: 3px solid #f0c46c;
  animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  gap: 16px;
  background-color: #161b22;
  border-radius: 10px;
  color: #8b949e;
`;

const byOldestCreated = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

// Order = priority: unblock your own work, then reviews you owe, then
// team requests you could pick up.
const buildBuckets = (prs, isDismissed) => {
  const visible = (list) => (list || []).filter(pr => !isDismissed(pr));

  const authored = visible(prs.authored);
  const ready = authored.filter(pr =>
    pr.reviewCounts?.approved > 0 &&
    !pr.reviewCounts?.changes &&
    pr.unresolvedThreads === 0
  );
  const needsFix = authored.filter(pr =>
    !ready.includes(pr) &&
    (pr.reviewCounts?.changes > 0 || pr.unresolvedThreads > 0)
  );

  return [
    {
      key: 'ready',
      icon: '🧈',
      title: 'Ready to serve',
      desc: 'Your PRs — approved with nothing outstanding. Merge away.',
      accent: '#2ea043',
      items: ready,
      meta: (pr) => `✅ ${pr.reviewCounts.approved} approved`
    },
    {
      key: 'fix',
      icon: '🔧',
      title: 'Needs a re-flip',
      desc: 'Your PRs with requested changes or unresolved threads.',
      accent: '#f85149',
      items: needsFix,
      meta: (pr) => [
        pr.reviewCounts?.changes > 0 && `❌ ${pr.reviewCounts.changes} change request${pr.reviewCounts.changes > 1 ? 's' : ''}`,
        pr.unresolvedThreads > 0 && `💬 ${pr.unresolvedThreads} unresolved`
      ].filter(Boolean).join(' · ')
    },
    {
      key: 'review',
      icon: '👀',
      title: 'Waiting on your review',
      desc: 'Direct review requests, oldest first — they miss you.',
      accent: '#f0c46c',
      items: visible(prs.directReview).sort(byOldestCreated),
      meta: (pr) => `opened ${distanceToNow(new Date(pr.createdAt))} ago`
    },
    {
      key: 'team',
      icon: '👥',
      title: 'On the team plate',
      desc: 'Requests to your teams — grab one before it goes cold.',
      accent: '#2f81f7',
      items: visible(prs.teamReview).sort(byOldestCreated),
      meta: (pr) => `${pr.teamNames?.join(', ') || 'team'} · ${distanceToNow(new Date(pr.createdAt))} ago`
    }
  ];
};

const FocusView = ({ prs, isDismissed, loading }) => {
  if (loading) {
    return (
      <FocusContainer>
        <PageTitle>🥞 Short Stack</PageTitle>
        <PageSubtitle>The PRs worth flipping first.</PageSubtitle>
        <LoadingWrap>
          <LoadingSpinner />
          <div>Stacking up your priorities...</div>
        </LoadingWrap>
      </FocusContainer>
    );
  }

  const buckets = buildBuckets(prs, isDismissed);
  const totalItems = buckets.reduce((sum, bucket) => sum + bucket.items.length, 0);

  return (
    <FocusContainer>
      <PageTitle>🥞 Short Stack</PageTitle>
      <PageSubtitle>The PRs worth flipping first.</PageSubtitle>

      {totalItems === 0 ? (
        <AllClear>
          <div className="big">🥞✨</div>
          <div className="headline">Zero-stack!</div>
          <div>Nothing needs your attention right now. Go enjoy breakfast.</div>
        </AllClear>
      ) : (
        buckets.map(bucket => (
          <Bucket key={bucket.key}>
            <BucketHeader>
              <h2>{bucket.icon} {bucket.title}</h2>
              <span className="count">{bucket.items.length}</span>
            </BucketHeader>
            <BucketDesc>{bucket.desc}</BucketDesc>
            {bucket.items.length === 0 ? (
              <EmptyBucket>Nothing here — nice.</EmptyBucket>
            ) : (
              <CardList>
                {bucket.items.map(pr => (
                  <Card
                    key={pr.id}
                    $accent={bucket.accent}
                    onClick={() => window.open(pr.url, '_blank', 'noopener,noreferrer')}
                  >
                    <span className="ref">
                      <span className="repo">{pr.repository.name}</span>
                      <span className="num">#{pr.number}</span>
                    </span>
                    <span className="title" title={pr.title}>{pr.title}</span>
                    <span className="meta">{bucket.meta(pr)}</span>
                  </Card>
                ))}
              </CardList>
            )}
          </Bucket>
        ))
      )}
    </FocusContainer>
  );
};

export default FocusView;
