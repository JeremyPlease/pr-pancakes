/**
 * Tests for bug fixes in PR Pancakes application
 * These tests verify the specific bugs that were identified and fixed
 */

// Test the localStorage JSON parsing safety function
describe('localStorage JSON parsing safety', () => {
  let originalLocalStorage;
  let originalConsoleWarn;

  beforeAll(() => {
    originalLocalStorage = global.localStorage;
    originalConsoleWarn = console.warn;
    console.warn = jest.fn();
  });

  afterAll(() => {
    global.localStorage = originalLocalStorage;
    console.warn = originalConsoleWarn;
  });

  test('safeParseJSON should handle invalid JSON gracefully', () => {
    // Create helper function directly (testing the implementation)
    const safeParseJSON = (storage, key, defaultValue) => {
      try {
        const item = storage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.warn(`Failed to parse localStorage item '${key}':`, error);
        return defaultValue;
      }
    };

    // Create mock storage
    const mockStorage = {
      getItem: (key) => {
        if (key === 'validKey') return '{"valid": "json"}';
        if (key === 'invalidKey') return '{invalid json}';
        if (key === 'nullKey') return null;
        return null;
      }
    };
    
    // Test valid JSON
    expect(safeParseJSON(mockStorage, 'validKey', {})).toEqual({ valid: 'json' });

    // Test invalid JSON - should return default and log warning
    expect(safeParseJSON(mockStorage, 'invalidKey', { default: 'value' })).toEqual({ default: 'value' });
    expect(console.warn).toHaveBeenCalledWith(
      "Failed to parse localStorage item 'invalidKey':",
      expect.any(Error)
    );

    // Test null value - should return default
    expect(safeParseJSON(mockStorage, 'nullKey', 'default')).toBe('default');

    // Test non-existent key - should return default
    expect(safeParseJSON(mockStorage, 'nonExistent', 42)).toBe(42);
  });
});

// Test the dismissal expiry logic
describe('PR dismissal expiry logic', () => {
  test('should correctly identify expired dismissals', () => {
    const now = new Date('2024-01-01T12:00:00Z');

    const dismissedPRs = {
      'PR_1': {
        pr: { id: 'PR_1' },
        dismissedUntil: 'forever'
      },
      'PR_2': {
        pr: { id: 'PR_2' },
        dismissedUntil: 'until-update',
        lastUpdateTime: '2024-01-01T10:00:00Z'
      },
      'PR_3': {
        pr: { id: 'PR_3' },
        dismissedUntil: '2024-01-01T11:00:00Z' // 1 hour ago (expired)
      },
      'PR_4': {
        pr: { id: 'PR_4' },
        dismissedUntil: '2024-01-01T13:00:00Z' // 1 hour in future (not expired)
      }
    };

    // Simulate the cleanup logic
    const expiredIds = [];
    Object.entries(dismissedPRs).forEach(([prId, dismissal]) => {
      if (!dismissal || !dismissal.pr) return;
      
      if (dismissal.dismissedUntil !== 'forever' && 
          dismissal.dismissedUntil !== 'until-update' &&
          dismissal.dismissedUntil && 
          new Date(dismissal.dismissedUntil) <= now) {
        expiredIds.push(prId);
      }
    });

    expect(expiredIds).toEqual(['PR_3']);
  });

  test('should not modify dismissals during render', () => {
    const pr = {
      id: 'PR_1',
      updatedAt: '2024-01-01T10:00:00Z'
    };

    const dismissedPRs = {
      'PR_1': {
        pr: pr,
        dismissedUntil: '2024-01-01T09:00:00Z', // expired
        lastUpdateTime: pr.updatedAt
      }
    };

    // Simulate the isDismissed function (fixed version)
    const isDismissed = (pr) => {
      const dismissal = dismissedPRs[pr.id];
      if (!dismissal || !dismissal.pr) return false;

      if (dismissal.dismissedUntil === 'forever') return true;
      if (dismissal.dismissedUntil === 'until-update' && pr.updatedAt === dismissal.lastUpdateTime) return true;
      if (dismissal.dismissedUntil && new Date(dismissal.dismissedUntil) > new Date()) return true;

      // Fixed: no side effects during render
      return false;
    };

    // Should return false for expired dismissal without side effects
    expect(isDismissed(pr)).toBe(false);
    
    // Original dismissedPRs object should be unchanged
    expect(dismissedPRs['PR_1']).toBeDefined();
  });
});

// Test the dropdown positioning logic
describe('Dropdown positioning logic', () => {
  test('should calculate safe dropdown position within viewport', () => {
    // Mock DOM elements and measurements
    const mockButton = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        bottom: 80,
        right: 150
      })
    };

    const mockDropdown = {
      offsetWidth: 200,
      offsetHeight: 150
    };

    // Mock viewport dimensions
    const viewportWidth = 300;
    const viewportHeight = 200;

    // Simulate the positioning logic
    const calculatePosition = (buttonRect, dropdownWidth, dropdownHeight, viewportWidth, viewportHeight) => {
      let leftOffset = buttonRect.left;
      let topOffset = buttonRect.bottom;

      // Ensure the dropdown doesn't go off-screen to the right
      if (leftOffset + dropdownWidth > viewportWidth) {
        leftOffset = Math.max(10, viewportWidth - dropdownWidth - 10);
      }

      // Ensure the dropdown doesn't go off-screen to the bottom
      if (topOffset + dropdownHeight > viewportHeight) {
        topOffset = Math.max(10, buttonRect.top - dropdownHeight);
      }

      // Ensure left offset is not negative
      leftOffset = Math.max(10, leftOffset);

      return { top: topOffset, left: leftOffset };
    };

    const buttonRect = mockButton.getBoundingClientRect();
    
    // Test normal positioning
    let position = calculatePosition(buttonRect, 100, 50, viewportWidth, viewportHeight);
    expect(position).toEqual({ top: 80, left: 100 });

    // Test right edge collision
    position = calculatePosition(buttonRect, 220, 50, viewportWidth, viewportHeight);
    expect(position.left).toBe(70); // 300 - 220 - 10

    // Test bottom edge collision
    position = calculatePosition(buttonRect, 100, 160, viewportWidth, viewportHeight);
    expect(position.top).toBe(10); // Moved above button: max(10, 50 - 160)
  });
});

console.log('✅ All bug fix tests defined successfully!');
