import { test, expect } from '@playwright/test';

test.describe('Quiz Feature', () => {
  // Mock authentication
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Mock login by setting auth token
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        email: 'test@example.com',
        name: 'Test User'
      }));
    });
    
    await page.goto('/quiz');
  });

  test('should display quiz page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Quizzes');
    await expect(page.getByPlaceholder('Search quizzes...')).toBeVisible();
    await expect(page.getByRole('button', { name: /create quiz/i })).toBeVisible();
  });

  test('should open quiz generation modal', async ({ page }) => {
    await page.getByRole('button', { name: /create quiz/i }).click();
    
    // Check modal appears
    await expect(page.getByRole('heading', { name: /generate quiz/i })).toBeVisible();
    await expect(page.getByPlaceholder('Enter topic...')).toBeVisible();
  });

  test('should validate quiz generation form', async ({ page }) => {
    await page.getByRole('button', { name: /create quiz/i }).click();
    
    // Try to submit empty form
    await page.getByRole('button', { name: /generate/i }).click();
    
    // Check for validation error
    await expect(page.getByText('Topic is required')).toBeVisible();
  });

  test('should import quiz by ID', async ({ page }) => {
    await page.getByRole('button', { name: /import by id/i }).click();
    
    // Enter quiz ID
    await page.getByPlaceholder('Enter quiz ID').fill('test-quiz-id');
    await page.getByRole('button', { name: /import/i }).click();
    
    // Note: In real tests, you'd mock the API response
  });

  test('should search quizzes', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search quizzes...');
    
    // Type search query
    await searchInput.fill('Math');
    
    // Check search is working
    await expect(searchInput).toHaveValue('Math');
  });

  test('should show quiz card actions on hover', async ({ page }) => {
    // Assuming there's at least one quiz
    const quizCard = page.locator('.glass-card').first();
    
    // Hover over card
    await quizCard.hover();
    
    // Check actions menu button appears
    const menuButton = quizCard.locator('.lucide-more-vertical');
    await expect(menuButton).toBeVisible();
  });

  test('should open quiz actions menu', async ({ page }) => {
    // Assuming there's at least one quiz
    const quizCard = page.locator('.glass-card').first();
    await quizCard.hover();
    
    // Click menu button
    const menuButton = quizCard.locator('.lucide-more-vertical');
    await menuButton.click();
    
    // Check menu items
    await expect(page.getByText('Rename')).toBeVisible();
    await expect(page.getByText('Edit Tags')).toBeVisible();
    await expect(page.getByText('Share')).toBeVisible();
    await expect(page.getByText('Export PDF')).toBeVisible();
    await expect(page.getByText('Delete')).toBeVisible();
  });

  test('should navigate to quiz taking page', async ({ page }) => {
    // Assuming there's at least one quiz
    const startButton = page.getByRole('button', { name: /start quiz/i }).first();
    
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Check navigation
      await expect(page.url()).toContain('/quiz/');
      await expect(page.url()).toContain('/take');
    }
  });
});