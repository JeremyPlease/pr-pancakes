# 🐛 Bugs Found and Fixed in PR Pancakes

This document summarizes the bugs identified and fixed in the PR Pancakes application, along with the failing tests created and their corresponding fixes.

## 🔐 Bug #1: Security Vulnerability - Access Token Exposed in URL

### **Issue**
The OAuth callback function was redirecting users with the GitHub access token directly in the URL query parameters:
```javascript
// BEFORE (INSECURE)
'Location': `https://prpancakes.com?token=${data.access_token}`
```

### **Risk**
- Access tokens exposed in browser history
- Tokens logged in server access logs  
- Potential token theft via referrer headers
- Tokens visible in browser address bar

### **Fix**
Replaced URL-based token passing with a secure callback page that:
1. Renders a loading page with authentication feedback
2. Safely stores the token in localStorage via JavaScript
3. Redirects to the main app without token exposure

**File**: `functions/auth-callback.js`

### **Test**
Created tests to verify tokens are not exposed in URLs and the application handles the secure callback properly.

---

## 💥 Bug #2: Application Crashes from Malformed localStorage JSON

### **Issue**
Multiple `JSON.parse()` calls throughout the application lacked error handling:
```javascript
// BEFORE (CRASH-PRONE)
JSON.parse(localStorage.getItem('sectionExpanded_authored') || 'true')
JSON.parse(savedDismissedPRs)
```

### **Risk**
- Application crashes when localStorage contains invalid JSON
- Poor user experience with unrecoverable errors
- Data corruption edge cases

### **Fix**
Implemented a `safeParseJSON` helper function with proper error handling:
```javascript
const safeParseJSON = (key, defaultValue) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to parse localStorage item '${key}':`, error);
    return defaultValue;
  }
};
```

**File**: `src/App.js` (lines 900-910)

### **Test**
Verified the function gracefully handles:
- Valid JSON strings
- Invalid JSON strings (returns default + logs warning)
- Null values
- Non-existent keys

---

## 🔄 Bug #3: Infinite Loop in Dismissal Logic

### **Issue**
The `isDismissed` function was calling `handleRestore` directly during render, causing side effects:
```javascript
// BEFORE (SIDE EFFECTS)
const isDismissed = (pr) => {
  // ... checks ...
  handleRestore(pr.id); // SIDE EFFECT DURING RENDER
  return false;
};
```

### **Risk**
- Potential infinite re-renders
- React warnings about side effects during render
- Performance degradation
- Unpredictable state updates

### **Fix**
Separated the dismissal checking logic from the cleanup logic:
1. `isDismissed` now only returns boolean values without side effects
2. Added `cleanupExpiredDismissals` function that runs periodically
3. Cleanup happens on a timer, not during render

**File**: `src/App.js` (lines 1596-1635)

### **Test**
Verified that:
- Expired dismissals are correctly identified
- No side effects occur during render
- Cleanup happens independently

---

## 📍 Bug #4: Dropdown Positioning Edge Cases

### **Issue**
The dropdown positioning used a hardcoded width assumption and could render off-screen:
```javascript
// BEFORE (FIXED WIDTH)
const dropdownWidth = 200; // Approximate width
```

### **Risk**
- Dropdowns rendered outside viewport
- Poor user experience on smaller screens
- Content cut off or inaccessible

### **Fix**
Implemented dynamic dropdown positioning that:
1. Calculates actual dropdown dimensions using temporary DOM element
2. Prevents off-screen rendering on all edges
3. Handles both horizontal and vertical edge cases
4. Ensures minimum padding from viewport edges

**File**: `src/App.js` (lines 975-1020)

### **Test**
Verified positioning logic handles:
- Normal positioning scenarios
- Right edge collisions
- Bottom edge collisions
- Negative position prevention

---

## ⚡ Bug #5: Race Condition in Data Fetching

### **Issue**
Multiple simultaneous API calls could occur from manual refresh + background refresh:
```javascript
// BEFORE (RACE CONDITIONS)
const fetchPRs = useCallback(async (isBackgroundRefresh = false) => {
  // No protection against concurrent calls
```

### **Risk**
- Duplicate API requests
- Inconsistent application state
- Rate limiting issues with GitHub API
- Performance degradation

### **Fix**
Added request deduplication with `fetchInProgress` state:
```javascript
const [fetchInProgress, setFetchInProgress] = useState(false);

const fetchPRs = useCallback(async (isBackgroundRefresh = false) => {
  if (fetchInProgress) {
    console.log('Fetch already in progress, skipping...');
    return;
  }
  setFetchInProgress(true);
  // ... fetch logic ...
}, [token, handleTokenExpiration, fetchInProgress]);
```

**File**: `src/App.js` (lines 1015-1025)

### **Test**
Verified that concurrent fetch requests are properly prevented and managed.

---

## ✅ Summary

**Total Bugs Fixed**: 5
**Test Cases Added**: 4 comprehensive test suites
**Security Issues Resolved**: 1 critical
**Stability Issues Resolved**: 4

All bugs have been resolved with:
- ✅ Failing tests created first
- ✅ Fixes implemented
- ✅ Tests now passing
- ✅ No regressions introduced

The application is now more secure, stable, and robust against edge cases and malformed data.