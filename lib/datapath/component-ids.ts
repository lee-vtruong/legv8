// lib/datapath/component-ids.ts - Component và Bus ID definitions
export enum ComponentID {
  // Core Components
  PROGRAM_COUNTER = "PROGRAM_COUNTER",
  INSTRUCTION_MEMORY = "INSTRUCTION_MEMORY",
  CONTROL_UNIT = "CONTROL_UNIT",
  REGISTERS_FILE = "REGISTERS_FILE",
  ALU = "ALU",
  DATA_MEMORY = "DATA_MEMORY",

  // Datapath Components
  SPLITTER = "SPLITTER",
  EXTRACTOR = "EXTRACTOR",
  ALU_CONTROL = "ALU_CONTROL",

  // Multiplexers
  MUX_REGFILESrc = "MUX_REGFILESrc",
  MUX_ALUSrc = "MUX_ALUSrc",
  MUX_WB_REGFILE = "MUX_WB_REGFILE",
  MUX_PCSrc = "MUX_PCSrc",

  // Adders
  PC_ADDER4 = "PC_ADDER4",
  BR_ADDER = "BR_ADDER",

  // Branch Logic
  BR_OR = "BR_OR",
  BR_FLAG_AND = "BR_FLAG_AND",
  BR_ZERO_AND = "BR_ZERO_AND",

  // Flags
  N_FLAG = "N_FLAG",
  Z_FLAG = "Z_FLAG",
  C_FLAG = "C_FLAG",
  V_FLAG = "V_FLAG",

  // Shifters
  SHIFT_LEFT_2 = "SHIFT_LEFT_2",
}

export enum BusID {
  // PC Connections
  ProgramCounter_InstructionMemory = "ProgramCounter_InstructionMemory",
  ProgramCounter_PCAdder4 = "ProgramCounter_PCAdder4",
  ProgramCounter_BranchAdder = "ProgramCounter_BranchAdder",

  // Instruction Memory
  InstructionMemory_Splitter = "InstructionMemory_Splitter",

  // Splitter Outputs
  Splitter_ControlUnit = "Splitter_ControlUnit",
  Splitter_RegFile1 = "Splitter_RegFile1",
  Splitter_RegFile2 = "Splitter_RegFile2",
  Splitter_MuxRegFile_0 = "Splitter_MuxRegFile_0",
  Splitter_MuxRegFile_1 = "Splitter_MuxRegFile_1",
  Splitter_Extractor = "Splitter_Extractor",
  Splitter_AluControl = "Splitter_AluControl",

  // Control Unit Signals
  ControlUnit_MuxRegFile_Signal_Reg2Loc = "ControlUnit_MuxRegFile_Signal_Reg2Loc",
  ControlUnit_RegFile_Signal_RegWrite = "ControlUnit_RegFile_Signal_RegWrite",
  ControlUnit_MuxAlu_Signal_AluSrc = "ControlUnit_MuxAlu_Signal_AluSrc",
  ControlUnit_DataMemory_Signal_MemRead = "ControlUnit_DataMemory_Signal_MemRead",
  ControlUnit_DataMemory_Signal_MemWrite = "ControlUnit_DataMemory_Signal_MemWrite",
  ControlUnit_MuxWbRegFile_Signal_MemToReg = "ControlUnit_MuxWbRegFile_Signal_MemToReg",
  ControlUnit_BrOr_Signal_UncondBranch = "ControlUnit_BrOr_Signal_UncondBranch",
  ControlUnit_BrZeroAnd_Signal_ZeroBranch = "ControlUnit_BrZeroAnd_Signal_ZeroBranch",
  ControlUnit_BrFlagAnd_Signal_FlagBranch = "ControlUnit_BrFlagAnd_Signal_FlagBranch",
  ControlUnit_Flags_Signal_FlagWrite = "ControlUnit_Flags_Signal_FlagWrite",
  ControlUnit_AluControl_Signal_AluOp = "ControlUnit_AluControl_Signal_AluOp",

  // Register File
  RegFile_Alu = "RegFile_Alu",
  RegFile_MuxAlu_0 = "RegFile_MuxAlu_0",
  RegFile_DataMemory = "RegFile_DataMemory",
  MuxRegFile_RegFile = "MuxRegFile_RegFile",
  MuxWbRegFile_RegFile = "MuxWbRegFile_RegFile",

  // ALU Connections
  Extractor_MuxAlu_1 = "Extractor_MuxAlu_1",
  MuxAlu_Alu = "MuxAlu_Alu",
  AluControl_Alu_Signal = "AluControl_Alu_Signal",
  Alu_DataMemory = "Alu_DataMemory",
  Alu_MuxWbRegFile_0 = "Alu_MuxWbRegFile_0",
  Alu_BrZeroAnd = "Alu_BrZeroAnd",

  // ALU Flags
  Alu_NFlag = "Alu_NFlag",
  Alu_ZFlag = "Alu_ZFlag",
  Alu_CFlag = "Alu_CFlag",
  Alu_VFlag = "Alu_VFlag",

  // Data Memory
  DataMemory_MuxWbRegFile_1 = "DataMemory_MuxWbRegFile_1",

  // Branch Logic
  Extractor_ShiftLeft2 = "Extractor_ShiftLeft2",
  ShiftLeft2_BranchAdder = "ShiftLeft2_BranchAdder",
  BranchAdder_MuxPCSrc_1 = "BranchAdder_MuxPCSrc_1",
  PCAdder4_MuxPCSrc_0 = "PCAdder4_MuxPCSrc_0",
  BrOr_MuxPCSrc_Signal = "BrOr_MuxPCSrc_Signal",
  BrZeroAnd_BrOr = "BrZeroAnd_BrOr",
  BrFlagAnd_BrOr = "BrFlagAnd_BrOr",
  MuxPCSrc_ProgramCounter = "MuxPCSrc_ProgramCounter",

  // Flag Connections
  NFlag_BrFlagAnd = "NFlag_BrFlagAnd",
  ZFlag_BrFlagAnd = "ZFlag_BrFlagAnd",
  CFlag_BrFlagAnd = "CFlag_BrFlagAnd",
  VFlag_BrFlagAnd = "VFlag_BrFlagAnd",
}
