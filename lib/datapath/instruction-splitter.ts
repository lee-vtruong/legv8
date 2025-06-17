// lib/datapath/instruction-splitter.ts - Instruction Field Splitter
import type { Instruction, InstructionType } from "../types"

export interface InstructionFields {
  // Raw instruction
  instruction: number

  // Common fields
  opcode: number // [31:21] - 11 bits
  rd: number // [4:0] - 5 bits
  rs1: number // [9:5] - 5 bits
  rs2: number // [20:16] - 5 bits

  // Format-specific fields
  immediate: number // Various positions depending on format
  shamt: number // [15:10] - 6 bits for shift amount

  // Instruction format type
  format: "R" | "I" | "D" | "B" | "CB"
}

export class InstructionSplitter {
  /**
   * Parse instruction assembly into binary and extract fields
   */
  static parseInstruction(instruction: Instruction): InstructionFields {
    // Convert assembly to binary representation (simplified)
    const binaryInstruction = this.assembleToBinary(instruction)

    return this.extractFields(binaryInstruction, instruction)
  }

  /**
   * Extract bit fields from 32-bit instruction
   */
  static extractFields(instructionBinary: number, instruction: Instruction): InstructionFields {
    const fields: InstructionFields = {
      instruction: instructionBinary,
      opcode: this.extractBits(instructionBinary, 31, 21), // [31:21]
      rd: this.extractBits(instructionBinary, 4, 0), // [4:0]
      rs1: this.extractBits(instructionBinary, 9, 5), // [9:5]
      rs2: this.extractBits(instructionBinary, 20, 16), // [20:16]
      immediate: 0,
      shamt: this.extractBits(instructionBinary, 15, 10), // [15:10]
      format: this.determineFormat(instruction.type),
    }

    // Extract immediate based on instruction format
    fields.immediate = this.extractImmediate(instructionBinary, fields.format, instruction)

    return fields
  }

  /**
   * Extract bits from position high to low (inclusive)
   */
  private static extractBits(value: number, high: number, low: number): number {
    const mask = (1 << (high - low + 1)) - 1
    return (value >>> low) & mask
  }

  /**
   * Extract immediate value based on instruction format
   */
  private static extractImmediate(instruction: number, format: string, instrObj: Instruction): number {
    switch (format) {
      case "I": // I-format: [21:10] - 12 bits
        return this.signExtend(this.extractBits(instruction, 21, 10), 12)

      case "D": // D-format: [20:12] - 9 bits
        return this.signExtend(this.extractBits(instruction, 20, 12), 9)

      case "B": // B-format: [25:0] - 26 bits
        return this.signExtend(this.extractBits(instruction, 25, 0), 26)

      case "CB": // CB-format: [23:5] - 19 bits
        return this.signExtend(this.extractBits(instruction, 23, 5), 19)

      default:
        return instrObj.immediate || 0
    }
  }

  /**
   * Sign extend a value from specified bit width to 32 bits
   */
  private static signExtend(value: number, bits: number): number {
    const signBit = 1 << (bits - 1)
    if (value & signBit) {
      // Negative number - extend with 1s
      return value | ~((1 << bits) - 1)
    }
    return value
  }

  /**
   * Determine instruction format from opcode
   */
  private static determineFormat(type: InstructionType): "R" | "I" | "D" | "B" | "CB" {
    switch (type) {
      case "ADD":
      case "SUB":
      case "AND":
      case "ORR":
        return "R"

      case "ADDI":
      case "SUBI":
        return "I"

      case "LDUR":
      case "STUR":
        return "D"

      case "B":
        return "B"

      case "CBZ":
      case "CBNZ":
        return "CB"

      default:
        return "R"
    }
  }

  /**
   * Convert instruction object to binary (simplified encoding)
   */
  private static assembleToBinary(instruction: Instruction): number {
    let binary = 0

    // Set opcode based on instruction type
    const opcode = this.getOpcode(instruction.type)
    binary |= opcode << 21 // [31:21]

    // Set register fields
    if (instruction.rd !== undefined) {
      binary |= instruction.rd & 0x1f // [4:0]
    }

    if (instruction.rs1 !== undefined) {
      binary |= (instruction.rs1 & 0x1f) << 5 // [9:5]
    }

    if (instruction.rs2 !== undefined) {
      binary |= (instruction.rs2 & 0x1f) << 16 // [20:16]
    }

    // Set immediate field based on format
    if (instruction.immediate !== undefined) {
      const format = this.determineFormat(instruction.type)
      binary |= this.encodeImmediate(instruction.immediate, format)
    }

    return binary >>> 0 // Ensure unsigned 32-bit
  }

  /**
   * Get opcode for instruction type (simplified)
   */
  private static getOpcode(type: InstructionType): number {
    const opcodes: Record<InstructionType, number> = {
      ADD: 0x458, // 10001011000
      SUB: 0x658, // 11001011000
      AND: 0x450, // 10001010000
      ORR: 0x550, // 10101010000
      ADDI: 0x488, // 10010001000
      SUBI: 0x688, // 11010001000
      LDUR: 0x7c2, // 11111000010
      STUR: 0x7c0, // 11111000000
      B: 0x0a0, // 00010100000
      CBZ: 0x5a0, // 10110100000
      CBNZ: 0x5a8, // 10110101000
    }

    return opcodes[type] || 0
  }

  /**
   * Encode immediate value based on format
   */
  private static encodeImmediate(immediate: number, format: string): number {
    switch (format) {
      case "I": // [21:10]
        return (immediate & 0xfff) << 10

      case "D": // [20:12]
        return (immediate & 0x1ff) << 12

      case "B": // [25:0]
        return immediate & 0x3ffffff

      case "CB": // [23:5]
        return (immediate & 0x7ffff) << 5

      default:
        return 0
    }
  }

  /**
   * Get instruction field descriptions for debugging
   */
  static getFieldDescriptions(fields: InstructionFields): Record<string, string> {
    return {
      "Instruction [31:0]": `0x${fields.instruction.toString(16).padStart(8, "0")}`,
      "Opcode [31:21]": `0x${fields.opcode.toString(16)} (${fields.opcode})`,
      "Rd [4:0]": `X${fields.rd}`,
      "Rs1 [9:5]": `X${fields.rs1}`,
      "Rs2 [20:16]": `X${fields.rs2}`,
      Immediate: `${fields.immediate}`,
      Format: fields.format,
    }
  }
}
