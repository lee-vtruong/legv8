// lib/exceptions/simulator-exceptions.ts - Custom Exception Classes
export class SimulatorException extends Error {
  public readonly address?: number
  public readonly instructionIndex?: number
  public readonly microStep?: number

  constructor(
    message: string,
    public readonly cause?: Error,
    address?: number,
    instructionIndex?: number,
    microStep?: number,
  ) {
    super(message)
    this.name = "SimulatorException"
    this.address = address
    this.instructionIndex = instructionIndex
    this.microStep = microStep
  }

  getDetailedMessage(): string {
    let details = this.message
    if (this.address !== undefined) {
      details += ` [Address: 0x${this.address.toString(16)}]`
    }
    if (this.instructionIndex !== undefined) {
      details += ` [Instruction: ${this.instructionIndex}]`
    }
    if (this.microStep !== undefined) {
      details += ` [MicroStep: ${this.microStep}]`
    }
    if (this.cause) {
      details += ` [Cause: ${this.cause.message}]`
    }
    return details
  }
}

export class AssemblyException extends SimulatorException {
  constructor(
    message: string,
    public readonly lineNumber?: number,
    public readonly lineContent?: string,
    cause?: Error,
  ) {
    super(message, cause)
    this.name = "AssemblyException"
  }

  getDetailedMessage(): string {
    let details = super.getDetailedMessage()
    if (this.lineNumber !== undefined) {
      details += ` [Line: ${this.lineNumber}]`
    }
    if (this.lineContent) {
      details += ` [Code: '${this.lineContent}']`
    }
    return details
  }
}

export class MemoryAccessException extends SimulatorException {
  constructor(message: string, address: number, cause?: Error) {
    super(message, cause, address)
    this.name = "MemoryAccessException"
  }
}

export class InvalidInstructionException extends SimulatorException {
  constructor(
    message: string,
    public readonly bytecode?: string,
    cause?: Error,
  ) {
    super(message, cause)
    this.name = "InvalidInstructionException"
  }

  getDetailedMessage(): string {
    let details = super.getDetailedMessage()
    if (this.bytecode) {
      details += ` [Bytecode: ${this.bytecode}]`
    }
    return details
  }
}

export class InvalidPCException extends SimulatorException {
  constructor(message: string, address: number) {
    super(message, undefined, address)
    this.name = "InvalidPCException"
  }
}
