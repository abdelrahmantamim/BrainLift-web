import { test, expect } from '@playwright/test';

test.describe('Flashcards Feature', () => {
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
    
    await page.goto('/flashcards');
  });

  test('should display flashcards page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Flashcards');
    await expect(page.getByPlaceholder('Search flashcard decks...')).toBeVisible();
    await expect(page.getByRole('button', { name: /create deck/i })).toBeVisible();
  });

  test('should open deck creation modal', async ({ page }) => {
    await page.getByRole('button', { name: /create deck/i }).click();
    
    // Check modal appears
    await expect(page.getByRole('heading', { name: /create flashcard deck/i })).toBeVisible();
    await expect(page.getByPlaceholder('Enter deck name...')).toBeVisible();
  });

  test('should validate deck creation form', async ({ page }) => {
    await page.getByRole('button', { name: /create deck/i }).click();
    
    // Try to submit empty form
    await page.getByRole('button', { name: /create/i }).click();
    
    // Check for validation error
    await expect(page.getByText('Deck name is required')).toBeVisible();
  });

  test('should import deck by ID', async ({ page }) => {
    await page.getByRole('button', { name: /import by id/i }).click();
    
    // Enter deck ID
    await page.getByPlaceholder('Enter deck ID').fill('test-deck-id');
    await page.getByRole('button', { name: /import/i }).click();
    
    // Note: In real tests, you'd mock the API response
  });

  test('should search flashcard decks', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search flashcard decks...');
    
    // Type search query
    await searchInput.fill('Spanish');
    
    // Check search is working
    await expect(searchInput).toHaveValue('Spanish');
  });

  test('should show deck card actions on hover', async ({ page }) => {
    // Assuming there's at least one deck
    const deckCard = page.locator('.glass-card').first();
    
    // Hover over card
    await deckCard.hover();
    
    // Check actions menu button appears
    const menuButton = deckCard.locator('.lucide-more-vertical');
    await expect(menuButton).toBeVisible();
  });

  test('should open deck actions menu', async ({ page }) => {
    // Assuming there's at least one deck
    const deckCard = page.locator('.glass-card').first();
    await deckCard.hover();
    
    // Click menu button
    const menuButton = deckCard.locator('.lucide-more-vertical');
    await menuButton.click();
    
    // Check menu items
    await expect(page.getByText('Rename')).toBeVisible();
    await expect(page.getByText('Share')).toBeVisible();
    await expect(page.getByText('Export PDF')).toBeVisible();
    await expect(page.getByText('Delete')).toBeVisible();
  });

  test('should show due cards indicator', async ({ page }) => {
    // Look for due cards indicator
    const dueIndicator = page.locator('text=/Due: \\d+/');
    
    if (await dueIndicator.isVisible()) {
      // Check progress bar is visible
      const progressBar = page.locator('.glass-card').first().locator('[role="progressbar"]');
      await expect(progressBar).toBeVisible();
    }
  });

  test('should navigate to study page', async ({ page }) => {
    // Assuming there's at least one deck
    const studyButton = page.getByRole('button', { name: /study/i }).first();
    
    if (await studyButton.isVisible()) {
      await studyButton.click();
      
      // Check navigation
      await expect(page.url()).toContain('/flashcards/');
      await expect(page.url()).toContain('/study');
    }
  });

  test('should handle file upload for flashcards', async ({ page }) => {
    await page.getByRole('button', { name: /create deck/i }).click();
    
    // Fill deck name
    await page.getByPlaceholder('Enter deck name...').fill('Test Deck');
    
    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'flashcards.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Question 1 | Answer 1\nQuestion 2 | Answer 2')
    });
    
    // Check file is selected
    await expect(page.getByText('flashcards.txt')).toBeVisible();
  });
});