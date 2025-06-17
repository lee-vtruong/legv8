import type { Instruction } from "./types"
import { MemoryStorage } from "./storage/memory-storage"

export function executeInstruction(
  instruction: Instruction,
  registers: number[],
  memoryStorage: MemoryStorage,
  pc: number,
): {
  registers: number[]
  memoryStorage: MemoryStorage
  pc: number
  result?: number
} {
  // Create copies to avoid mutating the originals
  const newRegisters = [...registers]
  const newMemoryStorage = new MemoryStorage(memoryStorage)
  let newPC = pc + 4 // Default PC increment
  let result: number | undefined

  console.log(`DEBUG: Executing ${instruction.type}`, instruction)

  switch (instruction.type) {
    case "ADD":
      if (instruction.rd !== undefined && instruction.rs1 !== undefined && instruction.rs2 !== undefined) {
        result = (registers[instruction.rs1] || 0) + (registers[instruction.rs2] || 0)
        if (instruction.rd !== 31) {
          // XZR is read-only
          newRegisters[instruction.rd] = result
        }
      }
      break

    case "SUB":
      if (instruction.rd !== undefined && instruction.rs1 !== undefined && instruction.rs2 !== undefined) {
        result = (registers[instruction.rs1] || 0) - (registers[instruction.rs2] || 0)
        if (instruction.rd !== 31) {
          // XZR is read-only
          newRegisters[instruction.rd] = result
        }
      }
      break

    case "AND":
      if (instruction.rd !== undefined && instruction.rs1 !== undefined && instruction.rs2 !== undefined) {
        result = (registers[instruction.rs1] || 0) & (registers[instruction.rs2] || 0)
        if (instruction.rd !== 31) {
          // XZR is read-only
          newRegisters[instruction.rd] = result
        }
      }
      break

    case "ORR":
      if (instruction.rd !== undefined && instruction.rs1 !== undefined && instruction.rs2 !== undefined) {
        result = (registers[instruction.rs1] || 0) | (registers[instruction.rs2] || 0)
        if (instruction.rd !== 31) {
          // XZR is read-only
          newRegisters[instruction.rd] = result
        }
      }
      break

    case "ADDI":
      if (instruction.rd !== undefined && instruction.rs1 !== undefined && instruction.immediate !== undefined) {
        result = (registers[instruction.rs1] || 0) + instruction.immediate
        if (instruction.rd !== 31) {
          // XZR is read-only
          newRegisters[instruction.rd] = result
        }
      }
      break

    case "SUBI":
      if (instruction.rd !== undefined && instruction.rs1 !== undefined && instruction.immediate !== undefined) {
        result = (registers[instruction.rs1] || 0) - instruction.immediate
        if (instruction.rd !== 31) {
          // XZR is read-only
          newRegisters[instruction.rd] = result
        }
      }
      break

    case "LDUR":
      if (instruction.rd !== undefined && instruction.rs1 !== undefined && instruction.immediate !== undefined) {
        const address = (registers[instruction.rs1] || 0) + instruction.immediate
        console.log(`DEBUG: LDUR reading from address ${address}`)
        result = newMemoryStorage.readDoubleword(address)
        if (instruction.rd !== 31) {
          // XZR is read-only
          newRegisters[instruction.rd] = result
        }
      }
      break

    case "STUR":
      if (instruction.rs1 !== undefined && instruction.rd !== undefined && instruction.immediate !== undefined) {
        const address = (registers[instruction.rs1] || 0) + instruction.immediate
        const value = registers[instruction.rd] || 0
        console.log(`DEBUG: STUR writing value ${value} (0x${value.toString(16)}) to address ${address}`)
        newMemoryStorage.writeDoubleword(address, value)
        result = address
      }
      break

    case "B":
      if (instruction.immediate !== undefined) {
        newPC = pc + instruction.immediate
      }
      break

    case "CBZ":
      if (instruction.rs1 !== undefined && instruction.immediate !== undefined) {
        if ((registers[instruction.rs1] || 0) === 0) {
          newPC = pc + instruction.immediate
        }
      }
      break

    case "CBNZ":
      if (instruction.rs1 !== undefined && instruction.immediate !== undefined) {
        if ((registers[instruction.rs1] || 0) !== 0) {
          newPC = pc + instruction.immediate
        }
      }
      break
  }

  return {
    registers: newRegisters,
    memoryStorage: newMemoryStorage,
    pc: newPC,
    result,
  }
}
