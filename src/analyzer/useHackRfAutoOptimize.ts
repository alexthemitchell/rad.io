import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { TrackedSignal } from '../workers/protocol'
import {
  HackRfAutoOptimizer,
  type HackRfAutoOptimizerResult,
} from '../sources/HackRfAutoOptimizer'
import type { HackRfConfig, HackRfRuntimeCommand } from '../sources/hackrfProtocol'
import type { HackRFSource } from '../sources/HackRFSource'

const OFF_RESULT: HackRfAutoOptimizerResult = {
  status: 'off',
  targetFrequencyHz: null,
  command: null,
  detail: 'Automatic optimization is off.',
}

type UseHackRfAutoOptimizeOptions = {
  enabled: boolean
  running: boolean
  source: HackRFSource | null
  config: HackRfConfig
  signals: readonly TrackedSignal[]
  selectedTargetFrequencyHz: number | null
  peakPowerDbfs: number
  onApplied: (config: HackRfConfig, command: HackRfRuntimeCommand) => void
  onFailure: (message: string) => void
}

export function useHackRfAutoOptimize({
  enabled,
  running,
  source,
  config,
  signals,
  selectedTargetFrequencyHz,
  peakPowerDbfs,
  onApplied,
  onFailure,
}: UseHackRfAutoOptimizeOptions): HackRfAutoOptimizerResult {
  const [optimizer] = useState(() => new HackRfAutoOptimizer())
  const [result, setResult] = useState<HackRfAutoOptimizerResult>(OFF_RESULT)
  const mounted = useRef(false)
  const notifyApplied = useEffectEvent(onApplied)
  const notifyFailure = useEffectEvent(onFailure)
  const readLifecycle = useEffectEvent(() => ({ enabled, running, source }))

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const nowMs = performance.now()
    const next = optimizer.update({
      enabled,
      running,
      nowMs,
      config,
      signals,
      selectedTargetFrequencyHz,
      peakPowerDbfs,
    })
    queueMicrotask(() => {
      if (active) setResult(next)
    })
    const command = next.command
    if (!command || !source) return () => {
      active = false
    }

    void source.applyRuntimeCommand(command).then(
      (appliedConfig) => {
        if (!mounted.current) return
        const lifecycle = readLifecycle()
        if (lifecycle.source !== source) return
        notifyApplied(appliedConfig, command)
        if (!lifecycle.enabled || !lifecycle.running) {
          optimizer.reset()
          setResult(OFF_RESULT)
          return
        }
        const appliedAtMs = performance.now()
        optimizer.commandApplied(command, appliedAtMs)
        setResult({
          status: 'settling',
          targetFrequencyHz: next.targetFrequencyHz,
          command: null,
          detail: 'Waiting for fresh measurements.',
        })
      },
      (error: unknown) => {
        if (!mounted.current) return
        const lifecycle = readLifecycle()
        if (lifecycle.source !== source || !lifecycle.enabled || !lifecycle.running) return
        const message = error instanceof Error ? error.message : String(error)
        optimizer.commandFailed(message)
        setResult({
          status: 'error',
          targetFrequencyHz: next.targetFrequencyHz,
          command: null,
          detail: message,
        })
        notifyFailure(message)
      },
    )
    return () => {
      active = false
    }
  }, [
    config,
    enabled,
    optimizer,
    peakPowerDbfs,
    running,
    selectedTargetFrequencyHz,
    signals,
    source,
  ])

  return result
}