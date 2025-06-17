// lib/datapath/micro-step.ts - MicroStep tracking system
import type { ComponentID, BusID } from "./component-ids"

export interface StepInfo {
  description: string
  startComponent: ComponentID
  endComponent: ComponentID
  bus: BusID
  value: string
  timestamp?: number
}

export interface MicroStep {
  stepId: string
  timestamp: number
  microStepNumber: number
  instructionIndex: number
  stepInfos: StepInfo[]
  cpuState: {
    pc: number
    registers: number[]
    memory: Record<number, number>
    flags: {
      N: boolean
      Z: boolean
      C: boolean
      V: boolean
    }
  }
  controlSignals: Record<string, boolean | number>
  activeComponents: ComponentID[]
  activeBuses: BusID[]
  description: string
}

export class MicroStepTracker {
  private steps: MicroStep[] = []
  private currentStepId = 0

  createStep(
    microStepNumber: number,
    instructionIndex: number,
    description: string,
    stepInfos: StepInfo[],
    cpuState: any,
    controlSignals: any,
    activeComponents: ComponentID[],
    activeBuses: BusID[],
  ): MicroStep {
    const step: MicroStep = {
      stepId: `step_${this.currentStepId++}`,
      timestamp: Date.now(),
      microStepNumber,
      instructionIndex,
      stepInfos,
      cpuState: { ...cpuState },
      controlSignals: { ...controlSignals },
      activeComponents: [...activeComponents],
      activeBuses: [...activeBuses],
      description,
    }

    this.steps.push(step)
    return step
  }

  addStepInfo(stepInfo: StepInfo): void {
    if (this.steps.length > 0) {
      const currentStep = this.steps[this.steps.length - 1]
      currentStep.stepInfos.push(stepInfo)
      currentStep.activeBuses.push(stepInfo.bus)

      if (!currentStep.activeComponents.includes(stepInfo.startComponent)) {
        currentStep.activeComponents.push(stepInfo.startComponent)
      }
      if (!currentStep.activeComponents.includes(stepInfo.endComponent)) {
        currentStep.activeComponents.push(stepInfo.endComponent)
      }
    }
  }

  getSteps(): MicroStep[] {
    return [...this.steps]
  }

  getLastStep(): MicroStep | undefined {
    return this.steps[this.steps.length - 1]
  }

  clear(): void {
    this.steps = []
    this.currentStepId = 0
  }

  getStepsByInstruction(instructionIndex: number): MicroStep[] {
    return this.steps.filter((step) => step.instructionIndex === instructionIndex)
  }
}
