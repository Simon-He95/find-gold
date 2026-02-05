const process = require('node:process')
const { defineConfig } = require('@playwright/test')

process.env.NO_PROXY = '127.0.0.1,localhost'
process.env.no_proxy = '127.0.0.1,localhost'

module.exports = defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 900, height: 900 },
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'pnpm dev:e2e',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
    },
  },
})
