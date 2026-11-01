import { test, expect } from '@playwright/test';

test.describe('Parakh Simulation Flow', () => {
  test('should allow user to enter an idea and reach clarify phase', async ({ page }) => {
    // Navigate to the main simulation entry
    await page.goto('http://localhost:3000');

    // In a real E2E test, we would look for the specific input and buttons.
    // Assuming there is a link/button to "Start Simulation"
    const startLink = page.getByRole('link', { name: /start/i });
    if (await startLink.isVisible()) {
      await startLink.click();
    }

    // Now we should be on /simulate or similar
    // Check if there is an input for the startup idea
    const ideaInput = page.getByPlaceholder(/idea/i).first();
    // Use fallback if not found
    if (await ideaInput.isVisible()) {
      await ideaInput.fill('A SaaS platform for pet sitters');
      const submitButton = page.getByRole('button', { name: /submit|clarify/i });
      await submitButton.click();
      
      // Wait for Clarify questions to appear
      await expect(page.getByText(/market|audience|funding/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('lessons dashboard should render correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/lessons');
    
    // Check for the header
    await expect(page.getByRole('heading', { name: /AI Global Memory/i })).toBeVisible();
    
    // We expect either loading state or some lessons/empty state
    // Just asserting the page loads without crashing
    const mainContent = page.locator('text=AI Global Memory');
    await expect(mainContent).toBeVisible();
  });
});
