// lib/storage/register-storage.ts - Improved Register Storage
export class RegisterStorage {
  private registers: number[] = Array(32).fill(0)

  // Constants
  static readonly NUM_REGISTERS = 32
  static readonly STACK_POINTER_INDEX = 28
  static readonly FRAME_POINTER_INDEX = 29
  static readonly LINK_REGISTER_INDEX = 30
  static readonly ZERO_REGISTER_INDEX = 31
  static readonly VALUE_MASK = 0xffffffffffffffff

  constructor(other?: RegisterStorage) {
    if (other) {
      this.registers = [...other.registers]
    }
  }

  private validateRegisterNumber(regNum: number, operation: string): void {
    if (regNum < 0 || regNum >= RegisterStorage.NUM_REGISTERS) {
      throw new Error(
        `Invalid register number for ${operation}: ${regNum}. Must be 0-${RegisterStorage.NUM_REGISTERS - 1}`,
      )
    }
  }

  getValue(regNum: number): number {
    this.validateRegisterNumber(regNum, "read")
    if (regNum === RegisterStorage.ZERO_REGISTER_INDEX) {
      return 0
    }
    return this.registers[regNum]
  }

  setValue(regNum: number, value: number): void {
    this.validateRegisterNumber(regNum, "write")

    if (regNum === RegisterStorage.ZERO_REGISTER_INDEX) {
      console.warn("Attempted write to XZR (zero register) - ignored")
      return
    }

    // Mask to ensure 64-bit value
    this.registers[regNum] = value & RegisterStorage.VALUE_MASK
  }

  clear(): void {
    this.registers.fill(0)
  }

  getRegisters(): number[] {
    return [...this.registers]
  }

  toString(): string {
    let result = "Registers:\n"
    for (let i = 0; i < RegisterStorage.NUM_REGISTERS; i += 2) {
      const regName1 = this.getRegisterName(i)
      const regName2 = i + 1 < RegisterStorage.NUM_REGISTERS ? this.getRegisterName(i + 1) : ""

      result += `  ${regName1}(${i.toString().padStart(2, "0")}): 0x${this.registers[i].toString(16).padStart(16, "0")}`

      if (i + 1 < RegisterStorage.NUM_REGISTERS) {
        result += `   ${regName2}(${(i + 1).toString().padStart(2, "0")}): 0x${this.registers[i + 1].toString(16).padStart(16, "0")}`
      }
      result += "\n"
    }
    return result
  }

  private getRegisterName(index: number): string {
    switch (index) {
      case RegisterStorage.STACK_POINTER_INDEX:
        return "SP "
      case RegisterStorage.FRAME_POINTER_INDEX:
        return "FP "
      case RegisterStorage.LINK_REGISTER_INDEX:
        return "LR "
      case RegisterStorage.ZERO_REGISTER_INDEX:
        return "XZR"
      default:
        return `X${index.toString().padStart(2, " ")}`
    }
  }
}
