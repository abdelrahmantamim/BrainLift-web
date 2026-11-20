import { test, expect } from '@playwright/test';

test.describe('Chat Feature', () => {
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
    
    await page.goto('/chat');
  });

  test('should display chat interface', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('AI Assistant');
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
  });

  test('should send a message', async ({ page }) => {
    const messageInput = page.getByPlaceholder('Type your message...');
    const sendButton = page.getByRole('button', { name: /send/i });
    
    // Type and send message
    await messageInput.fill('Hello, AI!');
    await sendButton.click();
    
    // Check message appears
    await expect(page.getByText('Hello, AI!')).toBeVisible();
    
    // Check input is cleared
    await expect(messageInput).toHaveValue('');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    const messageInput = page.getByPlaceholder('Type your message...');
    
    // Type message and press Enter
    await messageInput.fill('Test message');
    await messageInput.press('Enter');
    
    // Check message appears
    await expect(page.getByText('Test message')).toBeVisible();
  });

  test('should handle multiline input with Shift+Enter', async ({ page }) => {
    const messageInput = page.getByPlaceholder('Type your message...');
    
    // Type multiline message
    await messageInput.fill('Line 1');
    await messageInput.press('Shift+Enter');
    await messageInput.type('Line 2');
    
    // Check input contains both lines
    await expect(messageInput).toHaveValue('Line 1\nLine 2');
  });

  test('should copy message content', async ({ page }) => {
    // Send a message first
    await page.getByPlaceholder('Type your message...').fill('Test message');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for message to appear
    await page.waitForSelector('text=Test message');
    
    // Click copy button
    const copyButton = page.locator('button[title="Copy message"]').first();
    await copyButton.click();
    
    // Check for success toast
    await expect(page.getByText('Copied to clipboard!')).toBeVisible();
  });

  test('should export message as PDF', async ({ page }) => {
    // Send a message first
    await page.getByPlaceholder('Type your message...').fill('Export this message');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for message to appear
    await page.waitForSelector('text=Export this message');
    
    // Click PDF export button
    const pdfButton = page.locator('button').filter({ has: page.locator('.lucide-file-down') }).first();
    await pdfButton.click();
    
    // Check for export options
    await expect(page.getByText('Download PDF')).toBeVisible();
    await expect(page.getByText('Preview PDF')).toBeVisible();
  });

  test('should share message', async ({ page }) => {
    // Send a message first
    await page.getByPlaceholder('Type your message...').fill('Share this message');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for message to appear
    await page.waitForSelector('text=Share this message');
    
    // Click share button
    const shareButton = page.locator('button[title="Share message"]').first();
    await shareButton.click();
    
    // Check share modal appears
    await expect(page.getByRole('heading', { name: /share/i })).toBeVisible();
    await expect(page.getByText('Expires after')).toBeVisible();
  });

  test('should upload file', async ({ page }) => {
    // Click upload button
    await page.getByRole('button', { name: /upload/i }).click();
    
    // Check modal appears
    await expect(page.getByRole('heading', { name: /upload files/i })).toBeVisible();
    
    // Upload a file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content')
    });
    
    // Check file appears in list
    await expect(page.getByText('test.txt')).toBeVisible();
  });
});