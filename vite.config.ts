import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { chestStoragePlugin } from './plugins/chestStorage.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const useFileBackend = (env.VITE_STORAGE_BACKEND ?? 'local').toLowerCase() === 'file'

  // GitHub Pages serves project sites at /repo-name/ — set VITE_BASE_PATH in CI.
  const base = env.VITE_BASE_PATH?.trim() || '/'

  return {
    base,
    plugins: useFileBackend
      ? [chestStoragePlugin(path.resolve(rootDir, 'data/chests'))]
      : [],
  }
})
