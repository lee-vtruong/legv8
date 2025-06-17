// lib/datapath-components.ts - Component-Based Architecture
export interface ComponentInput {
  name: string
  value: number | boolean | string
  source?: string
}

export interface ComponentOutput {
  name: string
  value: number | boolean | string
  destination?: string[]
}

export interface ComponentState {
  id: string
  name: string
  inputs: Record<string, ComponentInput>
  outputs: Record<string, ComponentOutput>
  internalState: Record<string, any>
  isActive: boolean
  lastProcessTime: number
}

export abstract class DatapathComponent {
  protected state: ComponentState
  protected connections: Map<string, string[]> = new Map()

  constructor(id: string, name: string) {
    this.state = {
      id,
      name,
      inputs: {},
      outputs: {},
      internalState: {},
      isActive: false,
      lastProcessTime: 0,
    }
  }

  // Abstract methods that each component must implement
  abstract process(): void
  abstract reset(): void

  // Common methods
  setInput(name: string, value: number | boolean | string, source?: string): void {
    this.state.inputs[name] = { name, value, source }
  }

  getOutput(name: string): ComponentOutput | undefined {
    return this.state.outputs[name]
  }

  getState(): ComponentState {
    return { ...this.state }
  }

  setActive(active: boolean): void {
    this.state.isActive = active
  }

  protected setOutput(name: string, value: number | boolean | string, destinations?: string[]): void {
    this.state.outputs[name] = { name, value, destination: destinations }
  }

  addConnection(outputName: string, destinations: string[]): void {
    this.connections.set(outputName, destinations)
  }
}

// Program Counter Component
export class ProgramCounter extends DatapathComponent {
  constructor() {
    super("pc", "Program Counter")
    this.state.internalState.pc = 0
  }

  process(): void {
    const pcInput = this.state.inputs["pc_in"]
    if (pcInput) {
      this.state.internalState.pc = pcInput.value as number
    }

    this.setOutput("pc_out", this.state.internalState.pc, ["instruction-memory", "pc-adder"])
    this.state.lastProcessTime = Date.now()
  }

  reset(): void {
    this.state.internalState.pc = 0
    this.state.inputs = {}
    this.state.outputs = {}
  }

  getCurrentPC(): number {
    return this.state.internalState.pc as number
  }
}

// Instruction Memory Component
export class InstructionMemory extends DatapathComponent {
  private instructions: number[] = []

  constructor() {
    super("instruction-memory", "Instruction Memory")
  }

  loadInstructions(instructions: number[]): void {
    this.instructions = [...instructions]
  }

  process(): void {
    const addressInput = this.state.inputs["address"]
    if (addressInput) {
      const address = addressInput.value as number
      const instructionIndex = Math.floor(address / 4)
      const instruction = this.instructions[instructionIndex] || 0

      // Parse instruction fields (simplified)
      const opcode = (instruction >> 21) & 0x7ff
      const rd = (instruction >> 0) & 0x1f
      const rs1 = (instruction >> 5) & 0x1f
      const rs2 = (instruction >> 16) & 0x1f
      const immediate = (instruction >> 10) & 0xfff

      this.setOutput("instruction", instruction, ["control-unit"])
      this.setOutput("opcode", opcode, ["control-unit"])
      this.setOutput("rd", rd, ["registers"])
      this.setOutput("rs1", rs1, ["registers"])
      this.setOutput("rs2", rs2, ["registers"])
      this.setOutput("immediate", immediate, ["sign-extend"])
    }

    this.state.lastProcessTime = Date.now()
  }

  reset(): void {
    this.state.inputs = {}
    this.state.outputs = {}
  }
}

// Control Unit Component
export class ControlUnit extends DatapathComponent {
  constructor() {
    super("control-unit", "Control Unit")
  }

  process(): void {
    const opcodeInput = this.state.inputs["opcode"]
    if (opcodeInput) {
      const opcode = opcodeInput.value as number
      const signals = this.decodeInstruction(opcode)

      Object.entries(signals).forEach(([signal, value]) => {
        this.setOutput(signal, value, this.getSignalDestinations(signal))
      })
    }

    this.state.lastProcessTime = Date.now()
  }

  private decodeInstruction(opcode: number): Record<string, boolean> {
    // Simplified opcode decoding - in real implementation, this would be more complex
    const signals = {
      RegWrite: false,
      ALUSrc: false,
      MemRead: false,
      MemWrite: false,
      MemToReg: false,
      Reg2Loc: false,
      UncondBranch: false,
      ZeroBranch: false,
      FlagBranch: false,
      PCSrc: false,
    }

    // This is a simplified mapping - real implementation would decode actual opcodes
    switch (opcode) {
      case 0x458: // ADD (example opcode)
        signals.RegWrite = true
        break
      case 0x658: // SUB (example opcode)
        signals.RegWrite = true
        break
      // Add more opcode mappings as needed
    }

    return signals
  }

  private getSignalDestinations(signal: string): string[] {
    const destinations: Record<string, string[]> = {
      RegWrite: ["registers"],
      ALUSrc: ["alu-mux"],
      MemRead: ["data-memory"],
      MemWrite: ["data-memory"],
      MemToReg: ["writeback-mux"],
      Reg2Loc: ["reg2loc-mux"],
      PCSrc: ["pc-mux"],
    }
    return destinations[signal] || []
  }

  reset(): void {
    this.state.inputs = {}
    this.state.outputs = {}
  }
}

// Register File Component
export class RegisterFile extends DatapathComponent {
  private registers: number[] = Array(32).fill(0)

  constructor() {
    super("registers", "Register File")
  }

  process(): void {
    const readReg1 = this.state.inputs["read_reg1"]?.value as number
    const readReg2 = this.state.inputs["read_reg2"]?.value as number
    const writeReg = this.state.inputs["write_reg"]?.value as number
    const writeData = this.state.inputs["write_data"]?.value as number
    const regWrite = this.state.inputs["RegWrite"]?.value as boolean

    // Read operations
    if (readReg1 !== undefined) {
      const value = readReg1 === 31 ? 0 : this.registers[readReg1] || 0
      this.setOutput("read_data1", value, ["alu"])
    }

    if (readReg2 !== undefined) {
      const value = readReg2 === 31 ? 0 : this.registers[readReg2] || 0
      this.setOutput("read_data2", value, ["alu-mux", "data-memory"])
    }

    // Write operation
    if (regWrite && writeReg !== undefined && writeData !== undefined && writeReg !== 31) {
      this.registers[writeReg] = writeData
      this.state.internalState.lastWrite = { reg: writeReg, value: writeData }
    }

    this.state.lastProcessTime = Date.now()
  }

  getRegisters(): number[] {
    return [...this.registers]
  }

  reset(): void {
    this.registers = Array(32).fill(0)
    this.state.inputs = {}
    this.state.outputs = {}
    this.state.internalState = {}
  }
}

// ALU Component
export class ALU extends DatapathComponent {
  constructor() {
    super("alu", "Arithmetic Logic Unit")
  }

  process(): void {
    const inputA = this.state.inputs["input_a"]?.value as number
    const inputB = this.state.inputs["input_b"]?.value as number
    const aluOp = this.state.inputs["alu_op"]?.value as string

    if (inputA !== undefined && inputB !== undefined && aluOp) {
      const result = this.performOperation(inputA, inputB, aluOp)
      const flags = this.calculateFlags(result, inputA, inputB, aluOp)

      this.setOutput("result", result, ["data-memory", "writeback-mux"])
      this.setOutput("zero", flags.zero, ["branch-logic"])
      this.setOutput("negative", flags.negative, ["flags"])
      this.setOutput("carry", flags.carry, ["flags"])
      this.setOutput("overflow", flags.overflow, ["flags"])

      this.state.internalState.lastResult = result
      this.state.internalState.lastFlags = flags
    }

    this.state.lastProcessTime = Date.now()
  }

  private performOperation(a: number, b: number, op: string): number {
    switch (op) {
      case "ADD":
        return a + b
      case "SUB":
        return a - b
      case "AND":
        return a & b
      case "ORR":
        return a | b
      default:
        return 0
    }
  }

  private calculateFlags(result: number, a: number, b: number, op: string) {
    return {
      zero: result === 0,
      negative: result < 0,
      carry: this.calculateCarry(a, b, op),
      overflow: this.calculateOverflow(a, b, result, op),
    }
  }

  private calculateCarry(a: number, b: number, op: string): boolean {
    if (op === "ADD") {
      return (a >>> 0) + (b >>> 0) > 0xffffffff
    } else if (op === "SUB") {
      return a >= b
    }
    return false
  }

  private calculateOverflow(a: number, b: number, result: number, op: string): boolean {
    if (op === "ADD") {
      return ((a ^ result) & (b ^ result) & 0x80000000) !== 0
    } else if (op === "SUB") {
      return ((a ^ b) & (a ^ result) & 0x80000000) !== 0
    }
    return false
  }

  reset(): void {
    this.state.inputs = {}
    this.state.outputs = {}
    this.state.internalState = {}
  }
}

// Data Memory Component
export class DataMemory extends DatapathComponent {
  private memory: Record<number, number> = {}

  constructor() {
    super("data-memory", "Data Memory")
  }

  process(): void {
    const address = this.state.inputs["address"]?.value as number
    const writeData = this.state.inputs["write_data"]?.value as number
    const memRead = this.state.inputs["MemRead"]?.value as boolean
    const memWrite = this.state.inputs["MemWrite"]?.value as boolean

    if (address !== undefined) {
      if (memWrite && writeData !== undefined) {
        this.memory[address] = writeData
        this.state.internalState.lastWrite = { address, value: writeData }
      }

      if (memRead) {
        const value = this.memory[address] || 0
        this.setOutput("read_data", value, ["writeback-mux"])
        this.state.internalState.lastRead = { address, value }
      }
    }

    this.state.lastProcessTime = Date.now()
  }

  getMemory(): Record<number, number> {
    return { ...this.memory }
  }

  reset(): void {
    this.memory = {}
    this.state.inputs = {}
    this.state.outputs = {}
    this.state.internalState = {}
  }
}

// Datapath Manager - Orchestrates all components
export class DatapathManager {
  private components: Map<string, DatapathComponent> = new Map()
  private processingOrder: string[] = []

  addComponent(component: DatapathComponent): void {
    this.components.set(component.getState().id, component)
  }

  setProcessingOrder(order: string[]): void {
    this.processingOrder = order
  }

  processStep(microStep: number): ComponentState[] {
    const activeComponents = this.getActiveComponentsForStep(microStep)
    const results: ComponentState[] = []

    // Process components in order
    for (const componentId of this.processingOrder) {
      if (activeComponents.includes(componentId)) {
        const component = this.components.get(componentId)
        if (component) {
          component.setActive(true)
          component.process()
          results.push(component.getState())
        }
      }
    }

    // Propagate outputs to inputs for next step
    this.propagateSignals()

    return results
  }

  private getActiveComponentsForStep(microStep: number): string[] {
    // Define which components are active for each micro step
    const stepComponents: Record<number, string[]> = {
      0: ["pc", "instruction-memory"], // Fetch
      1: ["instruction-memory", "control-unit", "registers"], // Decode
      2: ["registers", "alu"], // Execute
      3: ["data-memory"], // Memory
      4: ["registers"], // Write Back
      5: ["pc"], // Update PC
    }
    return stepComponents[microStep] || []
  }

  private propagateSignals(): void {
    // This would implement the actual signal propagation between components
    // For now, it's a placeholder
  }

  reset(): void {
    this.components.forEach((component) => component.reset())
  }

  getComponent(id: string): DatapathComponent | undefined {
    return this.components.get(id)
  }

  getAllComponents(): DatapathComponent[] {
    return Array.from(this.components.values())
  }
}
