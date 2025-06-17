// lib/datapath/datapath-connections.ts - Datapath Connection Manager
import { ComponentID, BusID } from "./component-ids"
import { InstructionSplitter } from "./instruction-splitter"
import type { Instruction } from "../types"

export interface DataFlow {
  sourceComponent: ComponentID
  targetComponent: ComponentID
  bus: BusID
  data: string | number
  description: string
  bitRange?: string
}

export class DatapathConnections {
  /**
   * Get all data flows for instruction fetch phase
   */
  static getFetchDataFlows(pc: number): DataFlow[] {
    return [
      {
        sourceComponent: ComponentID.PROGRAM_COUNTER,
        targetComponent: ComponentID.INSTRUCTION_MEMORY,
        bus: BusID.ProgramCounter_InstructionMemory,
        data: `0x${pc.toString(16)}`,
        description: "PC provides instruction address to Instruction Memory",
        bitRange: "[31:0]",
      },
      {
        sourceComponent: ComponentID.PROGRAM_COUNTER,
        targetComponent: ComponentID.PC_ADDER4,
        bus: BusID.ProgramCounter_PCAdder4,
        data: `0x${pc.toString(16)}`,
        description: "PC provides address to PC+4 Adder",
        bitRange: "[31:0]",
      },
    ]
  }

  /**
   * Get all data flows for instruction decode phase
   */
  static getDecodeDataFlows(instruction: Instruction): DataFlow[] {
    const fields = InstructionSplitter.parseInstruction(instruction)
    const flows: DataFlow[] = []

    // Instruction Memory to Splitter (full instruction)
    flows.push({
      sourceComponent: ComponentID.INSTRUCTION_MEMORY,
      targetComponent: ComponentID.SPLITTER,
      bus: BusID.InstructionMemory_Splitter,
      data: `0x${fields.instruction.toString(16).padStart(8, "0")}`,
      description: "Instruction Memory outputs 32-bit instruction to Splitter",
      bitRange: "[31:0]",
    })

    // Splitter to Control Unit (opcode)
    flows.push({
      sourceComponent: ComponentID.SPLITTER,
      targetComponent: ComponentID.CONTROL_UNIT,
      bus: BusID.Splitter_ControlUnit,
      data: `0x${fields.opcode.toString(16)} (${instruction.type})`,
      description: "Splitter sends opcode to Control Unit",
      bitRange: "[31:21]",
    })

    // Splitter to Register File (rs1)
    flows.push({
      sourceComponent: ComponentID.SPLITTER,
      targetComponent: ComponentID.REGISTERS_FILE,
      bus: BusID.Splitter_RegFile1,
      data: `X${fields.rs1}`,
      description: "Splitter sends Rs1 field to Register File (Read Register 1)",
      bitRange: "[9:5]",
    })

    // Splitter to MUX inputs (rs2 and rd)
    flows.push({
      sourceComponent: ComponentID.SPLITTER,
      targetComponent: ComponentID.MUX_REGFILESrc,
      bus: BusID.Splitter_MuxRegFile_0,
      data: `X${fields.rs2}`,
      description: "Splitter sends Rs2 field to MUX input 0",
      bitRange: "[20:16]",
    })

    flows.push({
      sourceComponent: ComponentID.SPLITTER,
      targetComponent: ComponentID.MUX_REGFILESrc,
      bus: BusID.Splitter_MuxRegFile_1,
      data: `X${fields.rd}`,
      description: "Splitter sends Rd field to MUX input 1",
      bitRange: "[4:0]",
    })

    // Splitter to Sign Extend (full instruction for immediate extraction)
    flows.push({
      sourceComponent: ComponentID.SPLITTER,
      targetComponent: ComponentID.EXTRACTOR,
      bus: BusID.Splitter_Extractor,
      data: `0x${fields.instruction.toString(16).padStart(8, "0")}`,
      description: "Splitter sends full instruction to Sign Extend for immediate extraction",
      bitRange: "[31:0]",
    })

    // Splitter to ALU Control (for function field)
    flows.push({
      sourceComponent: ComponentID.SPLITTER,
      targetComponent: ComponentID.ALU_CONTROL,
      bus: BusID.Splitter_AluControl,
      data: `${instruction.type}`,
      description: "Splitter sends instruction info to ALU Control",
      bitRange: "[31:21]",
    })

    return flows
  }

  /**
   * Get control signal flows
   */
  static getControlSignalFlows(controlSignals: Record<string, boolean>): DataFlow[] {
    const flows: DataFlow[] = []

    if (controlSignals.RegWrite) {
      flows.push({
        sourceComponent: ComponentID.CONTROL_UNIT,
        targetComponent: ComponentID.REGISTERS_FILE,
        bus: BusID.ControlUnit_RegFile_Signal_RegWrite,
        data: "1",
        description: "Control Unit asserts RegWrite signal",
        bitRange: "[0]",
      })
    }

    if (controlSignals.Reg2Loc) {
      flows.push({
        sourceComponent: ComponentID.CONTROL_UNIT,
        targetComponent: ComponentID.MUX_REGFILESrc,
        bus: BusID.ControlUnit_MuxRegFile_Signal_Reg2Loc,
        data: "1",
        description: "Control Unit asserts Reg2Loc signal (select Rd for Read Register 2)",
        bitRange: "[0]",
      })
    }

    if (controlSignals.ALUSrc) {
      flows.push({
        sourceComponent: ComponentID.CONTROL_UNIT,
        targetComponent: ComponentID.MUX_ALUSrc,
        bus: BusID.ControlUnit_MuxAlu_Signal_AluSrc,
        data: "1",
        description: "Control Unit asserts ALUSrc signal (select immediate for ALU input)",
        bitRange: "[0]",
      })
    }

    if (controlSignals.MemRead) {
      flows.push({
        sourceComponent: ComponentID.CONTROL_UNIT,
        targetComponent: ComponentID.DATA_MEMORY,
        bus: BusID.ControlUnit_DataMemory_Signal_MemRead,
        data: "1",
        description: "Control Unit asserts MemRead signal",
        bitRange: "[0]",
      })
    }

    if (controlSignals.MemWrite) {
      flows.push({
        sourceComponent: ComponentID.CONTROL_UNIT,
        targetComponent: ComponentID.DATA_MEMORY,
        bus: BusID.ControlUnit_DataMemory_Signal_MemWrite,
        data: "1",
        description: "Control Unit asserts MemWrite signal",
        bitRange: "[0]",
      })
    }

    if (controlSignals.MemToReg) {
      flows.push({
        sourceComponent: ComponentID.CONTROL_UNIT,
        targetComponent: ComponentID.MUX_WB_REGFILE,
        bus: BusID.ControlUnit_MuxWbRegFile_Signal_MemToReg,
        data: "1",
        description: "Control Unit asserts MemToReg signal (select memory data for register write)",
        bitRange: "[0]",
      })
    }

    return flows
  }

  /**
   * Get execute phase data flows
   */
  static getExecuteDataFlows(instruction: Instruction, registers: number[]): DataFlow[] {
    const flows: DataFlow[] = []
    const fields = InstructionSplitter.parseInstruction(instruction)

    // Register File to ALU (operand 1)
    if (fields.rs1 !== undefined) {
      const rs1Value = registers[fields.rs1] || 0
      flows.push({
        sourceComponent: ComponentID.REGISTERS_FILE,
        targetComponent: ComponentID.ALU,
        bus: BusID.RegFile_Alu,
        data: `0x${rs1Value.toString(16)}`,
        description: `Register File outputs X${fields.rs1} to ALU operand 1`,
        bitRange: "[63:0]",
      })
    }

    // Register File to ALU MUX (operand 2 option)
    if (fields.rs2 !== undefined) {
      const rs2Value = registers[fields.rs2] || 0
      flows.push({
        sourceComponent: ComponentID.REGISTERS_FILE,
        targetComponent: ComponentID.MUX_ALUSrc,
        bus: BusID.RegFile_MuxAlu_0,
        data: `0x${rs2Value.toString(16)}`,
        description: `Register File outputs X${fields.rs2} to ALU MUX input 0`,
        bitRange: "[63:0]",
      })
    }

    // Sign Extend to ALU MUX (immediate option)
    flows.push({
      sourceComponent: ComponentID.EXTRACTOR,
      targetComponent: ComponentID.MUX_ALUSrc,
      bus: BusID.Extractor_MuxAlu_1,
      data: `${fields.immediate}`,
      description: "Sign Extend outputs immediate value to ALU MUX input 1",
      bitRange: "[63:0]",
    })

    // ALU MUX to ALU
    flows.push({
      sourceComponent: ComponentID.MUX_ALUSrc,
      targetComponent: ComponentID.ALU,
      bus: BusID.MuxAlu_Alu,
      data: "Selected operand",
      description: "ALU MUX outputs selected operand to ALU operand 2",
      bitRange: "[63:0]",
    })

    return flows
  }

  /**
   * Get all active components for a specific micro-step
   */
  static getActiveComponents(microStep: number, instruction: Instruction): ComponentID[] {
    switch (microStep) {
      case 0: // Fetch
        return [ComponentID.PROGRAM_COUNTER, ComponentID.INSTRUCTION_MEMORY, ComponentID.PC_ADDER4]

      case 1: // Decode
        return [
          ComponentID.INSTRUCTION_MEMORY,
          ComponentID.SPLITTER,
          ComponentID.CONTROL_UNIT,
          ComponentID.REGISTERS_FILE,
          ComponentID.MUX_REGFILESrc,
          ComponentID.EXTRACTOR,
        ]

      case 2: // Execute
        return [ComponentID.REGISTERS_FILE, ComponentID.MUX_ALUSrc, ComponentID.ALU, ComponentID.ALU_CONTROL]

      case 3: // Memory
        if (["LDUR", "STUR"].includes(instruction.type)) {
          return [ComponentID.ALU, ComponentID.DATA_MEMORY]
        }
        return []

      case 4: // Write Back
        if (["ADD", "SUB", "ADDI", "SUBI", "LDUR", "AND", "ORR"].includes(instruction.type)) {
          return [ComponentID.MUX_WB_REGFILE, ComponentID.REGISTERS_FILE]
        }
        return []

      case 5: // Update PC
        return [ComponentID.PC_ADDER4, ComponentID.MUX_PCSrc, ComponentID.PROGRAM_COUNTER]

      default:
        return []
    }
  }
}
