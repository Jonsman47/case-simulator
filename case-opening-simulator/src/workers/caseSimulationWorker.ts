import {
  simulateCaseOpenings,
  type CaseSimulationRequest,
  type CaseSimulationResult,
} from '../utils/caseStats'

export interface CaseSimulationWorkerResponse {
  error?: string
  result?: CaseSimulationResult
}

self.onmessage = (event: MessageEvent<CaseSimulationRequest>) => {
  try {
    const result = simulateCaseOpenings(event.data)
    const response: CaseSimulationWorkerResponse = { result }

    self.postMessage(response)
  } catch (error) {
    const response: CaseSimulationWorkerResponse = {
      error: error instanceof Error ? error.message : 'Simulation failed.',
    }

    self.postMessage(response)
  }
}

export {}
