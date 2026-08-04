import React, { useState, useEffect, useCallback, useReducer } from 'react';
import styled from 'styled-components';
import { graphql } from '@octokit/graphql';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import DateRangePicker from './DateRangePicker';
import StatsCards from './StatsCards';
import VelocityChart from './VelocityChart';
import ReviewTable from './ReviewTable';
import { isRateLimit, handleRateLimit, isBlocked } from '../simple-rate-limit';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const AnalyticsContainer = styled.div`
  padding: 4px 0 20px;
`;

const LoadingPill = styled.div`
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(13, 17, 23, 0.9);
  border: 1px solid #f0c46c;
  border-top: none;
  border-radius: 0 0 16px 16px;
  padding: 8px 20px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #f0c46c;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: slideDown 0.3s ease;

  @keyframes slideDown {
    from {
      transform: translate(-50%, -100%);
    }
    to {
      transform: translate(-50%, 0);
    }
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(240, 196, 108, 0.2);
  border-radius: 50%;
  border-top: 2px solid #f0c46c;
  animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #8b949e;
  gap: 16px;
  background-color: #161b22;
  border-radius: 10px;
  margin: 24px auto;
  text-align: center;
`;

const ErrorMessage = styled.div`
  background-color: #21262d;
  border: 1px solid #f85149;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  color: #f85149;
  text-align: center;
`;

const OptionsSection = styled.div`
  background-color: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 16px;
  margin: 24px 0;
`;

const OptionsTitle = styled.h3`
  color: #f0f6fc;
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
`;

const CheckboxContainer = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #e6edf3;
  font-size: 14px;
  user-select: none;

  &:hover {
    color: #f0f6fc;
  }
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  accent-color: #f0c46c;
  cursor: pointer;
`;

// Analytics state reducer
const analyticsReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true, error: null };
    case 'SET_DATA':
      return {
        ...state,
        loading: false,
        error: null,
        rawData: action.payload,
        lastFetch: Date.now()
      };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload };
    case 'SET_CHART_METRIC':
      return { ...state, chartMetric: action.payload };
    case 'SET_INCLUDE_TEAM_REQUESTS':
      return { ...state, includeTeamRequests: action.payload };
    case 'SET_EXCLUDE_WEEKENDS':
      return { ...state, excludeWeekends: action.payload };
    default:
      return state;
  }
};

const getInitialState = () => {
  const userTimezone = dayjs.tz.guess();
  const now = dayjs().tz(userTimezone);

  return {
    loading: false,
    error: null,
    rawData: [],
    dateRange: {
      start: now.subtract(30, 'days').startOf('day'),
      end: now.endOf('day')
    },
    chartMetric: 'reviewCounts',
    includeTeamRequests: true,
    excludeWeekends: false,
    lastFetch: null
  };
};

const AnalyticsView = ({ token, onTokenExpired }) => {
  const [state, dispatch] = useReducer(analyticsReducer, getInitialState());
  const [tablePage, setTablePage] = useState(0);

  // Get user's timezone
  const userTimezone = dayjs.tz.guess();

  const fetchAnalyticsData = useCallback(async (dateRange) => {
    if (!token || isBlocked()) return;

    dispatch({ type: 'SET_LOADING' });

    const graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });

    try {
      // Format dates for GitHub search (YYYY-MM-DD)
      const startDate = dateRange.start.format('YYYY-MM-DD');
      const endDate = dateRange.end.format('YYYY-MM-DD');

      // GraphQL query to fetch PRs with review requests in the date range
      const query = `
        query($searchQuery: String!, $after: String) {
          search(query: $searchQuery, type: ISSUE, first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ... on PullRequest {
                id
                number
                title
                url
                repository {
                  nameWithOwner
                  owner {
                    login
                  }
                  name
                }
                author {
                  login
                }
                createdAt
                updatedAt
                mergedAt
                closedAt
                timelineItems(first: 100, itemTypes: [REVIEW_REQUESTED_EVENT, PULL_REQUEST_REVIEW]) {
                  nodes {
                    __typename
                    ... on ReviewRequestedEvent {
                      id
                      createdAt
                      requestedReviewer {
                        ... on User {
                          login
                        }
                        ... on Team {
                          name
                          slug
                        }
                      }
                    }
                    ... on PullRequestReview {
                      id
                      submittedAt
                      state
                      author {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
          viewer {
            login
          }
        }
      `;

      // Fetch the user's teams so we can attribute team review requests.
      // Degrade gracefully (no team matching) if the token lacks read:org.
      let userTeams = [];
      try {
        const teamsResponse = await fetch('https://api.github.com/user/teams', {
          headers: {
            Authorization: `token ${token}`
          }
        });
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          if (Array.isArray(teamsData)) {
            userTeams = teamsData.map(team => team.slug);
          }
        }
      } catch (teamsError) {
        console.warn('Could not fetch user teams; team review requests will not be matched:', teamsError);
      }

      // We need to make two separate searches since GitHub doesn't support OR syntax
      // 1. PRs where you're currently requested for review
      // 2. PRs where you've submitted reviews
      const searchQueries = [
        `is:pr review-requested:@me updated:${startDate}..${endDate}`,
        `is:pr reviewed-by:@me updated:${startDate}..${endDate}`
      ];

      let allPRs = [];
      let viewerLogin = null;
      const seenPRs = new Set(); // To avoid duplicates

      // Fetch results from both search queries
      for (let queryIndex = 0; queryIndex < searchQueries.length; queryIndex++) {
        const searchQuery = searchQueries[queryIndex];
        const queryType = queryIndex === 0 ? 'review-requested' : 'reviewed-by';

        let hasNextPage = true;
        let endCursor = null;
        let pageCount = 0;

        while (hasNextPage && pageCount < 10) { // Limit to 10 pages per query
          pageCount++;

          const result = await graphqlWithAuth(query, {
            searchQuery,
            after: endCursor
          });

          if (!result || !result.search) {
            throw new Error('Invalid response from GitHub API');
          }

          // Store viewer login from first successful query
          if (!viewerLogin) {
            viewerLogin = result.viewer.login;
          }

          // Add PRs to our collection, avoiding duplicates
          result.search.nodes.forEach(pr => {
            if (!seenPRs.has(pr.id)) {
              seenPRs.add(pr.id);
              allPRs.push(pr);
            }
          });

          hasNextPage = result.search.pageInfo.hasNextPage;
          endCursor = result.search.pageInfo.endCursor;
        }

        if (hasNextPage) {
          console.warn(`Stopped ${queryType} pagination after 10 pages to avoid excessive API calls`);
        }
      }

      // Process the timeline data to extract review request and review events
      const processedData = allPRs
        .filter(pr => pr && pr.timelineItems)
        .map(pr => {
          const reviewRequestEvents = [];
          const reviewEvents = [];

          pr.timelineItems.nodes.forEach(item => {
            // Now we need to filter ReviewRequestedEvent items to only include those for the current user
            // since our search query is broader (includes PRs where we reviewed but weren't necessarily requested)
            if (item.__typename === 'ReviewRequestedEvent') {
              // requestedReviewer can be null (e.g. deleted user/team)
              const isForCurrentUser = item.requestedReviewer?.login === viewerLogin;
              const isForCurrentUserTeam = userTeams.includes(item.requestedReviewer?.slug);

              if (isForCurrentUser || isForCurrentUserTeam) {
                reviewRequestEvents.push({
                  id: item.id,
                  requestedAt: item.createdAt,
                  requestedTo: isForCurrentUser ? item.requestedReviewer?.login : item.requestedReviewer?.name,
                  isTeamRequest: isForCurrentUserTeam
                });
              }
            } else if (item.__typename === 'PullRequestReview' &&
                       item.author?.login === viewerLogin) {
              reviewEvents.push({
                id: item.id,
                submittedAt: item.submittedAt,
                state: item.state,
                reviewer: item.author.login
              });
            }
          });

          // find the matching review for each review request
          // remove the review so it is not matched again
          reviewRequestEvents.forEach(reviewRequest => {
            const matchingReview = reviewEvents.find(review => !review.matched && review.submittedAt > reviewRequest.requestedAt);
            if (matchingReview) {
              reviewRequest.matchingReview = matchingReview;
              matchingReview.matched = !reviewRequest.isTeamRequest;
            }
          });

          return {
            ...pr,
            reviewRequestEvents,
            reviewEvents
          };
        })
        .filter(pr => pr.reviewRequestEvents.length > 0); // Only include PRs where user was requested

      dispatch({ type: 'SET_DATA', payload: processedData });

    } catch (error) {
      console.error('Error fetching analytics data:', error);

      if (isRateLimit(error)) {
        handleRateLimit(() => fetchAnalyticsData(dateRange));
        return;
      }

      if (error.status === 401 || (error.errors && error.errors.some(err => err.type === 'UNAUTHORIZED'))) {
        onTokenExpired();
        return;
      }

      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to fetch analytics data' });
    }
  }, [token, onTokenExpired]);

  // Fetch data when date range changes
  useEffect(() => {
    fetchAnalyticsData(state.dateRange);
  }, [state.dateRange, fetchAnalyticsData]);

  const handleDateRangeChange = (newRange) => {
    dispatch({ type: 'SET_DATE_RANGE', payload: newRange });
  };

  const handleChartMetricChange = (metric) => {
    dispatch({ type: 'SET_CHART_METRIC', payload: metric });
  };

  const handleIncludeTeamRequestsChange = (event) => {
    dispatch({ type: 'SET_INCLUDE_TEAM_REQUESTS', payload: event.target.checked });
  };

  const handleExcludeWeekendsChange = (event) => {
    dispatch({ type: 'SET_EXCLUDE_WEEKENDS', payload: event.target.checked });
  };

  // Filter data based on includeTeamRequests option
  const filteredData = React.useMemo(() => {
    if (!state.rawData || state.includeTeamRequests) {
      return state.rawData;
    }

    // Filter out team review requests when includeTeamRequests is false
    return state.rawData.map(pr => ({
      ...pr,
      reviewRequestEvents: pr.reviewRequestEvents.filter(event => !event.isTeamRequest)
    })).filter(pr => pr.reviewRequestEvents.length > 0); // Remove PRs with no remaining review requests
  }, [state.rawData, state.includeTeamRequests]);

  if (state.error) {
    return (
      <AnalyticsContainer>
        <h1 style={{ color: '#f0c46c', marginBottom: '32px', fontSize: '2rem' }}>
          📈 PR Review Analytics
        </h1>
        <ErrorMessage>
          Error loading analytics: {state.error}
        </ErrorMessage>
      </AnalyticsContainer>
    );
  }

  return (
    <AnalyticsContainer>
      {state.loading && (
        <LoadingPill>
          <LoadingSpinner />
          Analyzing review velocity...
        </LoadingPill>
      )}

      <h1 style={{ color: '#f0c46c', marginBottom: '32px', fontSize: '2rem' }}>
        📈 PR Review Analytics
      </h1>

      <DateRangePicker
        value={state.dateRange}
        onChange={handleDateRangeChange}
        timezone={userTimezone}
      />

      <OptionsSection>
        <OptionsTitle>Options</OptionsTitle>
        <CheckboxContainer>
          <Checkbox
            type="checkbox"
            checked={state.includeTeamRequests}
            onChange={handleIncludeTeamRequestsChange}
          />
          Include team review requests
        </CheckboxContainer>
        <CheckboxContainer>
          <Checkbox
            type="checkbox"
            checked={state.excludeWeekends}
            onChange={handleExcludeWeekendsChange}
          />
          Exclude weekends from calculation
        </CheckboxContainer>
      </OptionsSection>

      {filteredData.length === 0 && !state.loading ? (
        <EmptyState>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>No analytics data available</div>
          <div style={{ fontSize: '14px' }}>
            Try selecting a different date range or check if you have any review requests in the selected period.
          </div>
        </EmptyState>
      ) : (
        <>
          <StatsCards
            data={filteredData}
            dateRange={state.dateRange}
            excludeWeekends={state.excludeWeekends}
            timezone={userTimezone}
          />

          <VelocityChart
            data={filteredData}
            dateRange={state.dateRange}
            metric={state.chartMetric}
            onMetricChange={handleChartMetricChange}
            excludeWeekends={state.excludeWeekends}
            timezone={userTimezone}
          />

          <ReviewTable
            data={filteredData}
            dateRange={state.dateRange}
            page={tablePage}
            onPageChange={setTablePage}
            excludeWeekends={state.excludeWeekends}
            timezone={userTimezone}
          />
        </>
      )}
    </AnalyticsContainer>
  );
};

export default AnalyticsView;
