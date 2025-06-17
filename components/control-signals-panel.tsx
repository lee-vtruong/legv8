"use client"

import { useSimulator } from "@/lib/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ControlSignalsPanel() {
  const { state } = useSimulator()
  const { controlSignals, currentMicroStep } = state

  if (currentMicroStep < 1) {
    return null
  }

  const signals = [
    { name: "RegWrite", value: controlSignals.RegWrite, color: "text-blue-600" },
    { name: "ALUSrc", value: controlSignals.ALUSrc, color: "text-green-600" },
    { name: "MemRead", value: controlSignals.MemRead, color: "text-purple-600" },
    { name: "MemWrite", value: controlSignals.MemWrite, color: "text-red-600" },
    { name: "MemToReg", value: controlSignals.MemToReg, color: "text-orange-600" },
    { name: "Reg2Loc", value: controlSignals.Reg2Loc, color: "text-pink-600" },
    { name: "UncondBranch", value: controlSignals.UncondBranch, color: "text-indigo-600" },
    { name: "ZeroBranch", value: controlSignals.ZeroBranch, color: "text-teal-600" },
    { name: "PCSrc", value: controlSignals.PCSrc, color: "text-cyan-600" },
  ]

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm">Control Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {signals.map((signal) => (
            <div
              key={signal.name}
              className="flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-800"
            >
              <span className={`font-medium ${signal.color}`}>{signal.name}:</span>
              <span className={`font-mono font-bold ${signal.value ? "text-green-600" : "text-gray-400"}`}>
                {signal.value ? "1" : "0"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
