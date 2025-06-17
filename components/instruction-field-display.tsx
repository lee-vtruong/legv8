"use client"
import { useSimulator } from "@/lib/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { InstructionSplitter } from "@/lib/datapath/instruction-splitter"
import { DatapathConnections } from "@/lib/datapath/datapath-connections"

export function InstructionFieldDisplay() {
  const { state } = useSimulator()
  const { program, currentInstruction, currentMicroStep } = state

  if (!program || program.length === 0 || currentInstruction >= program.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm">Instruction Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No instruction loaded</p>
        </CardContent>
      </Card>
    )
  }

  const instruction = program[currentInstruction]
  const fields = InstructionSplitter.parseInstruction(instruction)
  const fieldDescriptions = InstructionSplitter.getFieldDescriptions(fields)
  const activeComponents = DatapathConnections.getActiveComponents(currentMicroStep, instruction)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Instruction Fields
          <Badge variant="outline" className="text-xs">
            {fields.format}-Format
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Binary Representation */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Binary Representation</h4>
          <div className="font-mono text-xs bg-muted p-2 rounded">
            <div className="grid grid-cols-8 gap-1 text-center">
              {fields.instruction
                .toString(2)
                .padStart(32, "0")
                .split("")
                .map((bit, index) => (
                  <span
                    key={index}
                    className={`${
                      index % 4 === 0 ? "border-l border-gray-300" : ""
                    } ${bit === "1" ? "text-blue-600 font-bold" : "text-gray-400"}`}
                  >
                    {bit}
                  </span>
                ))}
            </div>
            <div className="text-center text-xs text-muted-foreground mt-1">{instruction.assembly}</div>
          </div>
        </div>

        {/* Field Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Field Breakdown</h4>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(fieldDescriptions).map(([field, value]) => {
              const isActive = currentMicroStep === 1 // Decode phase
              return (
                <div
                  key={field}
                  className={`flex justify-between items-center p-2 rounded text-xs ${
                    isActive ? "bg-blue-50 dark:bg-blue-900/20" : "bg-muted"
                  }`}
                >
                  <span className="font-medium">{field}:</span>
                  <span className="font-mono">{value}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Data Flow Information */}
        {currentMicroStep === 1 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Active Data Flows</h4>
            <div className="space-y-1">
              <div className="text-xs p-2 bg-green-50 dark:bg-green-900/20 rounded">
                <div className="font-medium">Opcode [31:21] → Control Unit</div>
                <div className="text-muted-foreground">
                  Value: 0x{fields.opcode.toString(16)} ({instruction.type})
                </div>
              </div>

              <div className="text-xs p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                <div className="font-medium">Rs1 [9:5] → Register File</div>
                <div className="text-muted-foreground">Value: X{fields.rs1}</div>
              </div>

              <div className="text-xs p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                <div className="font-medium">Rs2 [20:16] → MUX Input 0</div>
                <div className="text-muted-foreground">Value: X{fields.rs2}</div>
              </div>

              <div className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded">
                <div className="font-medium">Rd [4:0] → MUX Input 1</div>
                <div className="text-muted-foreground">Value: X{fields.rd}</div>
              </div>

              <div className="text-xs p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded">
                <div className="font-medium">Full Instruction [31:0] → Sign Extend</div>
                <div className="text-muted-foreground">Immediate: {fields.immediate}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
