import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show login page when not authenticated', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Tutoring App/);
    await expect(page.locator('h1')).toContainText('Welcome Back');
    await expect(page.locator('form')).toBeVisible();
  });

  test('should validate login form', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Check for validation errors
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.getByText("Don't have an account?").click();
    await expect(page.locator('h1')).toContainText('Create Account');
  });

  test('should validate register form', async ({ page }) => {
    await page.getByText("Don't have an account?").click();
    
    // Try to submit empty form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Check for validation errors
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should show password requirements on register', async ({ page }) => {
    await page.getByText("Don't have an account?").click();
    
    // Type weak password
    await page.getByPlaceholder('Enter your password').fill('weak');
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Check for password requirements
    await expect(page.getByText(/Password must contain/)).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByPlaceholder('Enter your password');
    const toggleButton = page.locator('button[aria-label*="password"]');
    
    // Check initial state
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Toggle visibility
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Toggle back
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});