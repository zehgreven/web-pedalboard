import { describe, expect, it } from 'vitest'
import { readModel } from '@/nam/readModel'

describe('readModel', () => {
  it('reads .nam file contents as text', async () => {
    const file = new File(['{"version": "0.5.4"}'], 'test.nam', { type: 'text/plain' })
    await expect(readModel(file)).resolves.toBe('{"version": "0.5.4"}')
  })
})
