import React, { useState } from 'react';
import styled from 'styled-components';

const SECTIONS = [
  { id: 'direct', icon: '👀', title: 'Review requested from you', hint: 'Someone asked for you by name. Longest-waiting first.', primary: true },
  { id: 'replies', icon: '💬', title: 'Replies & mentions', hint: 'New activity since you last touched the PR — including merged PRs and resolved threads.', primary: true },
  { id: 'mine', icon: '🥞', title: 'My PRs', hint: 'Your open PRs and what each one is waiting on.', primary: true },
  { id: 'updated', icon: '🔁', title: 'Updated since your review', hint: 'New commits after you commented or requested changes.' },
  { id: 'team', icon: '👥', title: 'Team review requests', hint: 'Requested from a team you belong to. Lower priority than direct requests.' },
  { id: 'fyi', icon: '📬', title: 'FYI', hint: 'Merged or closed without your review, or changed after you approved.' },
  { id: 'stale', icon: '🧊', title: 'Stale', hint: 'Open requests with no activity in a long time.', collapsed: true }
];
const DISMISSED_SECTION = { id: 'dismissed', icon: '🙈', title: 'Dismissed', hint: 'Hidden in this browser until something new happens on the PR.', collapsed: true };
const STORAGE_KEY = 'attentionDismissed';
const REASON_LABELS = { reply: 'replied in a thread', mention: 'mentioned you', comment: 'commented', review: 'reviewed' };
const VISIBLE_REASONS = 3;
const QUIET_SECTIONS = ['team', 'fyi', 'stale', 'dismissed'];
const BLOCKED_KINDS = ['changes-requested', 'ci-failing', 'conflicts'];
const CI_TONES = { SUCCESS: 'good', FAILURE: 'bad', ERROR: 'bad' };
const TONES = {
  ok: { bg: 'rgba(46, 160, 67, 0.15)', fg: '#56d364' },
  warn: { bg: 'rgba(210, 153, 34, 0.15)', fg: '#e3b341' },
  alert: { bg: 'rgba(248, 81, 73, 0.15)', fg: '#ff7b72' },
  neutral: { bg: '#21262d', fg: '#8b949e' }
};
const BADGE_TONES = { good: TONES.ok, bad: TONES.alert };
const STATE_COLORS = { MERGED: '#b694ff', CLOSED: '#ff7b72' };

const FocusContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
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
  margin: 0 0 12px;
  font-size: 14px;
`;

const Banner = styled.div`
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: ${TONES.alert.bg};
  color: ${TONES.alert.fg};
  font-weight: 600;
`;

const SectionNav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  position: sticky;
  top: 64px;
  z-index: 50;
  padding: 8px 0;
  background: #0d1117;

  @media (max-width: 768px) {
    top: 0;
  }
`;

const NavChip = styled.button`
  padding: 5px 12px;
  border-radius: 999px;
  background: #161b22;
  border: 1px solid ${props => (props.$primary ? '#f0c46c' : '#30363d')};
  color: #c9d1d9;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  b {
    margin-left: 6px;
    color: ${props => (props.$primary ? '#f0c46c' : '#8b949e')};
  }

  &:hover {
    background: #1c2128;
  }
`;

const Section = styled.section`
  margin-top: 28px;
  scroll-margin-top: 120px;

  h2, summary {
    margin: 0 0 2px;
    font-size: 1.1rem;
    font-weight: 650;
    color: #f0f6fc;
  }

  summary {
    cursor: pointer;
  }

  .count {
    margin-left: 8px;
    color: #8b949e;
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`;

const Hint = styled.p`
  color: #8b949e;
  font-size: 13px;
  margin: 0 0 10px;
`;

const Empty = styled.div`
  color: #6e7681;
  font-size: 13px;
  padding: 10px 16px;
  background-color: #161b22;
  border: 1px dashed #21262d;
  border-radius: 8px;
`;

const Card = styled.div`
  display: grid;
  grid-template-columns: 52px 1fr auto;
  gap: 4px 12px;
  align-items: start;
  background-color: #161b22;
  border: 1px solid #21262d;
  border-left: 3px solid ${props => props.$accent};
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #c9d1d9;
  opacity: ${props => (props.$quiet ? 0.85 : 1)};

  a {
    color: #e6edf3;
    text-decoration: none;

    &:hover {
      color: #f0c46c;
      text-decoration: underline;
    }
  }

  .ref {
    margin-right: 8px;
    white-space: nowrap;

    .repo { color: #8b949e; }
    .num { color: #f0c46c; font-weight: 600; }
  }

  .title {
    font-weight: 600;
    font-size: 15px;
    overflow-wrap: anywhere;
    color: ${props => (props.$draft ? '#8b949e' : '#e6edf3')};
  }

  @media (max-width: 600px) {
    grid-template-columns: 44px 1fr;

    .actions { grid-column: 2; }
  }
`;

const Age = styled.div`
  text-align: center;
  padding: 3px 0;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  background: ${props => TONES[props.$level].bg};
  color: ${props => TONES[props.$level].fg};
`;

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: #8b949e;
  font-size: 12.5px;

  .add { color: #56d364; }
  .del { color: #ff7b72; }
`;

const Badge = styled.span`
  border-radius: 5px;
  padding: 1px 7px;
  white-space: nowrap;
  background: ${props => BADGE_TONES[props.$tone]?.bg ?? '#21262d'};
  color: ${props => props.$color ?? BADGE_TONES[props.$tone]?.fg ?? 'inherit'};
  font-weight: ${props => (props.$tone === 'bad' ? 600 : 400)};
`;

const Reasons = styled.ul`
  list-style: none;
  margin: 8px 0 0;
  padding: 0;

  li {
    padding: 4px 0 4px 10px;
    border-left: 2px solid #30363d;
    margin-top: 4px;
  }

  .what { font-weight: 600; }
  .when { color: #8b949e; font-size: 12.5px; margin-left: 6px; }
  .snippet { display: block; color: #8b949e; overflow-wrap: anywhere; }

  summary {
    cursor: pointer;
    color: #8b949e;
    margin-top: 6px;
    font-size: 12.5px;
    font-weight: 400;
  }
`;

const ActionButton = styled.button`
  background-color: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #c9d1d9;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #f0c46c;
    color: #f0c46c;
  }
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

const loadDismissed = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
};

const shortDate = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const accentOf = pr => {
  const kinds = pr.reasons.map(r => r.kind);
  if (pr.section === 'direct') return '#f0c46c';
  if (pr.section !== 'mine') return '#30363d';
  if (kinds.some(k => BLOCKED_KINDS.includes(k))) return '#f85149';
  return kinds.includes('approved') ? '#2ea043' : '#30363d';
};

const ReasonItem = ({ reason }) => (
  <li>
    <a href={reason.url} target="_blank" rel="noopener noreferrer" className="what">
      {reason.who ? `${reason.who} ${REASON_LABELS[reason.kind] ?? reason.kind}` : reason.text}
    </a>
    <span className="when" title={new Date(reason.at).toLocaleString()}>
      {shortDate(reason.at)}{reason.resolved && ' · resolved thread'}
    </span>
    {reason.who && <span className="snippet">{reason.text}</span>}
  </li>
);

const ReasonList = ({ reasons }) => {
  const hidden = reasons.slice(VISIBLE_REASONS);
  return (
    <Reasons>
      {reasons.slice(0, VISIBLE_REASONS).map(r => <ReasonItem key={`${r.kind}${r.at}${r.url}`} reason={r} />)}
      {hidden.length > 0 && (
        <details>
          <summary>+{hidden.length} more</summary>
          {hidden.map(r => <ReasonItem key={`${r.kind}${r.at}${r.url}`} reason={r} />)}
        </details>
      )}
    </Reasons>
  );
};

const PRBadges = ({ pr }) => {
  const big = ['L', 'XL'].includes(pr.size);
  return (
    <Badges>
      <span>@{pr.author}</span>
      {pr.state !== 'OPEN' && <Badge $color={STATE_COLORS[pr.state]}>{pr.state.toLowerCase()}</Badge>}
      {pr.isDraft && <Badge>draft</Badge>}
      <Badge $tone={big ? 'bad' : undefined} title={`${pr.changedFiles} files changed`}>
        {pr.size} <span className={big ? '' : 'add'}>+{pr.additions}</span> <span className={big ? '' : 'del'}>−{pr.deletions}</span> · {pr.changedFiles} files
      </Badge>
      <Badge $tone={pr.hot ? 'bad' : undefined}>{pr.hot ? '🔥' : '💬'} {pr.commentCount}</Badge>
      {pr.unresolvedThreads > 0 && <Badge $tone="bad">{pr.unresolvedThreads} unresolved</Badge>}
      {CI_TONES[pr.ci] && <Badge $tone={CI_TONES[pr.ci]}>CI {pr.ci.toLowerCase()}</Badge>}
      {pr.truncated && <Badge $tone="bad" title="Too many threads to scan fully">very long — check manually</Badge>}
    </Badges>
  );
};

const PRCard = ({ pr, quiet, actionLabel, onAction }) => (
  <Card $accent={accentOf(pr)} $quiet={quiet} $draft={pr.isDraft}>
    <Age $level={pr.ageLevel} title={`${pr.ageDays} days`}>{pr.ageDays}d</Age>
    <div>
      <span className="ref">
        <span className="repo">{pr.repo}</span>
        <span className="num">#{pr.number}</span>
      </span>
      <a href={pr.url} target="_blank" rel="noopener noreferrer" className="title">{pr.title}</a>
      <PRBadges pr={pr} />
      <ReasonList reasons={pr.reasons} />
    </div>
    <div className="actions">
      <ActionButton onClick={onAction}>{actionLabel}</ActionButton>
    </div>
  </Card>
);

const SectionBlock = ({ section, prs, actionLabel, onAction }) => {
  const heading = <>{section.icon} {section.title}<span className="count">{prs.length}</span></>;
  const body = (
    <>
      <Hint>{section.hint}</Hint>
      {prs.length === 0
        ? <Empty>Nothing here — nice.</Empty>
        : prs.map(pr => (
          <PRCard
            key={pr.url}
            pr={pr}
            quiet={QUIET_SECTIONS.includes(section.id)}
            actionLabel={actionLabel}
            onAction={() => onAction(pr)}
          />
        ))}
    </>
  );
  return (
    <Section id={section.id}>
      {section.collapsed ? <details><summary>{heading}</summary>{body}</details> : <><h2>{heading}</h2>{body}</>}
    </Section>
  );
};

const FocusView = ({ data, loading, error }) => {
  const [dismissed, setDismissed] = useState(loadDismissed);

  const updateDismissed = (key, value) => {
    const { [key]: _, ...rest } = dismissed;
    const next = value ? { ...rest, [key]: value } : rest;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDismissed(next);
  };

  const prs = data?.prs ?? [];
  const active = prs.filter(pr => !dismissed[pr.key]);
  const hidden = prs.filter(pr => dismissed[pr.key]);
  const bySection = id => active.filter(pr => pr.section === id);

  return (
    <FocusContainer>
      <PageTitle>🥞 Short Stack</PageTitle>
      <PageSubtitle>Everything that needs your attention, so no PR slips off the plate.</PageSubtitle>
      {error && <Banner>Couldn't load your PRs: {error}</Banner>}

      {!data ? (
        loading && (
          <LoadingWrap>
            <LoadingSpinner />
            <div>Stacking up your priorities... this one digs deep, give it a few seconds.</div>
          </LoadingWrap>
        )
      ) : (
        <>
          <SectionNav>
            {SECTIONS.map(s => (
              <NavChip
                key={s.id}
                $primary={s.primary}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
              >
                {s.title}<b>{bySection(s.id).length}</b>
              </NavChip>
            ))}
          </SectionNav>
          {SECTIONS.map(s => (
            <SectionBlock
              key={s.id}
              section={s}
              prs={bySection(s.id)}
              actionLabel="Dismiss"
              onAction={pr => updateDismissed(pr.key, new Date().toISOString())}
            />
          ))}
          <SectionBlock
            section={DISMISSED_SECTION}
            prs={hidden}
            actionLabel="Restore"
            onAction={pr => updateDismissed(pr.key, null)}
          />
        </>
      )}
    </FocusContainer>
  );
};

export default FocusView;
