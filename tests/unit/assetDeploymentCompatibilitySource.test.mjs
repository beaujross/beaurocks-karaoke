import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('production bootstrap uses a stable entry module and retains recent entry aliases', async () => {
  const [viteConfig, aliasScript] = await Promise.all([
    readSource('vite.config.js'),
    readSource('scripts/generate-asset-aliases.mjs'),
  ])

  assert.match(viteConfig, /entryFileNames:\s*.+assets\/\[name\]\.js/)
  assert.match(aliasScript, /index-1pP0wgeV\.js/)
  assert.match(aliasScript, /index-Ch-L3ULK\.js/)
})

test('application bootstrap performs a throttled reload for stale lazy chunks', async () => {
  const source = await readSource('src/main.jsx')

  assert.match(source, /vite:preloadError/)
  assert.match(source, /STALE_ASSET_RELOAD_KEY/)
  assert.match(source, /now - previousReloadAt < 15000/)
  assert.match(source, /event\.preventDefault\(\)/)
  assert.match(source, /window\.location\.reload\(\)/)
})
