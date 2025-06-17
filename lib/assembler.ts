// lib/assembler.ts
import type { Instruction, InstructionType } from "./types" // Ensure Instruction is imported

export function assembleProgram(code: string): Instruction[] {
  const instructions: Instruction[] = []
  const originalLines = code.split("\n") // Get all original lines

  for (let i = 0; i < originalLines.length; i++) {
    const lineNumber = i + 1 // 1-based line number
    const lineContent = originalLines[i].split("//")[0].trim() // Get content, remove comments

    if (lineContent.length > 0) {
      // Process only non-empty, non-comment lines
      try {
        // Pass the line content AND the original line number to the parser
        const instruction = parseLine(lineContent, lineNumber)
        instructions.push(instruction)
      } catch (error) {
        // Report error with the correct original line number
        throw new Error(`Error on line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  return instructions
}

// Modify parseLine to accept lineNumber and pass it down
function parseLine(line: string, sourceLineNumber: number): Instruction {
  const parts = line.split(/\s+/)
  const operation = parts[0].toUpperCase()

  if (operation === "LDUR" || operation === "STUR") {
    // Pass sourceLineNumber to D-format parser
    return parseDFormatLine(line, sourceLineNumber)
  }

  const operandsStr = parts.slice(1).join(" ")
  const operands = operandsStr.split(",").map((op) => op.trim())

  switch (operation) {
    case "ADD":
    case "SUB":
    case "AND":
    case "ORR":
      // Pass sourceLineNumber to R-format parser
      return parseRFormat(operation as InstructionType, operands, sourceLineNumber)

    case "ADDI":
    case "SUBI":
      // Pass sourceLineNumber to I-format parser
      return parseIFormat(operation as InstructionType, operands, sourceLineNumber)

    case "B":
      // Pass sourceLineNumber to B-format parser
      return parseBFormat(operands, sourceLineNumber)

    case "CBZ":
    case "CBNZ":
      // Pass sourceLineNumber to CB-format parser
      return parseCBFormat(operation as InstructionType, operands, sourceLineNumber)

    default:
      throw new Error(`Unsupported operation: ${operation}`)
  }
}

// Example for parseDFormatLine:
function parseDFormatLine(line: string, sourceLineNumber: number): Instruction {
  // ... (existing parsing logic for operation, rd, addressPart, rs1, immediate) ...
  const operation = line.split(/\s+/)[0].toUpperCase() as InstructionType
  const bracketPos = line.indexOf("[")
  if (bracketPos === -1) throw new Error(`Invalid memory address format in ${operation}`)
  const rdPart = line.substring(operation.length, bracketPos).trim()
  const rd = parseRegister(rdPart.split(",")[0].trim())
  const addressPart = line.substring(bracketPos).trim()
  const closeBracketPos = addressPart.indexOf("]")
  if (closeBracketPos === -1) throw new Error(`Missing closing bracket: ${addressPart}`)
  const innerContent = addressPart.substring(1, closeBracketPos).trim()
  const innerParts = innerContent.split(",").map((p) => p.trim())
  if (innerParts.length !== 2) throw new Error(`Invalid memory address format: ${addressPart}`)
  const rs1 = parseRegister(innerParts[0])
  const immediate = parseImmediate(innerParts[1])

  return {
    type: operation,
    rd,
    rs1,
    immediate,
    // Reconstruct a consistent assembly string for display/debugging
    assembly: `${operation} X${rd}, [X${rs1}, #${immediate}]`,
    sourceLine: sourceLineNumber, // Store the original line number
  }
}

// Example for parseRFormat:
function parseRFormat(type: InstructionType, operands: string[], sourceLineNumber: number): Instruction {
  if (operands.length !== 3) throw new Error(`${type} instruction requires 3 operands`)
  const rd = parseRegister(operands[0])
  const rs1 = parseRegister(operands[1])
  const rs2 = parseRegister(operands[2])
  return {
    type,
    rd,
    rs1,
    rs2,
    assembly: `${type} X${rd}, X${rs1}, X${rs2}`,
    sourceLine: sourceLineNumber, // Store the original line number
  }
}

// Example for parseIFormat:
function parseIFormat(type: InstructionType, operands: string[], sourceLineNumber: number): Instruction {
  if (operands.length !== 3) throw new Error(`${type} instruction requires 3 operands`)
  const rd = parseRegister(operands[0])
  const rs1 = parseRegister(operands[1])
  const immediate = parseImmediate(operands[2])
  return {
    type,
    rd,
    rs1,
    immediate,
    assembly: `${type} X${rd}, X${rs1}, #${immediate}`,
    sourceLine: sourceLineNumber, // Store the original line number
  }
}

// Example for parseBFormat:
function parseBFormat(operands: string[], sourceLineNumber: number): Instruction {
  if (operands.length !== 1) throw new Error("B instruction requires 1 operand")
  // For simulation, treat operand as immediate offset *in instructions*
  const immediateLabelOrOffset = operands[0]
  // Basic immediate parsing for simulation (real assembler resolves labels)
  const offsetValue = parseImmediate(immediateLabelOrOffset)
  // Store the byte offset (instruction offset * 4)
  const immediate = offsetValue * 4

  return {
    type: "B",
    immediate,
    // Display the original label/offset for clarity
    assembly: `B ${immediateLabelOrOffset}`,
    sourceLine: sourceLineNumber, // Store the original line number
  }
}

// Example for parseCBFormat:
function parseCBFormat(type: InstructionType, operands: string[], sourceLineNumber: number): Instruction {
  if (operands.length !== 2) throw new Error(`${type} instruction requires 2 operands`)
  const rd = parseRegister(operands[0]) // Register to test (Rt)
  const immediateLabelOrOffset = operands[1]
  const offsetValue = parseImmediate(immediateLabelOrOffset)
  // Không nhân 4, vì offset là số lệnh
  const immediate = offsetValue

  return {
    type,
    rd, // Rt
    immediate,
    assembly: `${type} X${rd}, ${immediateLabelOrOffset}`,
    sourceLine: sourceLineNumber,
  }
}

// Helper functions parseRegister, parseImmediate
function parseRegister(reg: string): number {
  reg = reg.trim().toUpperCase()
  if (reg === "XZR") return 31
  const match = reg.match(/^X([0-9]+)$/)
  if (!match) throw new Error(`Invalid register: ${reg}`)
  const regNum = Number.parseInt(match[1], 10)
  if (regNum < 0 || regNum > 31) throw new Error(`Register number out of range: ${regNum}`)
  return regNum
}

function parseImmediate(imm: string): number {
  imm = imm.trim()
  // Allow optional '#' and negative sign
  const match = imm.match(/^#?(-?[0-9]+)$/)
  if (!match) throw new Error(`Invalid immediate value: ${imm}`)
  return Number.parseInt(match[1], 10)
}
