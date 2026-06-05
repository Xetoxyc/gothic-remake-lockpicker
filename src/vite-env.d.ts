/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_BACKEND?: 'local' | 'file'
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
