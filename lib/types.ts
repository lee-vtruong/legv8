// file: lib/types.ts

// --- Instruction Type ---
// Thêm 'assembly' là thuộc tính bắt buộc.
export interface Instruction {
  type: string;
  assembly: string; // <-- Quan trọng: Thêm thuộc tính này
  rd?: number;
  rs1?: number;
  rs2?: number;
  immediate?: number;
  operands?: string;
  address?: number;
  label?: string;
}

// --- Sub-types for State ---

// Trạng thái của các thành phần chính trong CPU
export interface CPUState {
  pc: number;
  currentInstruction?: string; // Tên lệnh assembly
  aluResult?: number;
  flags: {
    N: boolean;
    Z: boolean;
    C: boolean;
    V: boolean;
  };
  lastRegisterAccess?: {
    register: string;
    value: number;
    type: "read" | "write";
  };
  lastMemoryAccess?: {
    address: number;
    value: number;
    type: "read" | "write";
  };
}

// Các tín hiệu điều khiển từ Control Unit
export interface ControlSignals {
  Reg2Loc: boolean;
  UncondBranch: boolean;
  FlagBranch: boolean;
  ZeroBranch: boolean;
  MemRead: boolean;
  MemToReg: boolean;
  MemWrite: boolean;
  FlagWrite: boolean;
  ALUSrc: boolean;
  RegWrite: boolean;
  PCSrc: boolean;
}

// Trạng thái của một bước trong lịch sử (dùng cho Undo/Redo)
export interface StepHistoryEntry {
  stepId: string;
  timestamp: number;
  microStep: number;
  instructionIndex: number;
  cpuState: CPUState;
  registers: number[];
  memory: Record<number, number>;
  controlSignals: ControlSignals;
  activeComponents: string[];
  activePaths: string[];
  activeSignals: string[];
  description: string;
}

// --- Main Simulator State Type ---
// Đây là định nghĩa đã được cập nhật hoàn chỉnh, khớp với initialState trong context.tsx
export interface SimulatorState {
  program: Instruction[];
  registers: number[];
  memory: Record<number, number>;
  cpuState: CPUState;
  controlSignals: ControlSignals;
  
  // Trạng thái thực thi
  isRunning: boolean;
  isPaused: boolean;
  isExecuting: boolean; // Đang chạy một lệnh đầy đủ
  isStepAnimating: boolean; // Đang chờ animation của một micro-step hoàn thành

  // Cài đặt
  showAnimations: boolean;
  executionSpeed: number; // 1 to 5

  // Trạng thái con trỏ thực thi
  currentMicroStep: number; // -1 (idle) hoặc 0-5
  currentInstruction: number; // Index của lệnh trong mảng program

  // Trạng thái giao diện và debug
  executionLog: Array<{ message: string; type: 'info' | 'warning' | 'error'; timestamp: number; instructionIndex?: number }>;
  activeComponents: string[];
  activePaths: string[];
  activeSignals: string[];
  isFocusMode: boolean;
  isDebugMode: boolean;
  
  // Các tính năng nâng cao
  pipelineState: any[]; // Giữ kiểu any nếu chưa dùng
  breakpoints: number[];
  stepHistory: StepHistoryEntry[];
  currentHistoryIndex: number;
  maxHistorySize: number;
  
  // Trạng thái của các component (nếu có)
  componentStates: Record<string, any>;
  instructionAssembly: string;

  // Tham chiếu đến các đối tượng quản lý
  datapathManager: import("./datapath-components").DatapathManager | null;
  testValidator: import("./test-validator").TestValidator;
}


// --- Action Types for Reducer ---
// Đây là một phần thưởng thêm để code của bạn chặt chẽ hơn.
// Bạn có thể thêm phần này vào cuối file types.ts
export type SimulatorAction =
  | { type: "LOAD_PROGRAM"; payload: Instruction[] }
  | { type: "TOGGLE_RUNNING" }
  | { type: "TOGGLE_PAUSED" }
  | { type: "SET_EXECUTING"; payload: boolean }
  | { type: "SET_STEP_ANIMATING"; payload: boolean }
  | { type: "TOGGLE_ANIMATIONS" }
  | { type: "SET_EXECUTION_SPEED"; payload: number }
  | { type: "RESET" }
  | { type: "ADD_LOG_ENTRY"; payload: { message: string; type?: "info" | "warning" | "error"; instructionIndex?: number } }
  | { type: "TOGGLE_DEBUG_MODE" }
  | { type: "SET_ACTIVE_COMPONENTS"; payload: string[] }
  | { type: "SET_ACTIVE_PATHS"; payload: string[] }
  | { type: "SET_ACTIVE_SIGNALS"; payload: string[] }
  | { type: "UPDATE_CPU_STATE"; payload: Partial<CPUState> }
  | { type: "UPDATE_CONTROL_SIGNALS"; payload: Partial<ControlSignals> }
  | { type: "UPDATE_REGISTERS"; payload: number[] }
  | { type: "UPDATE_MEMORY"; payload: Record<number, number> }
  | { type: "SET_CURRENT_MICRO_STEP"; payload: number }
  | { type: "SET_CURRENT_INSTRUCTION"; payload: number }
  | { type: "TOGGLE_FOCUS_MODE" }
  | { type: "UPDATE_PIPELINE_STATE"; payload: any[] }
  | { type: "BATCH_UPDATE"; payload: Partial<SimulatorState> }
  | { type: "TOGGLE_BREAKPOINT"; payload: number }
  | { type: "SAVE_STEP_TO_HISTORY"; payload: StepHistoryEntry }
  | { type: "UNDO_STEP" }
  | { type: "REDO_STEP" }
  | { type: "UPDATE_COMPONENT_STATE"; payload: { id: string; state: any } }
  | { type: "CLEAR_HISTORY" }
  | { type: "INITIALIZE_COMPONENTS" }
  | { type: "UPDATE_COMPONENT_STATES"; payload: Record<string, any> }
  | { type: "RUN_TESTS" }
  | { type: "UNDO_INSTRUCTION" };