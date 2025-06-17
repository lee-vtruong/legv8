"use client"

import { CpuSimulator } from "./cpu-simulator"
import { InstructionBreakdownPanel } from "./instruction-breakdown-panel"
import { ControlSignalsPanel } from "./control-signals-panel"
import { ComponentValuesPanel } from "./component-values-panel"

export function EnhancedCpuSimulator() {
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Main Datapath */}
      <div className="flex-1 min-h-0">
        <CpuSimulator />
      </div>

      {/* Side Panels */}
      <div className="w-full lg:w-80 space-y-4 overflow-y-auto">
        <InstructionBreakdownPanel />
        <ControlSignalsPanel />
        <ComponentValuesPanel />
      </div>
    </div>
  )
}
