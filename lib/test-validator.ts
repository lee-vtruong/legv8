// lib/test-validator.ts - Utility để validate test results
export interface TestResult {
  testName: string
  passed: boolean
  expected: any
  actual: any
  message: string
}

export class TestValidator {
  private results: TestResult[] = []

  addTest(testName: string, expected: any, actual: any, message?: string): boolean {
    const passed = JSON.stringify(expected) === JSON.stringify(actual)
    this.results.push({
      testName,
      passed,
      expected,
      actual,
      message: message || (passed ? "PASS" : "FAIL"),
    })
    return passed
  }

  addMemoryTest(testName: string, memory: Record<number, number>, address: number, expectedValue: number): boolean {
    const actualValue = memory[address] || 0
    return this.addTest(
      testName,
      expectedValue,
      actualValue,
      `Memory[${address}]: expected ${expectedValue}, got ${actualValue}`,
    )
  }

  addRegisterTest(testName: string, registers: number[], regIndex: number, expectedValue: number): boolean {
    const actualValue = registers[regIndex] || 0
    return this.addTest(
      testName,
      expectedValue,
      actualValue,
      `X${regIndex}: expected ${expectedValue}, got ${actualValue}`,
    )
  }

  getResults(): TestResult[] {
    return [...this.results]
  }

  getPassedCount(): number {
    return this.results.filter((r) => r.passed).length
  }

  getTotalCount(): number {
    return this.results.length
  }

  clear(): void {
    this.results = []
  }

  logResults(): void {
    console.log("=== TEST RESULTS ===")
    this.results.forEach((result) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL"
      console.log(`${status} ${result.testName}: ${result.message}`)
    })
    console.log(`\nSummary: ${this.getPassedCount()}/${this.getTotalCount()} tests passed`)
  }
}
