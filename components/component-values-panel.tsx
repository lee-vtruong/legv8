"use client"

import { useSimulator } from "@/lib/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ComponentValuesPanel() {
  const { state } = useSimulator()
  const { cpuState, registers, currentMicroStep, program, currentInstruction } = state

  if (currentMicroStep < 0 || currentInstruction >= program.length) {
    return null
  }

  const instruction = program[currentInstruction]

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm">Component Values</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* PC Value */}
          <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20">
            <div className="font-semibold text-blue-700 dark:text-blue-300">PC</div>
            <div className="font-mono">0x{cpuState.pc.toString(16).padStart(8, "0")}</div>
            <div className="font-mono text-gray-600 dark:text-gray-400">
              {cpuState.pc
                .toString(2)
                .padStart(32, "0")
                .match(/.{1,4}/g)
                ?.join(" ")}
            </div>
          </div>

          {/* ALU Result */}
          {cpuState.aluResult !== undefined && (
            <div className="p-2 rounded bg-green-50 dark:bg-green-900/20">
              <div className="font-semibold text-green-700 dark:text-green-300">ALU Result</div>
              <div className="font-mono">0x{cpuState.aluResult.toString(16).padStart(8, "0")}</div>
              <div className="font-mono text-gray-600 dark:text-gray-400">
                {cpuState.aluResult
                  .toString(2)
                  .padStart(32, "0")
                  .match(/.{1,4}/g)
                  ?.join(" ")}
              </div>
            </div>
          )}

          {/* Register Values */}
          {instruction.rs1 !== undefined && instruction.rs1 !== 31 && (
            <div className="p-2 rounded bg-purple-50 dark:bg-purple-900/20">
              <div className="font-semibold text-purple-700 dark:text-purple-300">X{instruction.rs1} (Read 1)</div>
              <div className="font-mono">{registers[instruction.rs1] || 0}</div>
              <div className="font-mono text-gray-600 dark:text-gray-400">
                {(registers[instruction.rs1] || 0)
                  .toString(2)
                  .padStart(16, "0")
                  .match(/.{1,4}/g)
                  ?.join(" ")}
              </div>
            </div>
          )}

          {instruction.rs2 !== undefined && instruction.rs2 !== 31 && (
            <div className="p-2 rounded bg-orange-50 dark:bg-orange-900/20">
              <div className="font-semibold text-orange-700 dark:text-orange-300">X{instruction.rs2} (Read 2)</div>
              <div className="font-mono">{registers[instruction.rs2] || 0}</div>
              <div className="font-mono text-gray-600 dark:text-gray-400">
                {(registers[instruction.rs2] || 0)
                  .toString(2)
                  .padStart(16, "0")
                  .match(/.{1,4}/g)
                  ?.join(" ")}
              </div>
            </div>
          )}

          {/* Immediate Value */}
          {instruction.immediate !== undefined && (
            <div className="p-2 rounded bg-pink-50 dark:bg-pink-900/20">
              <div className="font-semibold text-pink-700 dark:text-pink-300">Immediate</div>
              <div className="font-mono">{instruction.immediate}</div>
              <div className="font-mono text-gray-600 dark:text-gray-400">
                {instruction.immediate
                  .toString(2)
                  .padStart(16, "0")
                  .match(/.{1,4}/g)
                  ?.join(" ")}
              </div>
            </div>
          )}

          {/* Flags */}
          <div className="p-2 rounded bg-red-50 dark:bg-red-900/20">
            <div className="font-semibold text-red-700 dark:text-red-300">Flags</div>
            <div className="font-mono">
              N:{cpuState.flags?.N ? "1" : "0"}
              Z:{cpuState.flags?.Z ? "1" : "0"}
              C:{cpuState.flags?.C ? "1" : "0"}
              V:{cpuState.flags?.V ? "1" : "0"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
