// lib/datapath/enhanced-simulator-engine.ts - Enhanced Simulator Engine
import type { Instruction, ControlSignals } from "../types"
import { ComponentID, BusID } from "./component-ids"
import { MicroStepTracker, type StepInfo, type MicroStep } from "./micro-step"
import { SimulatorException } from "../exceptions/simulator-exceptions"
import { MemoryStorage } from "../storage/memory-storage"
import { RegisterStorage } from "../storage/register-storage"
import { executeInstruction } from "../simulator"

export class EnhancedSimulatorEngine {
  private microStepTracker = new MicroStepTracker()
  private registers = new RegisterStorage()
  private memory = new MemoryStorage()
  private pc = 0
  private flags = { N: false, Z: false, C: false, V: false }

  constructor() {
    this.reset()
  }

  reset(): void {
    this.microStepTracker.clear()
    this.registers.clear()
    this.memory.clear()
    this.pc = 0
    this.flags = { N: false, Z: false, C: false, V: false }
  }

  executeInstructionWithMicroSteps(instruction: Instruction, instructionIndex: number): MicroStep[] {
    const microSteps: MicroStep[] = []

    try {
      // Micro Step 0: Fetch
      microSteps.push(this.microStepFetch(instruction, instructionIndex))

      // Micro Step 1: Decode
      microSteps.push(this.microStepDecode(instruction, instructionIndex))

      // Micro Step 2: Execute
      microSteps.push(this.microStepExecute(instruction, instructionIndex))

      // Micro Step 3: Memory (if needed)
      if (this.needsMemoryAccess(instruction)) {
        microSteps.push(this.microStepMemory(instruction, instructionIndex))
      }

      // Micro Step 4: Write Back (if needed)
      if (this.needsWriteBack(instruction)) {
        microSteps.push(this.microStepWriteBack(instruction, instructionIndex))
      }

      // Micro Step 5: Update PC
      microSteps.push(this.microStepUpdatePC(instruction, instructionIndex))
    } catch (error) {
      throw new SimulatorException(
        `Error executing instruction: ${instruction.assembly}`,
        error instanceof Error ? error : undefined,
        this.pc,
        instructionIndex,
      )
    }

    return microSteps
  }

  private microStepFetch(instruction: Instruction, instructionIndex: number): MicroStep {
    const stepInfos: StepInfo[] = []

    // PC to Instruction Memory
    stepInfos.push({
      description: "Program Counter provides address to Instruction Memory",
      startComponent: ComponentID.PROGRAM_COUNTER,
      endComponent: ComponentID.INSTRUCTION_MEMORY,
      bus: BusID.ProgramCounter_InstructionMemory,
      value: `0x${this.pc.toString(16)}`,
      timestamp: Date.now(),
    })

    // PC to PC+4 Adder
    stepInfos.push({
      description: "Program Counter provides address to PC+4 Adder",
      startComponent: ComponentID.PROGRAM_COUNTER,
      endComponent: ComponentID.PC_ADDER4,
      bus: BusID.ProgramCounter_PCAdder4,
      value: `0x${this.pc.toString(16)}`,
      timestamp: Date.now(),
    })

    return this.microStepTracker.createStep(
      0,
      instructionIndex,
      "Fetch: Read instruction from memory",
      stepInfos,
      this.getCurrentState(),
      {},
      [ComponentID.PROGRAM_COUNTER, ComponentID.INSTRUCTION_MEMORY, ComponentID.PC_ADDER4],
      [BusID.ProgramCounter_InstructionMemory, BusID.ProgramCounter_PCAdder4],
    )
  }

  private microStepDecode(instruction: Instruction, instructionIndex: number): MicroStep {
    const stepInfos: StepInfo[] = []
    const controlSignals = this.determineControlSignals(instruction)

    // Instruction Memory to Splitter
    stepInfos.push({
      description: "Instruction Memory outputs instruction to Splitter",
      startComponent: ComponentID.INSTRUCTION_MEMORY,
      endComponent: ComponentID.SPLITTER,
      bus: BusID.InstructionMemory_Splitter,
      value: instruction.assembly,
      timestamp: Date.now(),
    })

    // Splitter to Control Unit
    stepInfos.push({
      description: "Splitter sends opcode to Control Unit",
      startComponent: ComponentID.SPLITTER,
      endComponent: ComponentID.CONTROL_UNIT,
      bus: BusID.Splitter_ControlUnit,
      value: `Opcode: ${instruction.type}`,
      timestamp: Date.now(),
    })

    // Control Unit generates signals
    this.addControlSignalSteps(stepInfos, controlSignals)

    return this.microStepTracker.createStep(
      1,
      instructionIndex,
      "Decode: Generate control signals and extract instruction fields",
      stepInfos,
      this.getCurrentState(),
      controlSignals,
      [ComponentID.INSTRUCTION_MEMORY, ComponentID.SPLITTER, ComponentID.CONTROL_UNIT],
      [BusID.InstructionMemory_Splitter, BusID.Splitter_ControlUnit],
    )
  }

  private microStepExecute(instruction: Instruction, instructionIndex: number): MicroStep {
    const stepInfos: StepInfo[] = []
    const controlSignals = this.determineControlSignals(instruction)

    // Register File reads
    if (instruction.rs1 !== undefined) {
      const rs1Value = this.registers.getValue(instruction.rs1)
      stepInfos.push({
        description: `Register File reads X${instruction.rs1}`,
        startComponent: ComponentID.REGISTERS_FILE,
        endComponent: ComponentID.ALU,
        bus: BusID.RegFile_Alu,
        value: `X${instruction.rs1} = 0x${rs1Value.toString(16)}`,
        timestamp: Date.now(),
      })
    }

    // ALU operation
    const result = executeInstruction(instruction, this.registers.getRegisters(), this.memory.getMemoryMap(), this.pc)

    if (result.result !== undefined) {
      stepInfos.push({
        description: `ALU performs ${instruction.type} operation`,
        startComponent: ComponentID.ALU,
        endComponent: ComponentID.DATA_MEMORY,
        bus: BusID.Alu_DataMemory,
        value: `Result: 0x${result.result.toString(16)}`,
        timestamp: Date.now(),
      })
    }

    return this.microStepTracker.createStep(
      2,
      instructionIndex,
      "Execute: Perform ALU operation",
      stepInfos,
      this.getCurrentState(),
      controlSignals,
      [ComponentID.REGISTERS_FILE, ComponentID.ALU],
      [BusID.RegFile_Alu, BusID.Alu_DataMemory],
    )
  }

  private microStepMemory(instruction: Instruction, instructionIndex: number): MicroStep {
    const stepInfos: StepInfo[] = []

    if (instruction.type === "LDUR") {
      stepInfos.push({
        description: "Data Memory performs load operation",
        startComponent: ComponentID.DATA_MEMORY,
        endComponent: ComponentID.MUX_WB_REGFILE,
        bus: BusID.DataMemory_MuxWbRegFile_1,
        value: "Memory read data",
        timestamp: Date.now(),
      })
    } else if (instruction.type === "STUR") {
      stepInfos.push({
        description: "Data Memory performs store operation",
        startComponent: ComponentID.REGISTERS_FILE,
        endComponent: ComponentID.DATA_MEMORY,
        bus: BusID.RegFile_DataMemory,
        value: "Store data to memory",
        timestamp: Date.now(),
      })
    }

    return this.microStepTracker.createStep(
      3,
      instructionIndex,
      "Memory: Access data memory if needed",
      stepInfos,
      this.getCurrentState(),
      {},
      [ComponentID.DATA_MEMORY],
      [BusID.DataMemory_MuxWbRegFile_1, BusID.RegFile_DataMemory],
    )
  }

  private microStepWriteBack(instruction: Instruction, instructionIndex: number): MicroStep {
    const stepInfos: StepInfo[] = []

    if (instruction.rd !== undefined && instruction.rd !== 31) {
      stepInfos.push({
        description: `Write result back to X${instruction.rd}`,
        startComponent: ComponentID.MUX_WB_REGFILE,
        endComponent: ComponentID.REGISTERS_FILE,
        bus: BusID.MuxWbRegFile_RegFile,
        value: `Write to X${instruction.rd}`,
        timestamp: Date.now(),
      })
    }

    return this.microStepTracker.createStep(
      4,
      instructionIndex,
      "Write Back: Write result to register file",
      stepInfos,
      this.getCurrentState(),
      {},
      [ComponentID.MUX_WB_REGFILE, ComponentID.REGISTERS_FILE],
      [BusID.MuxWbRegFile_RegFile],
    )
  }

  private microStepUpdatePC(instruction: Instruction, instructionIndex: number): MicroStep {
    const stepInfos: StepInfo[] = []

    // PC+4 Adder
    stepInfos.push({
      description: "PC+4 Adder calculates next sequential address",
      startComponent: ComponentID.PC_ADDER4,
      endComponent: ComponentID.MUX_PCSrc,
      bus: BusID.PCAdder4_MuxPCSrc_0,
      value: `0x${(this.pc + 4).toString(16)}`,
      timestamp: Date.now(),
    })

    // Update PC
    const newPC = this.pc + 4 // Simplified - handle branches later
    stepInfos.push({
      description: "Update Program Counter",
      startComponent: ComponentID.MUX_PCSrc,
      endComponent: ComponentID.PROGRAM_COUNTER,
      bus: BusID.MuxPCSrc_ProgramCounter,
      value: `0x${newPC.toString(16)}`,
      timestamp: Date.now(),
    })

    this.pc = newPC

    return this.microStepTracker.createStep(
      5,
      instructionIndex,
      "Update PC: Calculate and set next program counter",
      stepInfos,
      this.getCurrentState(),
      {},
      [ComponentID.PC_ADDER4, ComponentID.MUX_PCSrc, ComponentID.PROGRAM_COUNTER],
      [BusID.PCAdder4_MuxPCSrc_0, BusID.MuxPCSrc_ProgramCounter],
    )
  }

  private addControlSignalSteps(stepInfos: StepInfo[], controlSignals: ControlSignals): void {
    if (controlSignals.RegWrite) {
      stepInfos.push({
        description: "Control Unit asserts RegWrite signal",
        startComponent: ComponentID.CONTROL_UNIT,
        endComponent: ComponentID.REGISTERS_FILE,
        bus: BusID.ControlUnit_RegFile_Signal_RegWrite,
        value: "RegWrite = 1",
        timestamp: Date.now(),
      })
    }

    if (controlSignals.ALUSrc) {
      stepInfos.push({
        description: "Control Unit asserts ALUSrc signal",
        startComponent: ComponentID.CONTROL_UNIT,
        endComponent: ComponentID.MUX_ALUSrc,
        bus: BusID.ControlUnit_MuxAlu_Signal_AluSrc,
        value: "ALUSrc = 1",
        timestamp: Date.now(),
      })
    }

    // Add more control signals as needed...
  }

  private determineControlSignals(instruction: Instruction): ControlSignals {
    // Reuse existing logic from context.tsx
    const signals: ControlSignals = {
      Reg2Loc: false,
      UncondBranch: false,
      FlagBranch: false,
      ZeroBranch: false,
      MemRead: false,
      MemToReg: false,
      MemWrite: false,
      FlagWrite: false,
      ALUSrc: false,
      RegWrite: false,
      PCSrc: false,
    }

    switch (instruction.type) {
      case "ADD":
      case "SUB":
      case "AND":
      case "ORR":
        signals.RegWrite = true
        break
      case "ADDI":
      case "SUBI":
        signals.ALUSrc = true
        signals.RegWrite = true
        break
      case "LDUR":
        signals.ALUSrc = true
        signals.MemRead = true
        signals.MemToReg = true
        signals.RegWrite = true
        break
      case "STUR":
        signals.Reg2Loc = true
        signals.ALUSrc = true
        signals.MemWrite = true
        break
      // Add more cases...
    }

    return signals
  }

  private needsMemoryAccess(instruction: Instruction): boolean {
    return ["LDUR", "STUR"].includes(instruction.type)
  }

  private needsWriteBack(instruction: Instruction): boolean {
    return ["ADD", "SUB", "ADDI", "SUBI", "LDUR", "AND", "ORR"].includes(instruction.type)
  }

  private getCurrentState() {
    return {
      pc: this.pc,
      registers: this.registers.getRegisters(),
      memory: this.memory.getMemoryMap(),
      flags: { ...this.flags },
    }
  }

  // Public interface
  getMicroSteps(): MicroStep[] {
    return this.microStepTracker.getSteps()
  }

  getLastMicroStep(): MicroStep | undefined {
    return this.microStepTracker.getLastStep()
  }

  clearMicroSteps(): void {
    this.microStepTracker.clear()
  }
}
