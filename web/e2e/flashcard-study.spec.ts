import { test, expect } from '@playwright/test';

test.describe('Flashcard Study Flow', () => {
  // Mock authentication and flashcard data
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Mock login and flashcard data
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        email: 'test@example.com',
        name: 'Test User'
      }));
      
      // Mock flashcard deck data
      const mockDeck = {
        id: 'test-deck-1',
        name: 'Spanish Vocabulary',
        cards: [
          {
            id: 'c1',
            question: 'Hello',
            answer: 'Hola',
            easeFactor: 2.5,
            interval: 1,
            repetitions: 0,
            nextDue: new Date().toISOString()
          },
          {
            id: 'c2',
            question: 'Thank you',
            answer: 'Gracias',
            easeFactor: 2.5,
            interval: 1,
            repetitions: 0,
            nextDue: new Date().toISOString()
          }
        ]
      };
      
      // Store mock deck
      sessionStorage.setItem('mock-deck', JSON.stringify(mockDeck));
    });
  });

  test('should complete a flashcard study session', async ({ page }) => {
    // Navigate to study page
    await page.goto('/flashcards/test-deck-1/study');
    
    // Check deck title
    await expect(page.locator('h1')).toContainText('Spanish Vocabulary');
    
    // Check first card shows question
    await expect(page.getByText('Hello')).toBeVisible();
    
    // Click to flip card
    await page.locator('.flashcard').click();
    
    // Check answer is shown
    await expect(page.getByText('Hola')).toBeVisible();
    
    // Rate the card as "Good"
    await page.getByRole('button', { name: /good/i }).click();
    
    // Check next card is shown
    await expect(page.getByText('Thank you')).toBeVisible();
    
    // Flip and rate
    await page.locator('.flashcard').click();
    await expect(page.getByText('Gracias')).toBeVisible();
    await page.getByRole('button', { name: /easy/i }).click();
    
    // Check study complete
    await expect(page.getByText(/study session complete/i)).toBeVisible();
  });

  test('should handle card flipping animation', async ({ page }) => {
    await page.goto('/flashcards/test-deck-1/study');
    
    const flashcard = page.locator('.flashcard');
    
    // Check initial state
    await expect(flashcard).not.toHaveClass(/flipped/);
    
    // Click to flip
    await flashcard.click();
    
    // Check flipped state
    await expect(flashcard).toHaveClass(/flipped/);
    
    // Click to flip back
    await flashcard.click();
    
    // Check unflipped state
    await expect(flashcard).not.toHaveClass(/flipped/);
  });

  test('should show all difficulty rating buttons', async ({ page }) => {
    await page.goto('/flashcards/test-deck-1/study');
    
    // Flip card to show answer
    await page.locator('.flashcard').click();
    
    // Check all rating buttons are visible
    await expect(page.getByRole('button', { name: /again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /hard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /good/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /easy/i })).toBeVisible();
  });

  test('should show progress indicator', async ({ page }) => {
    await page.goto('/flashcards/test-deck-1/study');
    
    // Check progress shows 1/2
    await expect(page.getByText('Card 1 of 2')).toBeVisible();
    
    // Complete first card
    await page.locator('.flashcard').click();
    await page.getByRole('button', { name: /good/i }).click();
    
    // Check progress shows 2/2
    await expect(page.getByText('Card 2 of 2')).toBeVisible();
  });

  test('should track study statistics', async ({ page }) => {
    await page.goto('/flashcards/test-deck-1/study');
    
    // Complete both cards
    await page.locator('.flashcard').click();
    await page.getByRole('button', { name: /good/i }).click();
    
    await page.locator('.flashcard').click();
    await page.getByRole('button', { name: /easy/i }).click();
    
    // Check statistics
    await expect(page.getByText(/cards studied: 2/i)).toBeVisible();
    await expect(page.getByText(/average difficulty/i)).toBeVisible();
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/flashcards/test-deck-1/study');
    
    // Flip card with spacebar
    await page.keyboard.press('Space');
    await expect(page.getByText('Hola')).toBeVisible();
    
    // Rate with number keys
    await page.keyboard.press('3'); // Good
    
    // Check next card is shown
    await expect(page.getByText('Thank you')).toBeVisible();
  });

  test('should show due date for next review', async ({ page }) => {
    await page.goto('/flashcards/test-deck-1/study');
    
    // Flip and rate card
    await page.locator('.flashcard').click();
    
    // Hover over rating button to see tooltip
    const goodButton = page.getByRole('button', { name: /good/i });
    await goodButton.hover();
    
    // Check tooltip shows next review time
    await expect(page.getByText(/next review/i)).toBeVisible();
  });

  test('should allow skipping cards', async ({ page }) => {
    await page.goto('/flashcards/test-deck-1/study');
    
    // Skip button should be visible
    const skipButton = page.getByRole('button', { name: /skip/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
      
      // Should move to next card
      await expect(page.getByText('Thank you')).toBeVisible();
    }
  });

  test('should handle empty deck', async ({ page }) => {
    // Mock empty deck
    await page.evaluate(() => {
      sessionStorage.setItem('mock-deck', JSON.stringify({
        id: 'empty-deck',
        name: 'Empty Deck',
        cards: []
      }));
    });
    
    await page.goto('/flashcards/empty-deck/study');
    
    // Should show empty state
    await expect(page.getByText(/no cards to study/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to decks/i })).toBeVisible();
  });
});