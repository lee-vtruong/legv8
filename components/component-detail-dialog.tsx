"use client"

import { useSimulator } from "@/lib/context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface ComponentDetailDialogProps {
  componentId: string | null
  isOpen: boolean
  onClose: () => void
}

const componentDetails = {
  pc: {
    name: "Program Counter (PC)",
    description: "Stores the address of the current instruction being executed",
    inputs: ["Next PC value from PC MUX"],
    outputs: ["Current PC value to Instruction Memory", "PC value to Branch Adder"],
    function:
      "Maintains the address of the instruction currently being executed and updates to the next instruction address",
  },
  "instruction-memory": {
    name: "Instruction Memory",
    description: "Read-only memory that stores the program instructions",
    inputs: ["PC address"],
    outputs: ["32-bit instruction", "Opcode to Control Unit", "Register fields", "Immediate field"],
    function:
      "Retrieves the instruction at the address specified by the PC and provides instruction fields to other components",
  },
  "control-unit": {
    name: "Control Unit",
    description: "Generates control signals based on the instruction opcode",
    inputs: ["Instruction opcode"],
    outputs: ["All control signals (RegWrite, MemRead, MemWrite, ALUSrc, etc.)"],
    function: "Decodes the instruction and generates appropriate control signals to coordinate datapath operations",
  },
  registers: {
    name: "Register File",
    description: "Contains 32 64-bit general-purpose registers (X0-X30) plus XZR",
    inputs: ["Read register 1", "Read register 2", "Write register", "Write data", "RegWrite signal"],
    outputs: ["Read data 1", "Read data 2"],
    function: "Provides register values for operations and stores results back to registers",
  },
  alu: {
    name: "Arithmetic Logic Unit (ALU)",
    description: "Performs arithmetic and logical operations",
    inputs: ["Operand A from registers", "Operand B from MUX", "ALU control signals"],
    outputs: ["ALU result", "Zero flag", "Other condition flags"],
    function: "Executes the actual computation specified by the instruction",
  },
  "data-memory": {
    name: "Data Memory",
    description: "Read/write memory for storing program data",
    inputs: ["Address from ALU", "Write data", "MemRead signal", "MemWrite signal"],
    outputs: ["Read data"],
    function: "Stores and retrieves data values used by the program during execution",
  },
}

export function ComponentDetailDialog({ componentId, isOpen, onClose }: ComponentDetailDialogProps) {
  const { state } = useSimulator()
  const { cpuState, registers, memory, controlSignals, activeComponents } = state

  if (!componentId || !componentDetails[componentId as keyof typeof componentDetails]) {
    return null
  }

  const component = componentDetails[componentId as keyof typeof componentDetails]
  const isActive = activeComponents.includes(componentId)

  const getCurrentValues = () => {
    switch (componentId) {
      case "pc":
        return {
          currentValue: `0x${cpuState.pc.toString(16).padStart(8, "0")}`,
          nextValue: `0x${(cpuState.pc + 4).toString(16).padStart(8, "0")}`,
        }
      case "alu":
        return {
          result: cpuState.aluResult !== undefined ? `0x${cpuState.aluResult.toString(16)}` : "N/A",
          flags: `N:${cpuState.flags?.N ? "1" : "0"} Z:${cpuState.flags?.Z ? "1" : "0"} C:${cpuState.flags?.C ? "1" : "0"} V:${cpuState.flags?.V ? "1" : "0"}`,
        }
      case "registers":
        return {
          lastAccess: cpuState.lastRegisterAccess
            ? `${cpuState.lastRegisterAccess.register} = ${cpuState.lastRegisterAccess.value}`
            : "None",
        }
      case "data-memory":
        return {
          lastAccess: cpuState.lastMemoryAccess
            ? `Addr: 0x${cpuState.lastMemoryAccess.address.toString(16)}, Value: ${cpuState.lastMemoryAccess.value}, Type: ${cpuState.lastMemoryAccess.type}`
            : "None",
        }
      default:
        return {}
    }
  }

  const currentValues = getCurrentValues()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {component.name}
            <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Idle"}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{component.description}</p>

          <div>
            <h4 className="font-medium mb-2">Function</h4>
            <p className="text-sm">{component.function}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2 text-green-600">Inputs</h4>
              <ul className="text-xs space-y-1">
                {component.inputs.map((input, index) => (
                  <li key={index} className="text-muted-foreground">
                    • {input}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-blue-600">Outputs</h4>
              <ul className="text-xs space-y-1">
                {component.outputs.map((output, index) => (
                  <li key={index} className="text-muted-foreground">
                    • {output}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {Object.keys(currentValues).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Current Values</h4>
                <div className="space-y-1">
                  {Object.entries(currentValues).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}:</span>
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
