// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toBeInTheDocument()
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock external dependencies
jest.mock('@octokit/graphql', () => ({
  graphql: {
    defaults: () => jest.fn().mockResolvedValue({
      viewer: { login: 'testuser', organizations: { nodes: [] } },
      authoredPRs: { nodes: [] },
      reviewRequestedPRs: { nodes: [] },
      mentionedPRs: { nodes: [] },
      alreadyReviewedPRs: { nodes: [] }
    })
  }
}));

jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours'),
  addDays: jest.fn((date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000))  
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
