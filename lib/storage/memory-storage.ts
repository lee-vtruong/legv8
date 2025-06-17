// lib/storage/memory-storage.ts - Byte-level Memory Storage with Debug
import { MemoryAccessException } from "../exceptions/simulator-exceptions"

export class MemoryStorage {
  private memory: Map<number, number> = new Map()

  // Constants
  static readonly MIN_ADDRESS = 0x500000
  static readonly VALUE_MASK = 0xff

  constructor(initialMemory?: MemoryStorage) {
    if (initialMemory) {
      this.memory = new Map(initialMemory.memory)
    }
  }

  private checkAddress(address: number): void {
    if (address < MemoryStorage.MIN_ADDRESS) {
      throw new MemoryAccessException(
        `Attempt to access memory below minimum allowed address (0x${MemoryStorage.MIN_ADDRESS.toString(16)})`,
        address,
      )
    }
  }

  private checkAlignment(address: number, size: number): void {
    if (address % size !== 0) {
      throw new MemoryAccessException(`Unaligned ${size}-byte access at address 0x${address.toString(16)}`, address)
    }
  }

  // Byte operations
  readByte(address: number): number {
    this.checkAddress(address)
    return this.memory.get(address) || 0
  }

  writeByte(address: number, value: number): void {
    this.checkAddress(address)
    const byteValue = value & 0xff
    console.log(`DEBUG: Writing byte at address ${address} (0x${address.toString(16)}): 0x${byteValue.toString(16)}`)
    if (byteValue === 0) {
      this.memory.delete(address)
    } else {
      this.memory.set(address, byteValue)
    }
  }

  // Halfword operations (2 bytes)
  readHalfword(address: number): number {
    this.checkAddress(address)
    this.checkAlignment(address, 2)

    const byte0 = this.readByte(address)
    const byte1 = this.readByte(address + 1)
    return byte0 | (byte1 << 8) // Little endian
  }

  writeHalfword(address: number, value: number): void {
    this.checkAddress(address)
    this.checkAlignment(address, 2)

    console.log(`DEBUG: Writing halfword at address ${address}: ${value} (0x${value.toString(16)})`)
    const halfwordValue = value & 0xffff
    this.writeByte(address, halfwordValue & 0xff)
    this.writeByte(address + 1, (halfwordValue >> 8) & 0xff)
  }

  // Word operations (4 bytes)
  readWord(address: number): number {
    this.checkAddress(address)
    this.checkAlignment(address, 4)

    const byte0 = this.readByte(address)
    const byte1 = this.readByte(address + 1)
    const byte2 = this.readByte(address + 2)
    const byte3 = this.readByte(address + 3)
    return byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24)
  }

  writeWord(address: number, value: number): void {
    this.checkAddress(address)
    this.checkAlignment(address, 4)

    console.log(`DEBUG: Writing word at address ${address}: ${value} (0x${value.toString(16)})`)
    const wordValue = value >>> 0 // Convert to unsigned 32-bit
    this.writeByte(address, wordValue & 0xff)
    this.writeByte(address + 1, (wordValue >>> 8) & 0xff)
    this.writeByte(address + 2, (wordValue >>> 16) & 0xff)
    this.writeByte(address + 3, (wordValue >>> 24) & 0xff)
  }

  // Doubleword operations (8 bytes)
  readDoubleword(address: number): number {
    this.checkAddress(address)
    this.checkAlignment(address, 8)

    // Read all 8 bytes individually
    let result = 0
    for (let i = 0; i < 8; i++) {
      const byte = this.readByte(address + i)
      result += byte * Math.pow(256, i) // Little endian: byte 0 is LSB
    }
    return result
  }

  writeDoubleword(address: number, value: number): void {
    this.checkAddress(address)
    this.checkAlignment(address, 8)

    console.log(`DEBUG: Writing doubleword at address ${address}: ${value} (0x${value.toString(16)})`)

    // Simple approach: write byte by byte
    this.writeByte(address + 0, (value >>> 0) & 0xff) // LSB
    this.writeByte(address + 1, (value >>> 8) & 0xff)
    this.writeByte(address + 2, (value >>> 16) & 0xff)
    this.writeByte(address + 3, (value >>> 24) & 0xff)
    this.writeByte(address + 4, (value >>> 32) & 0xff)
    this.writeByte(address + 5, (value >>> 40) & 0xff)
    this.writeByte(address + 6, (value >>> 48) & 0xff)
    this.writeByte(address + 7, (value >>> 56) & 0xff) // MSB
  }

  // Utility methods
  clear(): void {
    this.memory.clear()
  }

  getMemoryMap(): Map<number, number> {
    return new Map(this.memory)
  }

  // Get memory range for display - shows individual bytes
  getMemoryRange(startAddress: number, endAddress: number): Record<number, number> {
    this.checkAddress(startAddress)
    this.checkAddress(endAddress)

    if (startAddress > endAddress) {
      throw new MemoryAccessException(
        `Invalid range: start (0x${startAddress.toString(16)}) > end (0x${endAddress.toString(16)})`,
        startAddress,
      )
    }

    const result: Record<number, number> = {}
    for (let addr = startAddress; addr <= endAddress; addr++) {
      const value = this.readByte(addr)
      if (value !== 0) {
        result[addr] = value
      }
    }
    return result
  }

  // Get doubleword range for display - reconstructs 64-bit values from bytes
  getDoublewordRange(startAddress: number, endAddress: number): Record<number, number> {
    this.checkAddress(startAddress)
    this.checkAddress(endAddress)

    const alignedStart = Math.floor(startAddress / 8) * 8
    const alignedEnd = Math.ceil(endAddress / 8) * 8

    const result: Record<number, number> = {}
    for (let addr = alignedStart; addr <= alignedEnd; addr += 8) {
      const value = this.readDoubleword(addr)
      // Always include the address, even if value is 0, for display purposes
      result[addr] = value
    }
    return result
  }

  toString(): string {
    if (this.memory.size === 0) {
      return "Data Memory: (Empty)"
    }

    const sortedEntries = Array.from(this.memory.entries()).sort(([a], [b]) => a - b)
    let result = "Data Memory (Initialized Bytes):\n"

    for (const [address, value] of sortedEntries) {
      result += `  0x${address.toString(16).padStart(8, "0")}: 0x${value.toString(16).padStart(2, "0")} (${value})\n`
    }

    return result
  }
}
