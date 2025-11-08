import { test, expect } from '@playwright/test';

// Helper to log console messages
function setupConsoleLogging(page: any) {
  page.on('console', (msg: any) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}] ${text}`);
    }
  });

  page.on('pageerror', (error: Error) => {
    console.error(`[PAGE ERROR] ${error.message}`);
  });
}

test.describe('Spotify Callback Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and sessionStorage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Setup console logging
    setupConsoleLogging(page);
  });

  test('should show processing state initially', async ({ page }) => {
    console.log('[TEST] Testing callback page with code parameter');
    
    // Navigate to callback with a code (simulating successful OAuth)
    await page.goto('/callback?code=test_auth_code&state=ABCD12');
    
    // Should show processing state initially
    await expect(page.getByText(/connecting to spotify/i)).toBeVisible({ timeout: 2000 });
    await expect(page.getByText(/please wait/i)).toBeVisible();
    
    // Take screenshot of processing state
    await page.screenshot({ path: 'test-results/callback-processing.png' });
    
    console.log('[TEST] Processing state displayed correctly');
  });

  test('should prioritize code over error parameter', async ({ page }) => {
    console.log('[TEST] Testing that code takes precedence over error parameter');
    
    // Simulate a scenario where both code and error are present
    // This could happen with stale URL parameters
    // The fix ensures code takes precedence
    await page.goto('/callback?code=test_auth_code&error=access_denied&state=ABCD12');
    
    // Should show processing state (not error) because code is present
    await expect(page.getByText(/connecting to spotify/i)).toBeVisible({ timeout: 2000 });
    
    // Should NOT show error message immediately
    const errorMessage = page.getByText(/authentication failed/i);
    await expect(errorMessage).not.toBeVisible({ timeout: 1000 });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/callback-code-priority.png' });
    
    console.log('[TEST] Code correctly takes precedence over error parameter');
  });

  test('should show error when only error parameter is present', async ({ page }) => {
    console.log('[TEST] Testing error state when only error parameter exists');
    
    // Navigate to callback with only error (no code)
    await page.goto('/callback?error=access_denied');
    
    // Should show error state
    await expect(page.getByText(/authentication failed/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/✗/i)).toBeVisible();
    
    // Should have error message
    await expect(page.getByText(/access_denied/i)).toBeVisible();
    
    // Take screenshot of error state
    await page.screenshot({ path: 'test-results/callback-error-only.png' });
    
    console.log('[TEST] Error state displayed correctly when only error parameter present');
  });

  test('should show error when no code and no error parameter', async ({ page }) => {
    console.log('[TEST] Testing error state when callback has no parameters');
    
    // Navigate to callback with no parameters
    await page.goto('/callback');
    
    // Should show error state
    await expect(page.getByText(/authentication failed/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/no authorization code found/i)).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/callback-no-params.png' });
    
    console.log('[TEST] Error state displayed correctly when no parameters');
  });

  test('should not show red cross before green check on successful auth', async ({ page }) => {
    console.log('[TEST] Testing that red cross does not appear before green check');
    
    // This test simulates the bug scenario - where error might appear first
    // Navigate with code (successful auth)
    await page.goto('/callback?code=test_auth_code&state=ABCD12');
    
    // Monitor for any error indicators appearing
    const redCross = page.locator('text=✗');
    const errorMessage = page.getByText(/authentication failed/i);
    
    // Wait a bit to see if error appears (it shouldn't)
    await page.waitForTimeout(500);
    
    // Verify error indicators are NOT visible
    await expect(redCross).not.toBeVisible();
    await expect(errorMessage).not.toBeVisible();
    
    // Should show processing or success (depending on token exchange)
    const processingText = page.getByText(/connecting to spotify/i);
    const successText = page.getByText(/successfully connected/i);
    
    // At least one of these should be visible (processing initially, then success)
    const isProcessing = await processingText.isVisible().catch(() => false);
    const isSuccess = await successText.isVisible().catch(() => false);
    
    expect(isProcessing || isSuccess).toBe(true);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/callback-no-red-cross.png' });
    
    console.log('[TEST] Red cross does not appear before green check');
  });
});

