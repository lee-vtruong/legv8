"use client"

import { createContext, useReducer, type ReactNode, useCallback, useEffect, useRef, useContext } from "react"
import type { Instruction, CPUState, ControlSignals, SimulatorState, SimulatorAction } from "./types"

// Thêm import cho component architecture
import {
  DatapathManager,
  ProgramCounter,
  InstructionMemory,
  ControlUnit,
  RegisterFile,
  ALU,
  DataMemory,
} from "./datapath-components"
import { TestValidator } from "./test-validator"

// Helper function để lưu byte-level memory - Sửa để lưu đầy đủ các byte
function writeWordToMemory(memory: Record<number, number>, address: number, value: number): void {
  console.log(`DEBUG: Writing word ${value} (0x${value.toString(16)}) to address ${address}`)

  // Lưu 8 bytes theo Little Endian - FIX: Chỉ ghi 4 bytes cho một word 32-bit
  for (let i = 0; i < 4; i++) {
    const byte = (value >>> (i * 8)) & 0xff
    if (byte === 0) {
      delete memory[address + i] // Xóa byte 0 để tiết kiệm bộ nhớ
    } else {
      memory[address + i] = byte
    }
  }

  // Clear bytes 4-7 (upper 32 bits should be 0 for 32-bit values)
  for (let i = 4; i < 8; i++) {
    delete memory[address + i]
  }

  console.log(`DEBUG: Bytes written:`)
  for (let i = 0; i < 8; i++) {
    const byte = memory[address + i] || 0
    console.log(`  [${address + i}] = 0x${byte.toString(16).padStart(2, "0")}`)
  }
}

// --- Initial State ---
const initialState: SimulatorState = {
  program: [],
  registers: Array(32).fill(0),
  memory: {},
  cpuState: {
    pc: 0,
    flags: { N: false, Z: false, C: false, V: false },
    currentInstruction: undefined,
    aluResult: undefined,
    lastRegisterAccess: undefined,
    lastMemoryAccess: undefined,
  },
  controlSignals: {
    Reg2Loc: false,
    UncondBranch: false,
    ZeroBranch: false,
    MemRead: false,
    MemToReg: false,
    MemWrite: false,
    FlagWrite: false, // Sẽ được loại bỏ nếu không cần ADDS/SUBS
    ALUSrc: false,
    RegWrite: false,
    PCSrc: false,
    FlagBranch: false, // Sẽ được loại bỏ nếu không cần B.cond
  },
  isRunning: false,
  isPaused: false,
  isExecuting: false,
  isStepAnimating: false,
  showAnimations: true,
  executionSpeed: 3, // THÊM: Default speed (1=slow, 5=fast)
  currentMicroStep: -1,
  currentInstruction: 0,
  executionLog: [],
  activeComponents: [],
  activePaths: [],
  // isAnimating: false,
  activeSignals: [],
  isFocusMode: false,
  isDebugMode: false,
  pipelineState: [],
  breakpoints: [],
  stepHistory: [],
  currentHistoryIndex: -1,
  maxHistorySize: 50,
  componentStates: {},
  instructionAssembly: "Idle", // Thêm dòng này

  // Thêm component architecture state
  datapathManager: null as DatapathManager | null,
  testValidator: new TestValidator(),
}

// --- Reducer Function ---
function simulatorReducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
  switch (action.type) {
    case "LOAD_PROGRAM":
      if (!Array.isArray(action.payload) || action.payload.some((instr) => !instr.type || !instr.assembly)) {
        return {
          ...state,
          executionLog: [
            ...state.executionLog,
            { message: "ERROR: Invalid program format", type: "error", timestamp: Date.now() },
          ],
        }
      }
      return {
        ...initialState,
        isFocusMode: state.isFocusMode,
        executionSpeed: state.executionSpeed, // THÊM: Preserve speed
        program: action.payload,
        executionLog: [
          {
            message: `Program loaded (${action.payload.length} instructions). Ready to run.`,
            type: "info",
            timestamp: Date.now(),
          },
        ],
      }
    case "TOGGLE_RUNNING":
      if (!state.isRunning && (state.program.length === 0 || state.currentInstruction >= state.program.length)) {
        return state
      }
      return {
        ...state,
        isRunning: !state.isRunning,
        isPaused: false,
        executionLog: [
          ...state.executionLog,
          {
            message: !state.isRunning ? "Execution started" : "Execution stopped",
            type: "info",
            timestamp: Date.now(),
          },
        ],
      }
    case "TOGGLE_PAUSED":
      if (!state.isRunning) {
        return state
      }
      return {
        ...state,
        isPaused: !state.isPaused,
        executionLog: [
          ...state.executionLog,
          {
            message: !state.isPaused ? "Execution paused" : "Execution resumed",
            type: "info",
            timestamp: Date.now(),
          },
        ],
      }
    case "SET_EXECUTING":
      return { ...state, isExecuting: action.payload }

    case "SET_STEP_ANIMATING":
      return { ...state, isStepAnimating: action.payload }

    case "TOGGLE_ANIMATIONS":
      return { ...state, showAnimations: !state.showAnimations }

    case "SET_EXECUTION_SPEED": // THÊM
      return {
        ...state,
        executionSpeed: Math.max(1, Math.min(5, action.payload)),
        executionLog: [
          ...state.executionLog,
          {
            message: `Execution speed set to ${action.payload}x`,
            type: "info",
            timestamp: Date.now(),
          },
        ],
      }

    case "RESET":
      return {
        ...initialState,
        isFocusMode: state.isFocusMode,
        executionSpeed: state.executionSpeed, // THÊM: Preserve speed
        program: state.program,
        executionLog: [
          {
            message: "Simulator state reset (registers, memory, PC). Program kept.",
            type: "info",
            timestamp: Date.now(),
          },
        ],
      }
    case "ADD_LOG_ENTRY": {
      const MAX_LOG_ENTRIES = 100
      const newEntry = {
        message: action.payload.message,
        type: action.payload.type || "info",
        timestamp: Date.now(),
        instructionIndex: action.payload.instructionIndex,
      }
      const newLog = [...state.executionLog, newEntry].slice(-MAX_LOG_ENTRIES)
      return { ...state, executionLog: newLog }
    }
    case "TOGGLE_DEBUG_MODE":
      return { ...state, isDebugMode: !state.isDebugMode }
    case "SET_ACTIVE_COMPONENTS":
      return { ...state, activeComponents: action.payload }
    case "SET_ACTIVE_PATHS":
      return { ...state, activePaths: action.payload }
    case "SET_ACTIVE_SIGNALS":
      return { ...state, activeSignals: action.payload }
    case "UPDATE_CPU_STATE":
      return { ...state, cpuState: { ...state.cpuState, ...action.payload } }
    case "UPDATE_CONTROL_SIGNALS":
      return { ...state, controlSignals: { ...state.controlSignals, ...action.payload } }
    case "UPDATE_REGISTERS":
      return { ...state, registers: action.payload }
    case "UPDATE_MEMORY":
      console.log("DEBUG: Updating memory in reducer:", action.payload)
      return { ...state, memory: action.payload }
    case "SET_CURRENT_MICRO_STEP":
      if (state.currentMicroStep === action.payload) return state
      return { ...state, currentMicroStep: action.payload }
    case "SET_CURRENT_INSTRUCTION":
      if (state.currentInstruction === action.payload) return state
      return { ...state, currentInstruction: action.payload }
    case "TOGGLE_FOCUS_MODE":
      return { ...state, isFocusMode: !state.isFocusMode }
    case "UPDATE_PIPELINE_STATE":
      return { ...state, pipelineState: action.payload }
    case "BATCH_UPDATE": {
      return { ...state, ...action.payload }
    }
    case "TOGGLE_BREAKPOINT": {
      const lineNumber = action.payload
      const breakpoints = [...state.breakpoints]
      const index = breakpoints.indexOf(lineNumber)

      if (index !== -1) {
        breakpoints.splice(index, 1)
      } else {
        breakpoints.push(lineNumber)
      }

      return { ...state, breakpoints }
    }
    case "SAVE_STEP_TO_HISTORY": {
      const newHistory = [...state.stepHistory]

      if (state.currentHistoryIndex < newHistory.length - 1) {
        newHistory.splice(state.currentHistoryIndex + 1)
      }

      newHistory.push(action.payload)

      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift()
      }

      return {
        ...state,
        stepHistory: newHistory,
        currentHistoryIndex: newHistory.length - 1,
      }
    }

    case "UNDO_INSTRUCTION": {
      // Tìm instructionIndex của lệnh trước đó
      console.log("stepHistory in reducer:", state.stepHistory)
      const prevInstrIndex = state.currentInstruction - 1;
      if (prevInstrIndex < 0) return state;

      // Tìm bước đầu tiên (microStep = 0) của lệnh trước đó
      const targetState = state.stepHistory.find(
        (step) => step.instructionIndex === prevInstrIndex && step.microStep === 0
      );
      if (!targetState) return state;

      const targetHistoryIndex = state.stepHistory.findIndex(
        (step) => step.stepId === targetState.stepId
      );

      return {
        ...state,
        currentHistoryIndex: targetHistoryIndex,
        cpuState: targetState.cpuState,
        registers: targetState.registers,
        memory: targetState.memory,
        controlSignals: targetState.controlSignals,
        currentMicroStep: targetState.microStep,
        currentInstruction: targetState.instructionIndex,
        activeComponents: targetState.activeComponents,
        activePaths: targetState.activePaths,
        activeSignals: targetState.activeSignals,
        executionLog: [
          ...state.executionLog,
          {
            message: `Reverted to the start of instruction ${targetState.instructionIndex + 1}.`,
            type: "info",
            timestamp: Date.now(),
          },
        ],
      };
    }

    case "UNDO_STEP": {
      if (state.currentHistoryIndex > 0) {
        const previousStep = state.stepHistory[state.currentHistoryIndex - 1]
        return {
          ...state,
          currentHistoryIndex: state.currentHistoryIndex - 1,
          cpuState: previousStep.cpuState,
          registers: previousStep.registers,
          memory: previousStep.memory,
          controlSignals: previousStep.controlSignals,
          currentMicroStep: previousStep.microStep,
          currentInstruction: previousStep.instructionIndex,
          activeComponents: previousStep.activeComponents,
          activePaths: previousStep.activePaths,
          activeSignals: previousStep.activeSignals,
        }
      }
      return state
    }

    case "REDO_STEP": {
      if (state.currentHistoryIndex < state.stepHistory.length - 1) {
        const nextStep = state.stepHistory[state.currentHistoryIndex + 1]
        const nextInstructionIndex = nextStep.instructionIndex
        return {
          ...state,
          currentHistoryIndex: state.currentHistoryIndex + 1,
          cpuState: nextStep.cpuState,
          registers: nextStep.registers,
          memory: nextStep.memory,
          controlSignals: nextStep.controlSignals,
          currentMicroStep: nextStep.microStep,
          currentInstruction: nextInstructionIndex,
          activeComponents: nextStep.activeComponents,
          activePaths: nextStep.activePaths,
          activeSignals: nextStep.activeSignals,
        }
      }
      return state
    }

    case "UPDATE_COMPONENT_STATE": {
      return {
        ...state,
        componentStates: {
          ...state.componentStates,
          [action.payload.id]: {
            ...state.componentStates[action.payload.id],
            ...action.payload.state,
          },
        },
      }
    }

    case "CLEAR_HISTORY": {
      return {
        ...state,
        stepHistory: [],
        currentHistoryIndex: -1,
      }
    }

    case "INITIALIZE_COMPONENTS": {
      const manager = new DatapathManager()

      // Create and add components
      const pc = new ProgramCounter()
      const im = new InstructionMemory()
      const cu = new ControlUnit()
      const rf = new RegisterFile()
      const alu = new ALU()
      const dm = new DataMemory()

      manager.addComponent(pc)
      manager.addComponent(im)
      manager.addComponent(cu)
      manager.addComponent(rf)
      manager.addComponent(alu)
      manager.addComponent(dm)

      // Set processing order for sequential execution
      manager.setProcessingOrder(["pc", "instruction-memory", "control-unit", "registers", "alu", "data-memory"])

      return {
        ...state,
        datapathManager: manager,
        executionLog: [
          ...state.executionLog,
          { message: "Component architecture initialized", type: "info", timestamp: Date.now() },
        ],
      }
    }

    case "UPDATE_COMPONENT_STATES": {
      return {
        ...state,
        componentStates: { ...state.componentStates, ...action.payload },
      }
    }

    case "RUN_TESTS": {
      // Run validation tests
      const validator = state.testValidator
      validator.clear()

      // Test STUR bug fix
      validator.addMemoryTest("STUR X1 to memory[8]", state.memory, 8, 100)
      validator.addMemoryTest("STUR X2 to memory[16]", state.memory, 16, 200)

      // Test register values
      validator.addRegisterTest("X4 after LDUR", state.registers, 4, 100)
      validator.addRegisterTest("X5 after LDUR", state.registers, 5, 200)

      validator.logResults()

      return {
        ...state,
        executionLog: [
          ...state.executionLog,
          {
            message: `Tests completed: ${validator.getPassedCount()}/${validator.getTotalCount()} passed`,
            type: validator.getPassedCount() === validator.getTotalCount() ? "info" : "warning",
            timestamp: Date.now(),
          },
        ],
      }
    }

    default:
      console.warn("Unhandled action type in reducer:", (action as any).type)
      return state
  }
}

type ComponentState = {}
interface StepHistory {
  stepId: string
  timestamp: number
  microStep: number
  instructionIndex: number
  cpuState: CPUState
  registers: number[]
  memory: Record<number, number>
  controlSignals: ControlSignals
  activeComponents: string[]
  activePaths: string[]
  activeSignals: string[]
  description: string
}

// --- Context Definition ---
interface SimulatorContextType {
  state: SimulatorState
  loadProgram: (program: Instruction[]) => void
  toggleRunning: () => void
  togglePaused: () => void
  toggleAnimations: () => void
  setExecutionSpeed: (speed: number) => void // THÊM
  reset: () => void
  setStepAnimating: (isAnimating: boolean) => void
  executeNextMicroStep: () => void
  executeNextInstruction: () => Promise<void>
  startContinuousExecution: () => void
  addLogEntry: (message: string, type?: "info" | "warning" | "error", instructionIndex?: number) => void
  toggleFocusMode: () => void
  toggleDebugMode: () => void
  toggleBreakpoint: (lineNumber: number) => void
  saveStepToHistory: (description: string) => void
  undoStep: () => void
  redoStep: () => void
  updateComponentState: (id: string, componentState: Partial<ComponentState>) => void
  undoInstruction: () => void
  canUndo: boolean
  canRedo: boolean
  runTests: () => void
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined)

// --- Provider Component ---
interface SimulatorProviderProps {
  children: ReactNode
}

// --- Helper Functions ---
function determineControlSignals(instruction: Instruction): ControlSignals {
  const signals: ControlSignals = {
    Reg2Loc: false,
    UncondBranch: false,
    FlagBranch: false,
    ZeroBranch: false,
    MemRead: false,
    MemToReg: false,
    MemWrite: false,
    FlagWrite: false, // QUYẾT ĐỊNH: Tạm thời giữ lại, có thể loại bỏ sau
    ALUSrc: false,
    RegWrite: false,
    PCSrc: false,
  }

  if (!instruction.type) {
    return signals
  }

  switch (instruction.type) {
    case "ADD":
    case "SUB":
    case "AND":
    case "ORR":
      signals.RegWrite = true
      // THAY ĐỔI: Không set FlagWrite cho các lệnh thông thường
      // Chỉ set nếu có ADDS, SUBS trong tương lai
      signals.FlagWrite = false
      break
    case "ADDI":
    case "SUBI":
      signals.ALUSrc = true
      signals.RegWrite = true
      // THAY ĐỔI: Không set FlagWrite cho các lệnh thông thường
      signals.FlagWrite = false
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
    case "B":
      signals.UncondBranch = true
      break
    case "CBZ":
      signals.ZeroBranch = true
      break
    case "CBNZ":
      signals.ZeroBranch = true // CBNZ cũng sử dụng ZeroBranch, chỉ khác logic
      break
  }
  return signals
}

function simulateALUOperation(
  instruction: Instruction,
  registers: number[],
): { result: number; flags: { N: boolean; Z: boolean; C: boolean; V: boolean } } {
  const getRegVal = (regIndex?: number): number => {
    if (regIndex === undefined || regIndex < 0 || regIndex > 31) return 0
    return regIndex === 31 ? 0 : registers[regIndex] || 0
  }

  const rs1Val = getRegVal(instruction.rs1)
  const rs2Val = getRegVal(instruction.rs2)
  const immVal = instruction.immediate ?? 0
  let result = 0
  const flags = { N: false, Z: false, C: false, V: false }

  switch (instruction.type) {
    case "ADD": {
      result = rs1Val + rs2Val
      // THAY ĐỔI: Vẫn tính flags nhưng không set vào CPU state (do FlagWrite = false)
      flags.C = (rs1Val >>> 0) + (rs2Val >>> 0) > 0xffffffff
      flags.V = ((rs1Val ^ result) & (rs2Val ^ result) & 0x80000000) !== 0
      break
    }
    case "SUB": {
      result = rs1Val - rs2Val
      flags.C = rs1Val >= rs2Val
      flags.V = ((rs1Val ^ rs2Val) & (rs1Val ^ result) & 0x80000000) !== 0
      break
    }
    case "AND":
      result = rs1Val & rs2Val
      break
    case "ORR":
      result = rs1Val | rs2Val
      break
    case "ADDI": {
      result = rs1Val + immVal
      flags.C = (rs1Val >>> 0) + (immVal >>> 0) > 0xffffffff
      flags.V = ((rs1Val ^ result) & (immVal ^ result) & 0x80000000) !== 0
      break
    }
    case "SUBI": {
      result = rs1Val - immVal
      flags.C = rs1Val >= immVal
      flags.V = ((rs1Val ^ immVal) & (rs1Val ^ result) & 0x80000000) !== 0
      break
    }
    case "LDUR":
    case "STUR":
      result = rs1Val + immVal
      break
    case "CBZ":
    case "CBNZ":
      result = rs1Val
      break
    case "B":
      result = 0
      break
    default:
      console.warn("[simulateALUOperation] Unexpected instruction type:", instruction.type)
      break
  }

  flags.N = result < 0
  flags.Z = result === 0
  return { result, flags }
}

function getActiveComponentsForMicroStep(microStep: number, instruction: Instruction): string[] {
  const baseComponents = []

  switch (microStep) {
    case 0: // Fetch
      baseComponents.push("pc", "instruction-memory", "pc-adder-4")
      break
    case 1: // Decode
      baseComponents.push("instruction-memory", "control-unit", "registers", "sign-extend")
      if (instruction.type === "STUR") {
        baseComponents.push("reg2loc-mux")
      }
      break
    case 2: // Execute
      baseComponents.push("registers", "alu", "alu-control")
      if (["ADDI", "SUBI", "LDUR", "STUR"].includes(instruction.type)) {
        baseComponents.push("alusrc-mux", "sign-extend")
      } else {
        baseComponents.push("alusrc-mux")
      }
      // Only activate flags when needed
      if (["CBZ", "CBNZ"].includes(instruction.type)) {
        baseComponents.push("flags")
      }
      break
    case 3: // Memory
      if (instruction.type === "LDUR" || instruction.type === "STUR") {
        baseComponents.push("alu", "data-memory")
        if (instruction.type === "STUR") {
          baseComponents.push("registers")
        }
      }
      break
    case 4: // Write Back
      if (["ADD", "SUB", "ADDI", "SUBI", "LDUR", "AND", "ORR"].includes(instruction.type)) {
        baseComponents.push("registers", "memtoreg-mux")
        if (instruction.type === "LDUR") {
          baseComponents.push("data-memory")
        } else {
          baseComponents.push("alu")
        }
      }
      break
    case 5: // Update PC
      baseComponents.push("pc", "pc-mux", "pc-adder-4")
      if (instruction.type === "B") {
        baseComponents.push("jump-or-gate")
      } else if (["CBZ", "CBNZ"].includes(instruction.type)) {
        baseComponents.push("registers", "branch-logic-unit", "jump-or-gate", "flags")
      }
      if (["B", "CBZ", "CBNZ"].includes(instruction.type)) {
        baseComponents.push("sign-extend", "shift-left", "branch-adder")
      }
      break
  }

  return baseComponents
}

function getActivePathsForMicroStep(
  microStep: number,
  instruction: Instruction,
  controlSignals: ControlSignals,
  cpuState: CPUState,
): string[] {
  const paths: string[] = []

  switch (microStep) {
    case 0: // Fetch
      paths.push("path-pc-im", "path-pc-adder4", "path-adder4-mux-pcsrc-0")
      break
    case 1: // Decode
      paths.push(
        "path-im-control",
        "path-im-readreg1",
        "path-im-writereg",
        "path-im-signext",
        "path-im-aluIn"
      )

      // SỬA LỖI MUX 1: Kích hoạt CẢ HAI đường vào reg2loc-mux
      paths.push("path-im-mux-reg2loc-0", "path-im-mux-reg2loc-1")
      // Và kích hoạt đường ra của nó
      paths.push("path-mux-reg2loc-readreg2")
      break

    case 2: // Execute
      paths.push("path-readreg1-alu", "path-alucontrol-aluop")

      // SỬA LỖI MUX 2: Kích hoạt CẢ HAI đường vào alusrc-mux
      paths.push("path-readreg2-mux-alusrc-0", "path-signext-mux-alusrc-1")
      // Và kích hoạt đường ra của nó
      paths.push("path-mux-alusrc-alu")

      if (["CBZ", "CBNZ"].includes(instruction.type)) {
        paths.push("path-alu-flags")
      }
      break

    case 3: // Memory
      if (controlSignals.MemRead || controlSignals.MemWrite) {
        paths.push("path-alu-memaddr")
      }
      if (controlSignals.MemWrite) {
        paths.push("path-readreg2-memwrite")
      }
      console.log(`Active paths for MicroStep 3: ${JSON.stringify(paths)}`)
      break
      
    case 4: // Write Back
      if (controlSignals.RegWrite) {
        // SỬA LỖI MUX 3: Kích hoạt CẢ HAI đường vào memtoreg-mux
        paths.push("path-memread-mux-memtoreg-1", "path-alu-mux-memtoreg-0")
        // Và kích hoạt đường ra của nó
        paths.push("path-mux-memtoreg-writedata")
      }
      break

    case 5: // Update PC
      // SỬA LỖI MUX 4: Kích hoạt CẢ HAI đường vào pc-mux
      paths.push("path-adder4-mux-pcsrc-0", "path-branchadder-mux-pcsrc-1")
      // Và kích hoạt đường ra của nó
      paths.push("path-mux-pcsrc-pc")

      // Kích hoạt các đường dẫn cần thiết để tính toán địa chỉ nhánh
      if (controlSignals.UncondBranch || controlSignals.ZeroBranch) {
        paths.push(
          "path-pc-branchadder",
          "path-signext-shift",
          "path-shift-branchadder",
        )
      }
      // Kích hoạt các đường logic nhánh nếu cần
      if (controlSignals.UncondBranch) {
        paths.push("path-uncondBranch-or")
      }
      if (controlSignals.ZeroBranch) {
        paths.push("path-flags-zeroflagin", "path-and-to-or")
      }
      if (controlSignals.PCSrc) {
        paths.push("path-or-to-mux")
      }
      break
  }

  // Dùng Set để loại bỏ các đường dẫn bị trùng lặp một cách an toàn
  return [...new Set(paths)]
}

function getActiveSignalsForMicroStep(
  microStep: number,
  instruction: Instruction,
  controlSignals: ControlSignals,
  cpuState: CPUState,
): string[] {
  const signals: string[] = []

  switch (microStep) {
    case 1: // Decode
      if (controlSignals.Reg2Loc) {
        signals.push("reg2loc")
      }
      break
    case 2: // Execute
      if (controlSignals.ALUSrc) {
        signals.push("alusrc")
      }
      signals.push("aluop")
      // THAY ĐỔI: Chỉ kích hoạt flagwrite khi thực sự cần
      if (controlSignals.FlagWrite) {
        signals.push("flagwrite")
      }
      break
    case 3: // Memory
      if (controlSignals.MemRead) {
        signals.push("memread")
      }
      if (controlSignals.MemWrite) {
        signals.push("memwrite")
      }
      break
    case 4: // Write Back
      if (controlSignals.RegWrite) {
        signals.push("regwrite")
      }
      if (controlSignals.MemToReg) {
        signals.push("memtoreg")
      }
      break
    case 5: // Update PC
      if (controlSignals.UncondBranch) {
        signals.push("uncondbranch")
      }
      if (controlSignals.ZeroBranch) {
        signals.push("zerobranch")
      }
      // Remove FlagBranch logic for CBNZ
      if (controlSignals.PCSrc) {
        signals.push("pcsrc")
      }
      break
  }

  return [...new Set(signals)]
}

export function SimulatorProvider({ children }: SimulatorProviderProps) {
  const [state, dispatch] = useReducer(simulatorReducer, initialState)
  const stateRef = useRef(state)

  // Initialize components on mount
  useEffect(() => {
    dispatch({ type: "INITIALIZE_COMPONENTS" })
  }, [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // --- Basic Actions ---
  const addLogEntry = useCallback(
    (message: string, type: "info" | "warning" | "error" = "info", instructionIndex?: number) => {
      dispatch({ type: "ADD_LOG_ENTRY", payload: { message, type, instructionIndex } })
    },
    [],
  )

  const undoInstruction = useCallback(() => {
    dispatch({ type: "UNDO_INSTRUCTION" });
  }, []);

  const loadProgram = useCallback((program: Instruction[]) => {
    dispatch({ type: "LOAD_PROGRAM", payload: program })
  }, [])

  const togglePaused = useCallback(() => {
    dispatch({ type: "TOGGLE_PAUSED" })
  }, [])

  const toggleAnimations = useCallback(() => {
    dispatch({ type: "TOGGLE_ANIMATIONS" })
  }, [])

  const setExecutionSpeed = useCallback((speed: number) => {
    // THÊM
    dispatch({ type: "SET_EXECUTION_SPEED", payload: speed })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
  }, [])

  const toggleFocusMode = useCallback(() => {
    dispatch({ type: "TOGGLE_FOCUS_MODE" })
  }, [])

  const toggleDebugMode = useCallback(() => {
    dispatch({ type: "TOGGLE_DEBUG_MODE" })
  }, [])

  const toggleBreakpoint = useCallback((lineNumber: number) => {
    dispatch({ type: "TOGGLE_BREAKPOINT", payload: lineNumber })
  }, [])

  const saveStepToHistory = useCallback(
    (description: string) => {
      const stepData: StepHistory = {
        stepId: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        microStep: state.currentMicroStep,
        instructionIndex: state.currentInstruction,
        cpuState: { ...state.cpuState },
        registers: [...state.registers],
        memory: { ...state.memory },
        controlSignals: { ...state.controlSignals },
        activeComponents: [...state.activeComponents],
        activePaths: [...state.activePaths],
        activeSignals: [...state.activeSignals],
        description,
      }
      dispatch({ type: "SAVE_STEP_TO_HISTORY", payload: stepData })
    },
    [state],
  )

  const toggleRunning = useCallback(() => {
    dispatch({ type: "TOGGLE_RUNNING" })
  }, [])

  const undoStep = useCallback(() => {
    dispatch({ type: "UNDO_STEP" })
  }, [])

  const redoStep = useCallback(() => {
    dispatch({ type: "REDO_STEP" })
  }, [])

  const updateComponentState = useCallback((id: string, componentState: Partial<ComponentState>) => {
    dispatch({ type: "UPDATE_COMPONENT_STATE", payload: { id, state: componentState } })
  }, [])

  const setStepAnimating = useCallback((isAnimating: boolean) => {
    dispatch({ type: "SET_STEP_ANIMATING", payload: isAnimating })
  }, [])

  // Thêm function để run tests
  const runTests = useCallback(() => {
    dispatch({ type: "RUN_TESTS" })
  }, [])

  // Enhanced executeNextMicroStep với component architecture
  const executeNextMicroStep = useCallback(() => {
    const currentState = stateRef.current
    const { program, currentInstruction, currentMicroStep, datapathManager } = currentState

    if (currentInstruction >= program.length) {
      if (currentState.isRunning) dispatch({ type: "TOGGLE_RUNNING" })
      addLogEntry("Program execution completed", "info")
      return
    }

    const instruction = program[currentInstruction]
    if (!instruction) {
      addLogEntry("Invalid instruction at current position", "error")
      return
    }

    // FIXED: Đảm bảo micro-step bắt đầu từ 0 và theo đúng thứ tự
    let nextMicroStep: number
    if (currentMicroStep < 0) {
      nextMicroStep = 0 // Bắt đầu từ Fetch
    } else {
      nextMicroStep = (currentMicroStep + 1) % 6
    }

    const isFinishingInstruction = nextMicroStep === 0 && currentMicroStep === 5
    let nextInstructionIndex = isFinishingInstruction ? currentInstruction + 1 : currentInstruction

    if (isFinishingInstruction && nextMicroStep === 0) {
      // Nếu vừa kết thúc 1 lệnh, cập nhật theo PC mới
      nextInstructionIndex = Math.floor(currentState.cpuState.pc / 4)
    }

    // Use component architecture if available
    if (datapathManager) {
      const componentResults = datapathManager.processStep(nextMicroStep)

      // Update component states
      const componentStates: Record<string, any> = {}
      componentResults.forEach((result) => {
        componentStates[result.id] = result
      })

      dispatch({ type: "UPDATE_COMPONENT_STATES", payload: componentStates })

      // Extract data from components for backward compatibility
      const pc = datapathManager.getComponent("pc") as ProgramCounter
      const rf = datapathManager.getComponent("registers") as RegisterFile
      const dm = datapathManager.getComponent("data-memory") as DataMemory

      if (pc && rf && dm) {
        const newCpuState = {
          ...currentState.cpuState,
          pc: pc.getCurrentPC(),
        }

        dispatch({
          type: "BATCH_UPDATE",
          payload: {
            currentMicroStep: nextMicroStep,
            currentInstruction: nextInstructionIndex,
            cpuState: newCpuState,
            registers: rf.getRegisters(),
            memory: dm.getMemory(),
          },
        })
      }
    } else {
      // FIXED: Improved micro-step logic
      const { registers, memory, cpuState } = currentState
      const newCpuState = { ...cpuState }
      const newRegisters = [...registers]
      const newMemory = { ...memory }

      // Generate control signals at the beginning of Decode phase
      const newControlSignals =
        nextMicroStep === 1 ? determineControlSignals(instruction) : { ...currentState.controlSignals }

      // Execute logic for each micro step
      switch (nextMicroStep) {
        case 0: // Fetch
          newCpuState.currentInstruction = instruction.assembly
          addLogEntry(`Fetching: ${instruction.assembly}`, "info", currentInstruction)
          break

        case 1: // Decode
          addLogEntry(`Decoding: ${instruction.type}`, "info", currentInstruction)
          break

        case 2: // Execute
          const aluResult = simulateALUOperation(instruction, newRegisters)
          newCpuState.aluResult = aluResult.result

          // Update flags only when needed
          if (newControlSignals.FlagWrite || ["CBZ", "CBNZ"].includes(instruction.type)) {
            newCpuState.flags = aluResult.flags
          }

          addLogEntry(`Execute: ALU result = ${aluResult.result}`, "info", currentInstruction)
          break

        case 3: // Memory
          if (instruction.type === "LDUR") {
            const address = newCpuState.aluResult || 0
            const value = newMemory[address] || 0
            newCpuState.lastMemoryAccess = { address, value, type: "read" }
            addLogEntry(`Memory read: [${address}] = ${value}`, "info", currentInstruction)
          } else if (instruction.type === "STUR") {
            const address = newCpuState.aluResult || 0
            const value = newRegisters[instruction.rd || 31] || 0
            console.log(`DEBUG: STUR writing value ${value} to address ${address}`)

            // Sử dụng helper function để ghi byte-level
            writeWordToMemory(newMemory, address, value)

            newCpuState.lastMemoryAccess = { address, value, type: "write" }
            addLogEntry(`Memory write: [${address}] = ${value}`, "info", currentInstruction)
          }
          break

        case 4: // Write Back
          if (["ADD", "SUB", "ADDI", "SUBI", "AND", "ORR"].includes(instruction.type)) {
            const rd = instruction.rd
            if (rd !== undefined && rd !== 31) {
              newRegisters[rd] = newCpuState.aluResult || 0
              newCpuState.lastRegisterAccess = { register: `X${rd}`, value: newCpuState.aluResult || 0, type: "write" }
              addLogEntry(`Write back: X${rd} = ${newCpuState.aluResult}`, "info", currentInstruction)
            }
          } else if (instruction.type === "LDUR") {
            const rd = instruction.rd
            if (rd !== undefined && rd !== 31) {
              const value = newCpuState.lastMemoryAccess?.value || 0
              newRegisters[rd] = value
              newCpuState.lastRegisterAccess = { register: `X${rd}`, value, type: "write" }
              addLogEntry(`Write back: X${rd} = ${value}`, "info", currentInstruction)
            }
          }
          break

        case 5: // Update PC
          let shouldBranch = false
          let newPC = newCpuState.pc || 0

          if (instruction.type === "B") {
            shouldBranch = true
            newPC = (newCpuState.pc || 0) + 4 + (instruction.immediate || 0);
          } else if (instruction.type === "CBZ") {
            const rs1Val = newRegisters[instruction.rs1 || 31] || 0
            shouldBranch = rs1Val === 0
            if (shouldBranch) {
              newPC = (newCpuState.pc || 0) + 4 + (instruction.immediate || 0);
            } else {
              newPC = (newCpuState.pc || 0) + 4
            }
            addLogEntry(`CBZ: X${instruction.rs1} = ${rs1Val}, branch = ${shouldBranch}`, "info", currentInstruction)
          } else if (instruction.type === "CBNZ") {
            const rs1Val = newRegisters[instruction.rs1 || 31] || 0
            shouldBranch = rs1Val !== 0
            if (shouldBranch) {
              newPC = (newCpuState.pc || 0) + 4 + (instruction.immediate || 0);
            } else {
              newPC = (newCpuState.pc || 0) + 4
            }
            addLogEntry(`CBNZ: X${instruction.rs1} = ${rs1Val}, branch = ${shouldBranch}`, "info", currentInstruction)
          } else {
            shouldBranch = false
            newPC = (newCpuState.pc || 0) + 4
          }

          newControlSignals.PCSrc = shouldBranch
          newCpuState.pc = newPC
          addLogEntry(`PC updated: PC = 0x${newPC.toString(16)}`, "info", currentInstruction)
          break
      }


      const activeComponents = getActiveComponentsForMicroStep(nextMicroStep, instruction)
      const activePaths = getActivePathsForMicroStep(nextMicroStep, instruction, newControlSignals, newCpuState)
      const activeSignals = getActiveSignalsForMicroStep(nextMicroStep, instruction, newControlSignals, newCpuState)
      const hasAnimation = activePaths.length > 0 || activeSignals.length > 0

      if (!hasAnimation) {
        dispatch({ type: "SET_STEP_ANIMATING", payload: false })
      }

      dispatch({
        type: "BATCH_UPDATE",
        payload: {
          currentMicroStep: nextMicroStep,
          currentInstruction: nextInstructionIndex,
          cpuState: newCpuState,
          registers: newRegisters,
          memory: newMemory,
          activeComponents,
          activePaths,
          activeSignals,
          controlSignals: newControlSignals,
          isStepAnimating: currentState.showAnimations && hasAnimation,
          instructionAssembly: instruction.assembly, // THÊM dòng này
        },
      })
      saveStepToHistory(`MicroStep ${nextMicroStep} of instruction ${currentInstruction + 1}`)
    }
  }, [addLogEntry])

  // Continuous execution với speed control
  useEffect(() => {
    const {
      isRunning,
      isPaused,
      isStepAnimating,
      isExecuting,
      program,
      currentInstruction,
      breakpoints,
      executionSpeed,
    } = stateRef.current

    if (isRunning && !isPaused && !isExecuting && !isStepAnimating && currentInstruction < program.length) {
      if (stateRef.current.currentMicroStep === 0 && breakpoints.includes(currentInstruction)) {
        addLogEntry(`Breakpoint hit at instruction ${currentInstruction + 1}.`, "warning")
        dispatch({ type: "TOGGLE_RUNNING" })
        return
      }

      // THÊM: Tính toán delay dựa trên executionSpeed
      const baseDelay = 1500 // Increase base delay more
      const delays = [2000, 1500, 1000, 600, 300] // Explicit delays for each speed
      const delay = delays[executionSpeed - 1] || 1000

      const timer = setTimeout(() => {
        executeNextMicroStep()
      }, delay)

      return () => clearTimeout(timer)
    }
  }, [
    state.isRunning,
    state.isPaused,
    state.isStepAnimating,
    state.isExecuting,
    state.currentInstruction,
    state.currentMicroStep,
    state.executionSpeed, // THÊM dependency
    executeNextMicroStep,
    addLogEntry,
  ])

  const startContinuousExecution = useCallback(() => {
    const { isRunning, currentInstruction, program } = stateRef.current

    if (isRunning) {
      dispatch({ type: "TOGGLE_RUNNING" })
    } else if (currentInstruction < program.length) {
      dispatch({ type: "TOGGLE_RUNNING" })
    } else {
      addLogEntry("No more instructions to execute", "info")
    }
  }, [addLogEntry])

  const executeNextInstruction = useCallback(async () => {
    const currentState = stateRef.current
    if (
      currentState.isRunning ||
      currentState.isExecuting ||
      currentState.currentInstruction >= currentState.program.length
    ) {
      return
    }

    dispatch({ type: "SET_EXECUTING", payload: true })

    let stepsToRun = 6 - ((currentState.currentMicroStep + 1) % 6)
    if (stepsToRun === 0) stepsToRun = 6

    for (let i = 0; i < stepsToRun; i++) {
      if (stateRef.current.program.length === 0) break

      executeNextMicroStep()

      if (stateRef.current.showAnimations) {
        // THÊM: Sử dụng executionSpeed cho animation delay
        console.log(`MicroStep ${stateRef.current.currentMicroStep}: Waiting for animation, isStepAnimating = ${stateRef.current.isStepAnimating}, activePaths = ${JSON.stringify(stateRef.current.activePaths)}`)
        const baseAnimationDelay = 2500 // Increase base delay more
        const animationDelays = [3300, 1300, 500, 100, 50] // Explicit delays
        const animationDelay = animationDelays[stateRef.current.executionSpeed - 1] || 2000

        if (stateRef.current.currentMicroStep != 2) {
          await new Promise((resolve) => setTimeout(resolve, animationDelay))
        }

        await new Promise<void>((resolve) => {
          const checkAnimation = setInterval(() => {
            console.log(`Checking animation for MicroStep ${stateRef.current.currentMicroStep}: isStepAnimating = ${stateRef.current.isStepAnimating}`)
            if (!stateRef.current.isStepAnimating) {
              clearInterval(checkAnimation)
              resolve()
            }
          }, 50)
        })
      }
    }

    dispatch({ type: "SET_EXECUTING", payload: false })
  }, [executeNextMicroStep])

  useEffect(() => {
    return () => { }
  }, [])

  const contextValue: SimulatorContextType = {
    state,
    loadProgram,
    toggleRunning,
    togglePaused,
    toggleAnimations,
    setExecutionSpeed, // THÊM
    reset,
    executeNextMicroStep,
    executeNextInstruction,
    startContinuousExecution,
    addLogEntry,
    toggleFocusMode,
    toggleDebugMode,
    toggleBreakpoint,
    saveStepToHistory,
    undoStep,
    undoInstruction,
    redoStep,
    updateComponentState,
    setStepAnimating,
    canUndo: state.currentHistoryIndex > 0,
    canRedo: state.currentHistoryIndex < state.stepHistory.length - 1,
    runTests,
  }

  return <SimulatorContext.Provider value={contextValue}>{children}</SimulatorContext.Provider>
}

export function useSimulator(): SimulatorContextType {
  const context = useContext(SimulatorContext)
  if (context === undefined) {
    throw new Error("useSimulator must be used within a SimulatorProvider")
  }
  return context
}
