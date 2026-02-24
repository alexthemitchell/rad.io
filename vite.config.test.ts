import { describe, expect, it } from 'vitest'
import config, { CROSS_ORIGIN_ISOLATION_HEADERS } from './vite.config'

describe('vite cross-origin isolation headers', () => {
  it('defines the required COOP/COEP headers', () => {
    expect(CROSS_ORIGIN_ISOLATION_HEADERS['Cross-Origin-Opener-Policy']).toBe('same-origin')
    expect(CROSS_ORIGIN_ISOLATION_HEADERS['Cross-Origin-Embedder-Policy']).toBe('require-corp')
  })

  it('applies headers to dev server and preview server', () => {
    expect(config.server?.headers).toEqual(CROSS_ORIGIN_ISOLATION_HEADERS)
    expect(config.preview?.headers).toEqual(CROSS_ORIGIN_ISOLATION_HEADERS)
  })
})
