import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './playwright',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
})
