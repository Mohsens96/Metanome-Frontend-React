import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('http://localhost:5173/')
  await expect(page.getByText('Dashboard')).toBeVisible()
})
