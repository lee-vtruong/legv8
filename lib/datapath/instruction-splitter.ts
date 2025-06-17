// lib/datapath/instruction-splitter.ts - Instruction Field Splitter (FINAL-FIXED)
import type { Instruction, InstructionType } from "../types"

export interface InstructionFields {
  // Raw instruction
  instruction: number

  // Common fields
  opcode: number // Varies in length and position
  rd: number // [4:0] - Destination/Target register
  rs1: number // [9:5] - Source register 1
  rs2: number // [20:16] - Source register 2

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
    const binaryInstruction = this.assembleToBinary(instruction)
    return this.extractFields(binaryInstruction, instruction)
  }

  /**
   * Extract bit fields from 32-bit instruction
   */
  static extractFields(instructionBinary: number, instruction: Instruction): InstructionFields {
    const format = this.determineFormat(instruction.type)

    let opcode = 0, rd = 0, rs1 = 0, rs2 = 0, shamt = 0;

    switch (format) {
      case "R":
        opcode = this.extractBits(instructionBinary, 31, 21);
        rd = this.extractBits(instructionBinary, 4, 0);
        rs1 = this.extractBits(instructionBinary, 9, 5);
        rs2 = this.extractBits(instructionBinary, 20, 16);
        shamt = this.extractBits(instructionBinary, 15, 10);
        break;
      case "I":
        opcode = this.extractBits(instructionBinary, 31, 22);
        rd = this.extractBits(instructionBinary, 4, 0);
        rs1 = this.extractBits(instructionBinary, 9, 5);
        break;
      case "D":
        opcode = this.extractBits(instructionBinary, 31, 21);
        rd = this.extractBits(instructionBinary, 4, 0); // Rt
        rs1 = this.extractBits(instructionBinary, 9, 5); // Rn
        break;
      case "B":
        opcode = this.extractBits(instructionBinary, 31, 26);
        break;
      case "CB":
        opcode = this.extractBits(instructionBinary, 31, 21); // <-- Sửa lại 11 bit
        rd = this.extractBits(instructionBinary, 4, 0); // Rt
        break;
    }

    const fields: InstructionFields = {
      instruction: instructionBinary,
      opcode,
      rd,
      rs1,
      rs2,
      immediate: this.extractImmediate(instructionBinary, format, instruction),
      shamt,
      format,
    };

    return fields;
  }

  private static extractBits(value: number, high: number, low: number): number {
    const mask = (1 << (high - low + 1)) - 1
    return (value >>> low) & mask
  }

  private static extractImmediate(instruction: number, format: string, instrObj: Instruction): number {
    switch (format) {
      case "I": // I-format: [21:10]
        return this.signExtend(this.extractBits(instruction, 21, 10), 12)
      case "D": // D-format: [20:12]
        return this.signExtend(this.extractBits(instruction, 20, 12), 9)
      case "B": // B-format: [25:0]
        return this.signExtend(this.extractBits(instruction, 25, 0), 26)
      case "CB": // CB-format: [23:5]
        return this.signExtend(this.extractBits(instruction, 23, 5), 19)
      default:
        return instrObj.immediate || 0
    }
  }

  private static signExtend(value: number, bits: number): number {
    const signBit = 1 << (bits - 1)
    if (value & signBit) {
      return value | ~((1 << bits) - 1)
    }
    return value
  }

  private static determineFormat(type: InstructionType): "R" | "I" | "D" | "B" | "CB" {
    switch (type) {
      case "ADD": case "SUB": case "AND": case "ORR": return "R"
      case "ADDI": case "SUBI": return "I"
      case "LDUR": case "STUR": return "D"
      case "B": return "B"
      case "CBZ": case "CBNZ": return "CB"
      default: return "R"
    }
  }

  /**
   * CORRECTLY convert instruction object to binary based on its format
   */
  private static assembleToBinary(instruction: Instruction): number {
    let binary = 0;
    const format = this.determineFormat(instruction.type);
    const opcode = this.getOpcode(instruction.type);
    console.log("Instruction type:", instruction.type);
    const imm = instruction.immediate || 0;
    const rd = instruction.rd || 0;
    const rs1 = instruction.rs1 || 0;
    const rs2 = instruction.rs2 || 0;
    const shamt = instruction.shamt || 0;

    switch (format) {
      case "R":
        binary = (opcode << 21) | (rs2 << 16) | (shamt << 10) | (rs1 << 5) | rd;
        break;
      case "I":
        binary = (opcode << 22) | ((imm & 0xFFF) << 10) | (rs1 << 5) | rd;
        break;
      case "D":
        binary = (opcode << 21) | ((imm & 0x1FF) << 12) | (rs1 << 5) | rd;
        break;
      case "B":
        binary = (opcode << 26) | (imm & 0x3FFFFFF);
        break;
      case "CB":
        binary = (opcode << 21) | ((imm & 0x7FFFF) << 5) | rd;
        break;
    }
    return binary >>> 0;
  }

  private static getOpcode(type: InstructionType): number {
    const opcodes: Record<string, number> = {
      ADD: 0b10001011000, SUB: 0b11001011000, AND: 0b10001010000, ORR: 0b10101010000,
      ADDI: 0b1001000100, SUBI: 0b1101000100,
      LDUR: 0b11111000010, STUR: 0b11111000000,
      B: 0b000101,
      CBZ: 0b10110100000, // 11 bit
      CBNZ: 0b10110101000, // 11 bit
    }
    console.log("getOpcode type:", type, "opcode:", opcodes[type]);
    return opcodes[type] || 0
  }

  /**
   * Get instruction field descriptions with CORRECT bit ranges for the UI
   */
  static getFieldDescriptions(fields: InstructionFields): Record<string, string> {
    const descriptions: Record<string, string> = {
      "Instruction": `0x${fields.instruction.toString(16).padStart(8, "0")} (Binary: ${fields.instruction.toString(2).padStart(32, '0')})`,
      "Format": fields.format,
    };

    switch (fields.format) {
      case "R":
        descriptions["Opcode [31:21]"] = `0x${fields.opcode.toString(16)} (${fields.opcode})`;
        descriptions["Rm (rs2) [20:16]"] = `X${fields.rs2}`;
        descriptions["shamt [15:10]"] = `${fields.shamt}`;
        descriptions["Rn (rs1) [9:5]"] = `X${fields.rs1}`;
        descriptions["Rd [4:0]"] = `X${fields.rd}`;
        break;
      case "I":
        descriptions["Opcode [31:22]"] = `0x${fields.opcode.toString(16)} (${fields.opcode})`;
        descriptions["Immediate [21:10]"] = `${fields.immediate}`;
        descriptions["Rn (rs1) [9:5]"] = `X${fields.rs1}`;
        descriptions["Rd [4:0]"] = `X${fields.rd}`;
        break;
      case "D":
        descriptions["Opcode [31:21]"] = `0x${fields.opcode.toString(16)} (${fields.opcode})`;
        descriptions["Immediate [20:12]"] = `${fields.immediate}`;
        descriptions["Rn (base) [9:5]"] = `X${fields.rs1}`;
        descriptions["Rt (data) [4:0]"] = `X${fields.rd}`;
        break;
      case "B":
        descriptions["Opcode [31:26]"] = `0x${fields.opcode.toString(16)} (${fields.opcode})`;
        descriptions["Branch Offset [25:0]"] = `${fields.immediate}`;
        break;
      case "CB":
        descriptions["Opcode [31:24]"] = `0x${fields.opcode.toString(16)} (${fields.opcode})`;
        descriptions["Branch Offset [23:5]"] = `${fields.immediate}`;
        descriptions["Rt (check) [4:0]"] = `X${fields.rd}`;
        break;
    }

    return descriptions;
  }
}