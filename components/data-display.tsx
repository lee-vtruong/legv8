"use client"

import { useState } from "react"
import { useSimulator } from "@/lib/context"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Edit } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DataDisplayProps {
  activeTab: "registers" | "memory" | "cpu" | "signals"
}

export function DataDisplay({ activeTab }: DataDisplayProps) {
  const { state } = useSimulator()
  const { registers, memory, cpuState, controlSignals } = state
  const [memoryAddress, setMemoryAddress] = useState<string>("0")
  const [memoryDisplayRange, setMemoryDisplayRange] = useState<[number, number]>([0, 0x40])
  const [memoryDisplayFormat, setMemoryDisplayFormat] = useState<"hex" | "decimal" | "ascii" | "instruction" | "bytes">(
    "hex",
  )

  const handleMemorySearch = () => {
    const address = Number.parseInt(memoryAddress, 16) || 0
    // Đảm bảo address luôn chia hết cho 8
    const alignedAddress = Math.floor(address / 8) * 8
    setMemoryDisplayRange([alignedAddress, alignedAddress + 0x40])
  }

  // Helper function to read doubleword from memory (Little Endian)
  const readDoublewordFromMemory = (address: number): number => {
    let result = 0
    for (let i = 0; i < 8; i++) {
      const byte = memory[address + i] || 0
      result += byte * Math.pow(256, i) // Little endian
    }
    return result
  }

  // Function to format memory values based on selected format
  const formatMemoryValue = (address: number) => {
    // DEBUG: Log memory contents
    console.log(`DEBUG: Formatting memory at address ${address}`)
    console.log(
      `DEBUG: Memory object keys around ${address}:`,
      Object.keys(memory)
        .filter((k) => {
          const addr = Number.parseInt(k)
          return addr >= address && addr < address + 16
        })
        .sort((a, b) => Number.parseInt(a) - Number.parseInt(b)),
    )

    switch (memoryDisplayFormat) {
      case "hex": {
        const value = readDoublewordFromMemory(address)
        return `0x${value.toString(16).padStart(16, "0")}`
      }
      case "decimal": {
        const value = readDoublewordFromMemory(address)
        return value.toString()
      }
      case "ascii": {
        // Convert each byte to ASCII if in printable range
        const bytes = []
        for (let i = 0; i < 8; i++) {
          const byte = memory[address + i] || 0
          if (byte > 31 && byte < 127) {
            bytes.push(String.fromCharCode(byte))
          } else {
            bytes.push(".")
          }
        }
        return bytes.reverse().join("")
      }
      case "instruction": {
        const value = readDoublewordFromMemory(address)
        const opcode = (value >> 21) & 0x7ff
        return `Op: 0x${opcode.toString(16)} (0x${value.toString(16)})`
      }
      case "bytes": {
        // Show individual bytes stored at this address - Read directly from memory
        const byteValues = []
        for (let i = 0; i < 8; i++) {
          const byteAddress = address + i
          const byte = memory[byteAddress] || 0
          console.log(`DEBUG: Reading byte at ${byteAddress}: ${byte} (0x${byte.toString(16)})`)
          byteValues.push(`[${byteAddress}]=0x${byte.toString(16).padStart(2, "0")}`)
        }
        const result = byteValues.join(" ")
        console.log(`DEBUG: Final bytes result: ${result}`)
        return result
      }
    }
  }

  // DEBUG: Log entire memory object when viewing memory tab
  if (activeTab === "memory") {
    console.log("DEBUG: Current memory object:", memory)
    console.log(
      "DEBUG: Memory keys:",
      Object.keys(memory).sort((a, b) => Number.parseInt(a) - Number.parseInt(b)),
    )
  }

  if (activeTab === "registers") {
    return (
      <div className="h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Register
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Hex
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Decimal
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {registers.map((value, index) => (
              <tr
                key={index}
                className={
                  cpuState.lastRegisterAccess?.register === `X${index}`
                    ? "bg-emerald-50 dark:bg-emerald-900/20 transition-colors duration-500"
                    : ""
                }
              >
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {index === 31 ? "XZR (X31)" : `X${index}`}
                </td>
                <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                  0x{value.toString(16).padStart(16, "0")}
                </td>
                <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (activeTab === "memory") {
    return (
      <div className="h-64 overflow-y-auto">
        <div className="flex flex-wrap items-center mb-4 gap-2">
          <Input
            type="text"
            placeholder="Memory address (hex)"
            value={memoryAddress}
            onChange={(e) => setMemoryAddress(e.target.value)}
            className="w-40 font-mono"
          />
          <Button variant="outline" size="sm" onClick={handleMemorySearch}>
            <Search className="h-4 w-4 mr-1" />
            View
          </Button>
          <Select value={memoryDisplayFormat} onValueChange={(value) => setMemoryDisplayFormat(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hex">Hexadecimal</SelectItem>
              <SelectItem value="decimal">Decimal</SelectItem>
              <SelectItem value="ascii">ASCII</SelectItem>
              <SelectItem value="instruction">Instruction</SelectItem>
              <SelectItem value="bytes">Byte Details</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Address
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Value ({memoryDisplayFormat})
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: 8 }, (_, i) => {
              // Địa chỉ tăng theo 0x8 (hex) = 8 (decimal)
              const baseAddress = Math.floor(memoryDisplayRange[0] / 8) * 8
              const address = baseAddress + i * 8

              // Always show the row, even if value is 0
              return (
                <tr
                  key={address}
                  className={
                    cpuState.lastMemoryAccess?.address === address
                      ? "bg-emerald-50 dark:bg-emerald-900/20 transition-colors duration-500"
                      : ""
                  }
                >
                  <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                    0x{address.toString(16).padStart(8, "0")}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {formatMemoryValue(address)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      title="Memory editing will be added in the next version"
                      disabled={true}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (activeTab === "cpu") {
    return (
      <div className="h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Component
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Value
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">Program Counter (PC)</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                0x{(cpuState.pc || 0).toString(16).padStart(8, "0")}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Address of the current instruction</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">Current Instruction</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                {cpuState.currentInstruction || "None"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                Assembly representation of current instruction
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">ALU Result</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                {cpuState.aluResult !== undefined ? cpuState.aluResult : "N/A"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                Output from the Arithmetic Logic Unit
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">Zero Flag</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                {cpuState.flags?.Z ? "1" : "0"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Set when ALU result is zero</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">Negative Flag</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                {cpuState.flags?.N ? "1" : "0"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Set when ALU result is negative</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">Carry Flag</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                {cpuState.flags?.C ? "1" : "0"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                Set when operation produces a carry
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">Overflow Flag</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                {cpuState.flags?.V ? "1" : "0"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                Set when operation produces an overflow
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  if (activeTab === "signals") {
    return (
      <div className="h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Signal
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Value
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Active
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(controlSignals).map(([signal, value]) => {
              const isActive = state.activeSignals.includes(signal.toLowerCase())
              return (
                <tr key={signal} className={value ? "bg-green-50 dark:bg-green-900/20" : ""}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{signal}</td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 font-bold">
                    {value ? "1" : "0"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{getSignalDescription(signal)}</td>
                  <td className="px-4 py-2 text-sm">
                    {isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}

function getSignalDescription(signal: string): string {
  const descriptions: Record<string, string> = {
    Reg2Loc: "Selects the register number for the second read register",
    UncondBranch: "Indicates an unconditional branch instruction",
    FlagBranch: "Indicates a conditional branch based on flags",
    ZeroBranch: "Indicates a branch if zero instruction",
    MemRead: "Enables reading from data memory",
    MemToReg: "Selects between ALU result and memory data for register write",
    MemWrite: "Enables writing to data memory",
    FlagWrite: "Enables writing to the flag register",
    ALUSrc: "Selects between register and immediate for ALU input",
    RegWrite: "Enables writing to the register file",
    PCSrc: "Selects between PC+4 and branch target for next PC",
  }

  return descriptions[signal] || ""
}
