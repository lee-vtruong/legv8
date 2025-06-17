"use client"

import { useSimulator } from "@/lib/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InstructionSplitter } from "@/lib/datapath/instruction-splitter"

export function InstructionBreakdownPanel() {
  const { state } = useSimulator()
  const { program, currentInstruction, currentMicroStep } = state

  if (currentInstruction >= program.length || currentMicroStep < 1) {
    return null
  }

  const instruction = program[currentInstruction]
  if (!instruction) return null

  try {
    const fields = InstructionSplitter.parseInstruction(instruction)

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm">Instruction Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs font-mono">
            <div className="font-semibold mb-2">{instruction.assembly}</div>
            <div className="text-gray-600 dark:text-gray-400 mb-2">
              Hex: 0x{fields.instruction.toString(16).padStart(8, "0").toUpperCase()}
            </div>
            <div className="text-gray-600 dark:text-gray-400 mb-3">
              Binary:{" "}
              {fields.instruction
                .toString(2)
                .padStart(32, "0")
                .match(/.{1,4}/g)
                ?.join(" ")}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-blue-600 dark:text-blue-400">Opcode [31:21]:</span>
              <span className="font-mono">
                {fields.opcode.toString(2).padStart(11, "0")} ({fields.opcode})
              </span>
            </div>

            {fields.format === "R" && (
              <>
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">Rm [20:16]:</span>
                  <span className="font-mono">
                    {fields.rs2.toString(2).padStart(5, "0")} (X{fields.rs2})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-600 dark:text-purple-400">Shamt [15:10]:</span>
                  <span className="font-mono">
                    {fields.shamt.toString(2).padStart(6, "0")} ({fields.shamt})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-600 dark:text-orange-400">Rn [9:5]:</span>
                  <span className="font-mono">
                    {fields.rs1.toString(2).padStart(5, "0")} (X{fields.rs1})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600 dark:text-red-400">Rd [4:0]:</span>
                  <span className="font-mono">
                    {fields.rd.toString(2).padStart(5, "0")} (X{fields.rd})
                  </span>
                </div>
              </>
            )}

            {fields.format === "I" && (
              <>
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">Immediate [21:10]:</span>
                  <span className="font-mono">
                    {fields.immediate.toString(2).padStart(12, "0")} ({fields.immediate})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-600 dark:text-orange-400">Rn [9:5]:</span>
                  <span className="font-mono">
                    {fields.rs1.toString(2).padStart(5, "0")} (X{fields.rs1})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600 dark:text-red-400">Rd [4:0]:</span>
                  <span className="font-mono">
                    {fields.rd.toString(2).padStart(5, "0")} (X{fields.rd})
                  </span>
                </div>
              </>
            )}

            {fields.format === "D" && (
              <>
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">Address [20:12]:</span>
                  <span className="font-mono">
                    {fields.immediate.toString(2).padStart(9, "0")} ({fields.immediate})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-600 dark:text-orange-400">Rn [9:5]:</span>
                  <span className="font-mono">
                    {fields.rs1.toString(2).padStart(5, "0")} (X{fields.rs1})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600 dark:text-red-400">Rt [4:0]:</span>
                  <span className="font-mono">
                    {fields.rd.toString(2).padStart(5, "0")} (X{fields.rd})
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  } catch (error) {
    return null
  }
}
