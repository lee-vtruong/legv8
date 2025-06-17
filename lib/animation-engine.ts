// lib/animation-engine.ts - Sequential Animation Engine
export interface AnimationStep {
  id: string
  componentId: string
  pathId: string
  startTime: number
  duration: number
  data: any
  type: "data" | "control" | "address"
  sequenceOrder: number
}

export interface AnimationSequence {
  microStep: number
  steps: AnimationStep[]
  totalDuration: number
}

export class AnimationEngine {
  private sequences: Map<number, AnimationSequence> = new Map()
  private currentAnimation: AnimationSequence | null = null
  private animationStartTime = 0
  private isPlaying = false
  private callbacks: {
    onStepStart?: (step: AnimationStep) => void
    onStepComplete?: (step: AnimationStep) => void
    onSequenceComplete?: (sequence: AnimationSequence) => void
  } = {}

  constructor(callbacks?: typeof AnimationEngine.prototype.callbacks) {
    this.callbacks = callbacks || {}
  }

  // Create animation sequence for a micro step
  createSequence(microStep: number, componentStates: Record<string, any>): AnimationSequence {
    const steps: AnimationStep[] = []
    let sequenceOrder = 0
    let currentTime = 0

    // Define animation timing for each micro step
    const stepTimings = this.getStepTimings(microStep)

    stepTimings.forEach((timing) => {
      steps.push({
        id: `${microStep}-${timing.component}-${sequenceOrder}`,
        componentId: timing.component,
        pathId: timing.path,
        startTime: currentTime,
        duration: timing.duration,
        data: componentStates[timing.component],
        type: timing.type,
        sequenceOrder: sequenceOrder++,
      })
      currentTime += timing.duration
    })

    const sequence: AnimationSequence = {
      microStep,
      steps,
      totalDuration: currentTime,
    }

    this.sequences.set(microStep, sequence)
    return sequence
  }

  private getStepTimings(microStep: number): Array<{
    component: string
    path: string
    duration: number
    type: "data" | "control" | "address"
  }> {
    const baseTimings = {
      0: [
        // Fetch
        { component: "pc", path: "pc-im", duration: 800, type: "address" as const },
        { component: "instruction-memory", path: "im-decode", duration: 600, type: "data" as const },
        { component: "pc", path: "pc-adder4", duration: 400, type: "address" as const },
      ],
      1: [
        // Decode
        { component: "control-unit", path: "control-signals", duration: 700, type: "control" as const },
        { component: "registers", path: "reg-read", duration: 500, type: "data" as const },
        { component: "sign-extend", path: "immediate", duration: 400, type: "data" as const },
      ],
      2: [
        // Execute
        { component: "alu", path: "alu-operation", duration: 900, type: "data" as const },
        { component: "alu", path: "alu-flags", duration: 300, type: "control" as const },
      ],
      3: [
        // Memory
        { component: "data-memory", path: "memory-access", duration: 800, type: "data" as const },
      ],
      4: [
        // Write Back
        { component: "registers", path: "reg-write", duration: 600, type: "data" as const },
      ],
      5: [
        // Update PC
        { component: "pc", path: "pc-update", duration: 500, type: "address" as const },
      ],
    }

    return baseTimings[microStep as keyof typeof baseTimings] || []
  }

  // Play animation sequence
  playSequence(microStep: number): Promise<void> {
    return new Promise((resolve) => {
      const sequence = this.sequences.get(microStep)
      if (!sequence) {
        resolve()
        return
      }

      this.currentAnimation = sequence
      this.animationStartTime = performance.now()
      this.isPlaying = true

      const animate = (currentTime: number) => {
        if (!this.isPlaying || !this.currentAnimation) {
          resolve()
          return
        }

        const elapsed = currentTime - this.animationStartTime
        const activeSteps = this.currentAnimation.steps.filter(
          (step) => elapsed >= step.startTime && elapsed < step.startTime + step.duration,
        )

        // Trigger callbacks for active steps
        activeSteps.forEach((step) => {
          if (this.callbacks.onStepStart) {
            this.callbacks.onStepStart(step)
          }
        })

        // Check for completed steps
        const completedSteps = this.currentAnimation.steps.filter((step) => elapsed >= step.startTime + step.duration)

        completedSteps.forEach((step) => {
          if (this.callbacks.onStepComplete) {
            this.callbacks.onStepComplete(step)
          }
        })

        // Check if sequence is complete
        if (elapsed >= this.currentAnimation.totalDuration) {
          this.isPlaying = false
          if (this.callbacks.onSequenceComplete) {
            this.callbacks.onSequenceComplete(this.currentAnimation)
          }
          resolve()
        } else {
          requestAnimationFrame(animate)
        }
      }

      requestAnimationFrame(animate)
    })
  }

  // Stop current animation
  stop(): void {
    this.isPlaying = false
    this.currentAnimation = null
  }

  // Get current animation progress
  getProgress(): number {
    if (!this.currentAnimation || !this.isPlaying) return 0
    const elapsed = performance.now() - this.animationStartTime
    return Math.min(elapsed / this.currentAnimation.totalDuration, 1)
  }

  // Check if animation is playing
  isAnimating(): boolean {
    return this.isPlaying
  }
}
