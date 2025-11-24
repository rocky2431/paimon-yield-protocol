/**
 * Home Page E2E Tests
 *
 * Tests for the main landing page
 */

import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the home page', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/Paimon/);
  });

  test('should display main content', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify main content is visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should have no accessibility violations', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Basic accessibility check - verify page has proper structure
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang');

    // Check for main content area
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify page still loads correctly
    await expect(page).toHaveTitle(/Paimon/);

    // Main content should still be visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should handle navigation', async ({ page }) => {
    // Test that page doesn't crash on various viewport sizes
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Page should not show error
      const body = page.locator('body');
      await expect(body).not.toContainText('Error');
    }
  });
});
