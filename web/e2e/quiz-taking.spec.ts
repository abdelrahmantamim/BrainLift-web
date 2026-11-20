import { test, expect } from '@playwright/test';

test.describe('Quiz Taking Flow', () => {
  // Mock authentication and quiz data
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Mock login and quiz data
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        email: 'test@example.com',
        name: 'Test User'
      }));
      
      // Mock quiz data
      const mockQuiz = {
        id: 'test-quiz-1',
        title: 'JavaScript Basics',
        description: 'Test your JavaScript knowledge',
        questions: [
          {
            id: 'q1',
            question: 'What is the output of console.log(typeof [])?',
            options: ['array', 'object', 'undefined', 'null'],
            correctOption: 1,
            explanation: 'Arrays are objects in JavaScript'
          },
          {
            id: 'q2',
            question: 'Which method adds an element to the end of an array?',
            options: ['push()', 'pop()', 'shift()', 'unshift()'],
            correctOption: 0,
            explanation: 'push() adds elements to the end of an array'
          }
        ]
      };
      
      // Store mock quiz
      sessionStorage.setItem('mock-quiz', JSON.stringify(mockQuiz));
    });
  });

  test('should complete a full quiz flow', async ({ page }) => {
    // Navigate to quiz
    await page.goto('/quiz/test-quiz-1/take');
    
    // Check quiz title
    await expect(page.locator('h1')).toContainText('JavaScript Basics');
    
    // Check first question
    await expect(page.getByText('What is the output of console.log(typeof [])?')).toBeVisible();
    
    // Select an answer
    await page.getByText('object').click();
    
    // Check answer is selected
    await expect(page.getByText('object').closest('label')).toHaveClass(/selected/);
    
    // Navigate to next question
    await page.getByRole('button', { name: /next/i }).click();
    
    // Check second question
    await expect(page.getByText('Which method adds an element to the end of an array?')).toBeVisible();
    
    // Select answer
    await page.getByText('push()').click();
    
    // Submit quiz
    await page.getByRole('button', { name: /submit/i }).click();
    
    // Check results page
    await expect(page.getByRole('heading', { name: /quiz complete/i })).toBeVisible();
    await expect(page.getByText(/score: 2\/2/i)).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
  });

  test('should navigate between questions', async ({ page }) => {
    await page.goto('/quiz/test-quiz-1/take');
    
    // Answer first question
    await page.getByText('object').click();
    await page.getByRole('button', { name: /next/i }).click();
    
    // Go back to previous question
    await page.getByRole('button', { name: /previous/i }).click();
    
    // Check we're back on first question
    await expect(page.getByText('What is the output of console.log(typeof [])?')).toBeVisible();
    
    // Check answer is still selected
    await expect(page.getByText('object').closest('label')).toHaveClass(/selected/);
  });

  test('should show progress indicator', async ({ page }) => {
    await page.goto('/quiz/test-quiz-1/take');
    
    // Check progress shows 1/2
    await expect(page.getByText('Question 1 of 2')).toBeVisible();
    
    // Move to next question
    await page.getByText('object').click();
    await page.getByRole('button', { name: /next/i }).click();
    
    // Check progress shows 2/2
    await expect(page.getByText('Question 2 of 2')).toBeVisible();
  });

  test('should handle quiz timer', async ({ page }) => {
    await page.goto('/quiz/test-quiz-1/take');
    
    // Check timer is visible
    const timer = page.locator('[data-testid="quiz-timer"]');
    if (await timer.isVisible()) {
      // Timer should be counting
      const initialTime = await timer.textContent();
      await page.waitForTimeout(2000);
      const afterTime = await timer.textContent();
      expect(initialTime).not.toBe(afterTime);
    }
  });

  test('should require answer selection', async ({ page }) => {
    await page.goto('/quiz/test-quiz-1/take');
    
    // Try to go next without selecting answer
    await page.getByRole('button', { name: /next/i }).click();
    
    // Should show error or stay on same question
    await expect(page.getByText('Please select an answer')).toBeVisible();
  });

  test('should show review mode after completion', async ({ page }) => {
    await page.goto('/quiz/test-quiz-1/take');
    
    // Complete quiz
    await page.getByText('object').click();
    await page.getByRole('button', { name: /next/i }).click();
    await page.getByText('push()').click();
    await page.getByRole('button', { name: /submit/i }).click();
    
    // Click review answers
    await page.getByRole('button', { name: /review answers/i }).click();
    
    // Should show questions with explanations
    await expect(page.getByText('Arrays are objects in JavaScript')).toBeVisible();
    await expect(page.getByText('push() adds elements to the end of an array')).toBeVisible();
  });

  test('should handle quiz exit confirmation', async ({ page }) => {
    await page.goto('/quiz/test-quiz-1/take');
    
    // Answer a question
    await page.getByText('object').click();
    
    // Try to navigate away
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Are you sure you want to leave?');
      dialog.dismiss();
    });
    
    // Click back or navigate
    await page.goBack();
  });
});