"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useSimulator } from "@/lib/context"
import { Button } from "@/components/ui/button"
import { Upload, Play, Download, Maximize } from "lucide-react"
import { assembleProgram } from "@/lib/assembler"
import type { Instruction } from "@/lib/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Enhanced syntax highlighting colors with better contrast
const tokenColors = {
  instruction: "text-blue-600 dark:text-blue-400 font-semibold",
  register: "text-purple-600 dark:text-purple-400 font-medium",
  immediate: "text-orange-600 dark:text-orange-400 font-medium",
  comment: "text-green-600 dark:text-green-500 italic",
  label: "text-red-600 dark:text-red-400 font-semibold",
  directive: "text-cyan-600 dark:text-cyan-400 font-medium",
  bracket: "text-gray-600 dark:text-gray-400 font-bold",
  comma: "text-gray-500 dark:text-gray-500",
  default: "text-gray-800 dark:text-gray-200",
}

// Enhanced regular expressions for better syntax highlighting
const tokenRegex = {
  instruction:
    /\b(ADD|SUB|AND|ORR|ADDI|SUBI|LDUR|STUR|B|CBZ|CBNZ|BL|BR|RET|MOVZ|MOVK|LSL|LSR|MUL|SDIV|UDIV|EOR|NOP|HLT)\b/gi,
  register: /\b(X([0-9]|[12][0-9]|3[01])|XZR|SP|LR|FP|W([0-9]|[12][0-9]|3[01])|WZR)\b/gi,
  immediate: /#-?[0-9]+\b/g,
  comment: /\/\/.*$/gm,
  label: /^[A-Za-z_][A-Za-z0-9_]*:/gm,
  directive: /\.[A-Za-z]+\b/g,
  bracket: /[[\]]/g,
  comma: /,/g,
}

// Enhanced function to tokenize a line of code for syntax highlighting
function tokenizeLine(line: string): React.ReactNode[] {
  if (!line.trim()) {
    return [
      <span key="empty" className={tokenColors.default}>

      </span>,
    ]
  }

  // First check for comments - they override everything else
  const commentMatch = line.match(tokenRegex.comment)
  const commentIndex = commentMatch ? line.indexOf(commentMatch[0]) : line.length

  // Process the code part (before any comment)
  const codePart = line.substring(0, commentIndex)
  const commentPart = line.substring(commentIndex)
  const result: React.ReactNode[] = []

  // Check for label at the beginning
  const labelMatch = codePart.match(/^[A-Za-z_][A-Za-z0-9_]*:/g)
  let currentIndex = 0

  if (labelMatch && codePart.trim().startsWith(labelMatch[0])) {
    result.push(
      <span key={`label-${currentIndex}`} className={tokenColors.label}>
        {labelMatch[0]}
      </span>,
    )
    currentIndex = labelMatch[0].length
  }

  // Process the rest of the code part with enhanced tokenization
  const remainingCode = codePart.substring(currentIndex)
  const tokens: { type: string; value: string; index: number }[] = []

  // Find all tokens in the remaining code
  Object.entries(tokenRegex).forEach(([type, regex]) => {
    if (type === "comment" || type === "label") return // Already handled

    let match
    const re = new RegExp(regex.source, regex.flags)
    while ((match = re.exec(remainingCode)) !== null) {
      tokens.push({
        type,
        value: match[0],
        index: match.index,
      })
    }
  })

  // Sort tokens by their position in the string
  tokens.sort((a, b) => a.index - b.index)

  // Build the result by combining tokens and plain text
  let lastIndex = 0
  tokens.forEach((token, tokenIndex) => {
    if (token.index > lastIndex) {
      // Add plain text before this token
      const plainText = remainingCode.substring(lastIndex, token.index)
      result.push(
        <span key={`plain-${lastIndex}`} className={tokenColors.default}>
          {plainText}
        </span>,
      )
    }

    // Add the token with its color
    result.push(
      <span
        key={`${token.type}-${token.index}-${tokenIndex}`}
        className={tokenColors[token.type as keyof typeof tokenColors]}
      >
        {token.value}
      </span>,
    )

    lastIndex = token.index + token.value.length
  })

  // Add any remaining plain text
  if (lastIndex < remainingCode.length) {
    result.push(
      <span key={`plain-${lastIndex}`} className={tokenColors.default}>
        {remainingCode.substring(lastIndex)}
      </span>,
    )
  }

  // Add the comment part if it exists
  if (commentPart) {
    result.push(
      <span key="comment" className={tokenColors.comment}>
        {commentPart}
      </span>,
    )
  }

  return result
}

// BƯỚC 1: Sửa lại props interface
interface CodeEditorProps {
  maxHeight?: number
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  code: string; // Nhận code từ cha
  onCodeChange: (newCode: string) => void; // Nhận hàm cập nhật code từ cha
}

export function CodeEditor({
  maxHeight = 500,
  isFullscreen = false,
  onToggleFullscreen,
  code, // Sử dụng prop
  onCodeChange, // Sử dụng prop
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const { state, loadProgram, toggleBreakpoint, addLogEntry } = useSimulator() // Bỏ `program` từ đây
  const { isRunning, program: assembledProgram, cpuState, breakpoints } = state

  // BƯỚC 2: Xóa useState quản lý code bên trong
  // const [code, setCode] = useState<string>(defaultCode) // DÒNG NÀY ĐÃ ĐƯỢC XÓA

  const [error, setError] = useState<string | null>(null)
  const editorDisplayRef = useRef<HTMLDivElement>(null)
  const highlightedLineRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isProgramLoaded, setIsProgramLoaded] = useState(false)

  // Derived state `lines` sẽ tự động cập nhật khi prop `code` thay đổi
  const lines = code.split("\n")

  // BƯỚC 3: Cập nhật các hàm để dùng prop
  const handleLoadProgram = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }

      try {
        setError(null)
        // Dùng `code` từ prop
        const programToLoad: Instruction[] = assembleProgram(code)
        loadProgram(programToLoad)
        setIsProgramLoaded(true)
        addLogEntry("Program assembled and loaded.", "info")
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to assemble program"
        setError(errorMessage)
        addLogEntry(`Assembly Error: ${errorMessage}`, "error")
      }
    },
    [code, loadProgram, addLogEntry], // Thêm `code` và `addLogEntry` vào dependencies
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      // Gọi hàm từ prop để cập nhật state ở component cha
      onCodeChange(content)
      setError(null)
      addLogEntry(`File "${file.name}" loaded into editor.`, "info")
    }
    reader.onerror = () => {
      const errorMsg = "Error reading file."
      setError(errorMsg)
      addLogEntry(errorMsg, "error")
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleDownloadCode = () => {
    // Dùng `code` từ prop
    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "legv8_program.s"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    addLogEntry("Code downloaded as legv8_program.s", "info")
  }

  const handleToggleBreakpoint = (lineIndex: number) => {
    // lineIndex là 0-based, breakpoint là 1-based
    toggleBreakpoint(lineIndex + 1)
  }

  const getCurrentLineIndex = useCallback(() => {
    if (!assembledProgram || assembledProgram.length === 0 || !cpuState) {
      return -1
    }
    const pc = cpuState.pc
    const instructionIndex = Math.floor(pc / 4)

    if (instructionIndex < 0 || instructionIndex >= assembledProgram.length) {
      return -1
    }
    const instruction = assembledProgram[instructionIndex]

    // Đảm bảo instruction.sourceLine là một số hợp lệ
    // @ts-expect-error: sourceLine may exist on assembled instruction
    if (instruction && typeof instruction.sourceLine === "number" && instruction.sourceLine > 0) {
      // @ts-expect-error: sourceLine may exist on assembled instruction
      return instruction.sourceLine - 1 // Chuyển từ 1-based sang 0-based
    }
    return -1
  }, [assembledProgram, cpuState])

  // useEffect để highlight dòng code không thay đổi, vì nó đã đọc `getCurrentLineIndex` đúng
  useEffect(() => {
    // ... (code highlight giữ nguyên)
  }, [isRunning, cpuState?.pc, getCurrentLineIndex, lines.length])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      const newValue = textarea.value.substring(0, start) + "  " + textarea.value.substring(end)
      // Gọi hàm từ prop để cập nhật state
      onCodeChange(newValue)

      // Cần timeout để React cập nhật xong DOM
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  // useEffect để reset trạng thái `isProgramLoaded` khi simulator reset
  useEffect(() => {
    if (!isRunning && (assembledProgram?.length || 0) === 0) {
      setIsProgramLoaded(false)
    }
  }, [isRunning, assembledProgram?.length])

  const editorContainerClass =
    "bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 relative"

  return (
    <div ref={editorRef} className={editorContainerClass}>
      {/* Enhanced header with better button layout */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={isRunning}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Load assembly code from a file (.txt, .s, .asm)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <input
            id="file-upload"
            type="file"
            accept=".txt,.s,.asm"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isRunning}
          />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCode}
                  disabled={isRunning}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download the current code as a file</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleFullscreen?.()}
                  disabled={isRunning}
                  className="flex items-center gap-2"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle fullscreen mode for code editor</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={handleLoadProgram}
                disabled={isRunning}
                type="button"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Assemble and load the current code into the simulator</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Enhanced editor area with better syntax highlighting */}
      <div
        className={`font-mono text-sm overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/80 ${isRunning ? "p-0" : ""
          }`}
        style={{
          lineHeight: "1.6",
          height: isFullscreen ? "calc(100vh - 200px)" : `${maxHeight}px`,
          fontSize: "14px", // Slightly larger for better readability
        }}
      >
        {isRunning || isProgramLoaded ? (
          // Enhanced read-only display with syntax highlighting
          <div ref={editorDisplayRef} className="relative">
            {lines.map((line, index) => (
              <div
                key={index}
                data-line-index={index}
                className={`flex items-start whitespace-pre py-1 px-1 transition-all duration-200 group hover:bg-gray-100 dark:hover:bg-gray-800/50 ${state.breakpoints?.includes(index + 1)
                    ? "bg-red-100/50 dark:bg-red-900/20 border-l-4 border-red-500"
                    : ""
                  }`}
              >
                {/* Enhanced breakpoint indicator */}
                <div
                  className={`w-6 flex-shrink-0 cursor-pointer flex items-center justify-center text-lg leading-none ${state.breakpoints?.includes(index + 1)
                      ? "text-red-500 hover:text-red-600"
                      : "text-transparent group-hover:text-red-300 dark:group-hover:text-red-600 hover:text-red-500"
                    } transition-colors duration-150`}
                  onClick={() => handleToggleBreakpoint(index)}
                  title={state.breakpoints?.includes(index + 1) ? "Remove breakpoint" : "Set breakpoint"}
                >
                  ●
                </div>

                {/* Enhanced line number with better styling */}
                <span className="inline-block w-10 text-right pr-3 text-gray-400 dark:text-gray-500 select-none flex-shrink-0 pt-px text-xs">
                  {index + 1}
                </span>

                {/* Enhanced line content with syntax highlighting */}
                <span className="flex-grow min-h-[1.6em] px-2">
                  {line ? tokenizeLine(line) : <span className={tokenColors.default}>&nbsp;</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          // Enhanced editable textarea with better styling
          <div className="flex h-full">
            {/* Enhanced line numbers and breakpoints */}
            <div className="flex-shrink-0 pr-2 text-right bg-gray-100 dark:bg-gray-800 select-none border-r border-gray-200 dark:border-gray-700">
              {lines.map((_, index) => (
                <div key={index} className="flex items-center h-[1.6em] group">
                  <div
                    className={`w-6 cursor-pointer flex items-center justify-center text-lg leading-none ${state.breakpoints?.includes(index + 1)
                        ? "text-red-500 hover:text-red-600"
                        : "text-transparent group-hover:text-red-300 dark:group-hover:text-red-600 hover:text-red-500"
                      } transition-colors duration-150`}
                    onClick={() => handleToggleBreakpoint(index)}
                    title={state.breakpoints?.includes(index + 1) ? "Remove breakpoint" : "Set breakpoint"}
                  >
                    ●
                  </div>
                  <span className="w-10 text-gray-400 dark:text-gray-500 text-xs pr-2">{index + 1}</span>
                </div>
              ))}
            </div>

            {/* Enhanced textarea with better styling */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck="false"
              className="w-full h-full p-3 bg-transparent border-none outline-none resize-none focus:ring-0 text-gray-800 dark:text-gray-200 leading-relaxed"
              placeholder="// Enter LEGv8 assembly code here...
// Example:
// ADDI X1, XZR, #100
// ADDI X2, XZR, #200
// ADD X3, X1, X2"
              disabled={isRunning}
              style={{ fontSize: "14px", lineHeight: "1.6" }}
            />
          </div>
        )}
      </div>

      {/* Enhanced error display with better styling */}
      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <div className="text-red-500 font-bold text-lg leading-none">⚠</div>
            <div>
              <strong className="font-semibold">Assembly Error:</strong>
              <div className="mt-1 font-mono text-xs bg-red-100 dark:bg-red-900/30 p-2 rounded border">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced syntax highlighting legend */}
      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Syntax Highlighting:</div>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className={tokenColors.instruction}>ADD</span>
            <span className="text-gray-500">Instructions</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={tokenColors.register}>X1</span>
            <span className="text-gray-500">Registers</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={tokenColors.immediate}>#100</span>
            <span className="text-gray-500">Immediates</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={tokenColors.comment}>// Comment</span>
            <span className="text-gray-500">Comments</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={tokenColors.label}>label:</span>
            <span className="text-gray-500">Labels</span>
          </div>
        </div>
      </div>
    </div>
  )
}
