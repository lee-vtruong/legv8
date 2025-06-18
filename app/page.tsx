"use client"

import { useState, useEffect } from "react"
import { useSimulator } from "@/lib/context"
import { CpuSimulator } from "@/components/cpu-simulator"
import { CodeEditor } from "@/components/code-editor"
import { ControlPanel } from "@/components/control-panel"
import { DataDisplay } from "@/components/data-display"
import { ExecutionLog } from "@/components/execution-log"
import { ThemeToggle } from "@/components/theme-toggle"
import { InstructionBreakdownPanel } from "@/components/instruction-breakdown-panel"
import { ControlSignalsPanel } from "@/components/control-signals-panel"
import { ComponentValuesPanel } from "@/components/component-values-panel"
import { Github, Facebook, Minimize, ChevronDown, ChevronUp, Code, Layers, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

const defaultCode = `// LEGv8 Assembly Program - Demo

// === Data Setup Section ===
ADDI X1, XZR, #100    // X1 = 100 (source data)
ADDI X2, XZR, #200    // X2 = 200 (another source)
ADDI X3, XZR, #8      // X3 = 8 (base address)

// === Memory Operations Test ===
STUR X1, [X3, #0]     // Store X1(100) to memory[8+0] = memory[8]
STUR X2, [X3, #8]     // Store X2(200) to memory[8+8] = memory[16]
LDUR X4, [X3, #0]     // X4 should = 100 (from memory[8])
LDUR X5, [X3, #8]     // X5 should = 200 (from memory[16])

// === Arithmetic Operations ===
ADD X6, X1, X2        // X6 = X1 + X2 = 300
SUB X7, X2, X1        // X7 = X2 - X1 = 100
AND X8, X1, X2        // X8 = X1 & X2 (bitwise AND)
ORR X9, X1, X2        // X9 = X1 | X2 (bitwise OR)

// === Branch Testing Section ===
ADDI X10, XZR, #0     // X10 = 0 (for CBZ test)
ADDI X11, XZR, #5     // X11 = 5 (for CBNZ test)

CBZ X10, #2         // Should branch (X10 == 0)
ADDI X12, XZR, #999   // Should be skipped

CBNZ X11, #2        // Should branch (X11 != 0)  
ADDI X14, XZR, #777   // Should be skipped
ADDI X15, XZR, #123   // Should execute (final instruction)
`

export default function Home() {
  const { state, toggleFocusMode } = useSimulator()
  const { isFocusMode, program, cpuState, currentInstruction: currentInstructionIndex } = state

  const [activeTab, setActiveTab] = useState<"registers" | "memory" | "cpu" | "signals" | "log">("registers")
  const [isTabsExpanded, setIsTabsExpanded] = useState(false)
  const [isCodeEditorFullscreen, setIsCodeEditorFullscreen] = useState(false)

  const [code, setCode] = useState<string>(defaultCode)
  // Thêm state cho các panel có thể thu gọn
  const [isCodePanelCollapsed, setIsCodePanelCollapsed] = useState(false)
  const [isDetailsPanelCollapsed, setIsDetailsPanelCollapsed] = useState(false)

  const getCurrentInstructionAssembly = () => {
    if (program && program.length > 0 && currentInstructionIndex >= 0 && currentInstructionIndex < program.length) {
      const instr = program[currentInstructionIndex]
      return instr?.assembly || "Loading..."
    }
    if (program && program.length > 0 && currentInstructionIndex >= program.length) return "Finished"
    return "Idle"
  }

  const currentInstrAssembly = getCurrentInstructionAssembly()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCodeEditorFullscreen) {
        setIsCodeEditorFullscreen(false)
      }
    }

    if (isCodeEditorFullscreen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "auto"
    }
  }, [isCodeEditorFullscreen])

  // Render focus mode layout - FIXED: Expand code editor properly
  if (isFocusMode) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* Minimal header for focus mode */}
        <header className="bg-white/90 dark:bg-gray-800/90 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
          <div className="container mx-auto px-2 py-2 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white">LEGv8 CPU Simulator</h1>
              <Badge variant="outline" className="text-xs">
                PC: 0x{cpuState.pc.toString(16).padStart(4, "0")}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {currentInstructionIndex + 1}/{program.length || 0}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono truncate max-w-[200px] md:max-w-[300px]">{currentInstrAssembly}</span>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={toggleFocusMode} className="h-7 px-2">
                <Minimize className="h-3 w-3 mr-1" />
                <span className="text-xs">Exit Focus</span>
              </Button>
            </div>
          </div>
        </header>

        {/* FIXED: Full screen code editor in focus mode */}
        <main className="flex-grow flex flex-col">
          {/* Compact control panel */}
          <div className="container mx-auto px-2 py-2">
            <ControlPanel isCompact={true} />
          </div>

          {/* EXPANDED code editor - takes most of the screen */}
          <div className="flex-grow px-4 pb-4">
            <CodeEditor
              maxHeight={window.innerHeight - 200}
              code={code}
              onCodeChange={setCode}
            />
          </div>
        </main>

        {/* Bottom panel with tabs - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-10">
          <div
            className={`bg-white/90 dark:bg-gray-800/90 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] transition-all duration-300 ${isTabsExpanded ? "max-h-64" : "max-h-10"
              } overflow-hidden`}
          >
            {/* Tab headers - always visible */}
            <div
              className="flex justify-center border-b border-gray-200 dark:border-gray-700 bg-transparent cursor-pointer"
              onClick={() => setIsTabsExpanded(!isTabsExpanded)}
            >
              <div className="flex items-center py-2 px-4 space-x-6">
                <span
                  className={`text-sm cursor-pointer hover:text-primary transition-colors ${activeTab === "registers" ? "font-medium text-primary" : "text-muted-foreground"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab("registers")
                    setIsTabsExpanded(true)
                  }}
                >
                  Registers
                </span>
                <span
                  className={`text-sm cursor-pointer hover:text-primary transition-colors ${activeTab === "memory" ? "font-medium text-primary" : "text-muted-foreground"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab("memory")
                    setIsTabsExpanded(true)
                  }}
                >
                  Memory
                </span>
                <span
                  className={`text-sm cursor-pointer hover:text-primary transition-colors ${activeTab === "cpu" ? "font-medium text-primary" : "text-muted-foreground"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab("cpu")
                    setIsTabsExpanded(true)
                  }}
                >
                  CPU
                </span>
                <span
                  className={`text-sm cursor-pointer hover:text-primary transition-colors ${activeTab === "signals" ? "font-medium text-primary" : "text-muted-foreground"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab("signals")
                    setIsTabsExpanded(true)
                  }}
                >
                  Signals
                </span>
                <span
                  className={`text-sm cursor-pointer hover:text-primary transition-colors ${activeTab === "log" ? "font-medium text-primary" : "text-muted-foreground"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab("log")
                    setIsTabsExpanded(true)
                  }}
                >
                  Log
                </span>
                <ChevronUp className={`h-4 w-4 transition-transform ${isTabsExpanded ? "" : "rotate-180"}`} />
              </div>
            </div>

            {/* Tab content - only visible when expanded */}
            {isTabsExpanded && (
              <div className="p-2 h-48 overflow-auto">
                {activeTab === "registers" && <DataDisplay activeTab="registers" />}
                {activeTab === "memory" && <DataDisplay activeTab="memory" />}
                {activeTab === "cpu" && <DataDisplay activeTab="cpu" />}
                {activeTab === "signals" && <DataDisplay activeTab="signals" />}
                {activeTab === "log" && <ExecutionLog />}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Standard mode layout - with enhanced side panels
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">LEGv8 CPU Simulator</h1>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mt-1">
              Interactive single-cycle processor simulator
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            {/* <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCodeEditorFullscreen(true)}
              title="Fullscreen Code Editor"
            >
              <Maximize className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Focus Code</span>
            </Button> */}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-2 md:px-4 py-4">
        {/* Current Instruction Banner */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2 flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              Instruction {currentInstructionIndex + 1}/{program.length || 0}
            </Badge>
            <span className="font-mono text-sm truncate max-w-[300px] md:max-w-[500px]">{currentInstrAssembly}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs">
              PC: 0x{cpuState.pc.toString(16).padStart(4, "0")}
            </Badge>
            <Badge variant={cpuState.flags?.Z ? "default" : "outline"} className="text-xs">
              Z: {cpuState.flags?.Z ? "1" : "0"}
            </Badge>
          </div>
        </div>

        {/* Main Content Area - Enhanced Layout */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Left Column - Controls and Code */}
          <div className="w-full xl:w-[300px] flex flex-col gap-4">
            {/* Collapsible Assembly Code Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div
                className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
                onClick={() => setIsCodePanelCollapsed(!isCodePanelCollapsed)}
              >
                <div className="flex items-center">
                  <Code className="h-4 w-4 mr-2" />
                  <h3 className="text-sm font-medium">Assembly Code</h3>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isCodePanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isCodePanelCollapsed ? "max-h-0" : "max-h-[250px]"}`}
              >
                <div className="p-3">
                  <CodeEditor
                    maxHeight={200}
                    onToggleFullscreen={() => setIsCodeEditorFullscreen(true)}
                    code={code} // <-- TRUYỀN XUỐNG
                    onCodeChange={setCode} // <-- TRUYỀN XUỐNG
                  />
                </div>
              </div>
            </div>

            {/* Control Panel - Always visible */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <ControlPanel />
            </div>

            {/* Enhanced Analysis Panels */}
            <ControlSignalsPanel />
          </div>

          {/* Center Column - CPU Datapath */}
          <div className="w-full xl:flex-1 flex flex-col gap-4">
            {/* CPU Datapath - Main focus */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex-grow">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-medium">CPU Datapath</h2>
              </div>
              <div className="p-1 h-[calc(100%-40px)] min-h-[500px]">
                <CpuSimulator />
              </div>
            </div>

            {/* Execution Log - Compact */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-[80px]">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-medium">Execution Log</h3>
              </div>
              <div className="p-1 h-[calc(100%-28px)]">
                <ExecutionLog />
              </div>
            </div>
          </div>

          {/* Right Column - System Details */}
          <div className="w-full xl:w-[300px] flex flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex-grow">
              <div
                className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
                onClick={() => setIsDetailsPanelCollapsed(!isDetailsPanelCollapsed)}
              >
                <div className="flex items-center">
                  <Layers className="h-4 w-4 mr-2" />
                  <h3 className="text-sm font-medium">System Details</h3>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isDetailsPanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isDetailsPanelCollapsed ? "max-h-0" : "max-h-[500px]"}`}
              >
                <Tabs defaultValue="registers" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <div className="border-b border-gray-200 dark:border-gray-700">
                    <TabsList className="w-full justify-start px-3 pt-1">
                      <TabsTrigger value="registers" className="text-xs">
                        Registers
                      </TabsTrigger>
                      <TabsTrigger value="memory" className="text-xs">
                        Memory
                      </TabsTrigger>
                      <TabsTrigger value="cpu" className="text-xs">
                        CPU
                      </TabsTrigger>
                      <TabsTrigger value="signals" className="text-xs">
                        Signals
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="registers" className="p-3">
                    <DataDisplay activeTab="registers" />
                  </TabsContent>
                  <TabsContent value="memory" className="p-3">
                    <DataDisplay activeTab="memory" />
                  </TabsContent>
                  <TabsContent value="cpu" className="p-3">
                    <DataDisplay activeTab="cpu" />
                  </TabsContent>
                  <TabsContent value="signals" className="p-3">
                    <DataDisplay activeTab="signals" />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* MOVED: Instruction Breakdown Panel below System Details */}
            <InstructionBreakdownPanel />

            {/* MOVED: Component Values Panel below System Details */}
            <ComponentValuesPanel />
          </div>
        </div>
      </main>

      {/* Fullscreen Code Editor Overlay */}
      {isCodeEditorFullscreen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Assembly Code Editor</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCodeEditorFullscreen(false)}
                className="bg-white/90 dark:bg-gray-800/90"
              >
                <X className="h-4 w-4 mr-2" />
                Exit Fullscreen
              </Button>
            </div>
          </div>

          {/* Fullscreen Code Editor */}
          <div className="flex-1 p-4">
            <CodeEditor
              maxHeight={window.innerHeight - 200}
              isFullscreen={true}
              code={code} // <-- TRUYỀN XUỐNG
              onCodeChange={setCode} // <-- TRUYỀN XUỐNG
            />
          </div>
        </div>
      )}

      <footer className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs sm:text-sm py-4 border-t border-gray-300 dark:border-gray-700 mt-4">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-1 sm:mb-2">© {new Date().getFullYear()} LEGv8 Simulator. Created by leev.truong.</p>
          <div className="flex justify-center items-center space-x-4">
            <a
              href="https://github.com/lee-vtruong/legv8-simulator"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            >
              <Github className="h-4 w-4 sm:h-5 sm:w-5" /> <span className="sr-only">GitHub</span>
            </a>
            <a
              href="https://www.facebook.com/VanTruong.Lee/"
              target="_blank"
              rel="noopener noreferrer"
              title="Facebook"
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-500 transition-colors duration-200"
            >
              <Facebook className="h-4 w-4 sm:h-5 sm:w-5" /> <span className="sr-only">Facebook</span>
            </a>
            <a
              href="https://www.linkedin.com/in/van-truongle/"
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn"
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-500 transition-colors duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 sm:h-5 sm:w-5"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
              <span className="sr-only">LinkedIn</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
