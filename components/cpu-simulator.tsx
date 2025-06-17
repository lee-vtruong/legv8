"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useSimulator } from "@/lib/context"
import { Button } from "@/components/ui/button"
import { Camera, ZoomIn, ZoomOut, RotateCcw, Eye, Maximize2, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ComponentDetailDialog } from "./component-detail-dialog"
import { ControlPanel } from "./control-panel"
import { useTheme } from "next-themes"
import { InstructionSplitter } from "@/lib/datapath/instruction-splitter"

// Thêm import cho animation engine
import { AnimationEngine, type AnimationStep, type AnimationSequence } from "@/lib/animation-engine"

// Define colors and styles
const lightColors = {
  componentFill: "#f8fafc",
  componentStroke: "#64748b",
  controlFill: "#dbeafe",
  controlStroke: "#2563eb",
  muxFill: "#fef2f2",
  aluFill: "#dcfce7",
  flagsFill: "#fefce8",
  dataPathStroke: "#94a3b8",
  dataPathActiveStroke: "#059669",
  controlPathStroke: "#3b82f6",
  controlPathActiveStroke: "#dc2626",
  textColor: "#1e293b",
  labelColor: "#475569",
  signalLabelColor: "#2563eb",
  signalValueColor: "#dc2626",
  dataValueColor: "#059669",
  panelBg: "rgba(255, 255, 255, 0.98)",
  panelBorder: "#e2e8f0",
  addressColor: "#7c3aed",
}

const darkColors = {
  componentFill: "#334155",
  componentStroke: "#94a3b8",
  controlFill: "#1e3a8a",
  controlStroke: "#60a5fa",
  muxFill: "#7f1d1d",
  aluFill: "#064e3b",
  flagsFill: "#713f12",
  dataPathStroke: "#64748b",
  dataPathActiveStroke: "#10b981",
  controlPathStroke: "#60a5fa",
  controlPathActiveStroke: "#ef4444",
  textColor: "#e2e8f0",
  labelColor: "#94a3b8",
  signalLabelColor: "#60a5fa",
  signalValueColor: "#f87171",
  dataValueColor: "#34d399",
  panelBg: "rgba(30, 41, 59, 0.98)",
  panelBorder: "#475569",
  addressColor: "#a855f7",
}

// Component descriptions for tooltips
const componentDescriptions = {
  pc: "Program Counter (PC) - Holds the memory address of the current instruction being executed",
  "instruction-memory": "Instruction Memory - Stores the program instructions to be executed",
  "pc-adder-4": "PC+4 Adder - Increments the PC by 4 to point to the next instruction",
  "control-unit": "Control Unit - Generates control signals based on the instruction opcode",
  registers: "Register File - Contains 32 general-purpose registers (X0-X30) plus XZR (zero register)",
  "reg2loc-mux": "Reg2Loc Multiplexer - Selects between rs2 and rd as the second register to read",
  "sign-extend": "Sign Extend - Extends the immediate value from 16 bits to 64 bits",
  alu: "Arithmetic Logic Unit (ALU) - Performs arithmetic and logical operations",
  "alusrc-mux": "ALUSrc Multiplexer - Selects between register value and immediate value as second ALU input",
  "alu-control": "ALU Control - Determines the ALU operation based on instruction type",
  flags: "Flags Register - Stores condition flags (N, Z, C, V) set by ALU operations",
  "data-memory": "Data Memory - Stores data that can be read from or written to by the program",
  "memtoreg-mux": "MemToReg Multiplexer - Selects between ALU result and memory data for register write-back",
  "branch-adder": "Branch Address Adder - Calculates target address for branch instructions",
  "shift-left": "Shift Left - Shifts the immediate value left by 2 bits (multiply by 4) for branch offset",
  "pc-mux": "PC Source Multiplexer - Selects between PC+4 and branch target for next PC value",
  "branch-logic-unit": "Branch Logic - Determines whether to take a branch based on flags and branch type",
  "jump-or-gate": "OR Gate - Combines unconditional branch and conditional branch signals for PC source selection",
}

// Enhanced Particle interface for sequential flow
interface Particle {
  id: number
  path: string
  progress: number
  value?: string | number
  type: "data" | "control" | "address"
  size?: number
  opacity?: number
  speed?: number
  startTime?: number
  pathLength?: number
  sequenceOrder?: number
  isActive?: boolean
  color?: string
}

// ENHANCED: Helper function to get more detailed particle values

// === BẮT ĐẦU PHẦN THAY THẾ ===

// Thay thế TOÀN BỘ hàm getParticleValue của bạn bằng hàm này
function getParticleValue(
  path: string,
  microStep: number,
  state: ReturnType<typeof useSimulator>["state"],
): string | number | undefined {
  const { cpuState, registers, controlSignals, program, currentInstruction: instructionIndex } = state
  const instruction = program[instructionIndex]

  if (!instruction || !instruction.assembly) return "--------"

  let parsedInstruction;
  try {
    parsedInstruction = InstructionSplitter.parseInstruction(instruction);
  } catch (error) {
    console.warn("Error parsing instruction for particle value:", error);
    return "Error";
  }

  const { opcode, immediate, rs1, rs2, rd, instruction: fullInstructionHex } = parsedInstruction;
  const cleanPath = path.replace(/^path-/, "").replace(/^signal-/, "");

  // --- 1. XỬ LÝ TÍN HIỆU ĐIỀU KHIỂN ---
  if (path.startsWith("signal-")) {
    if (cleanPath.includes("regwrite")) return controlSignals.RegWrite ? "1" : "0";
    if (cleanPath.includes("alusrc")) return controlSignals.ALUSrc ? "1" : "0";
    if (cleanPath.includes("memread")) return controlSignals.MemRead ? "1" : "0";
    if (cleanPath.includes("memwrite")) return controlSignals.MemWrite ? "1" : "0";
    if (cleanPath.includes("memtoreg")) return controlSignals.MemToReg ? "1" : "0";
    if (cleanPath.includes("reg2loc")) return controlSignals.Reg2Loc ? "1" : "0";
    if (cleanPath.includes("aluop")) {
      const opMap: Record<string, string> = { ADD: "10", SUB: "11", AND: "00", ORR: "01", ADDI: "10", SUBI: "11" };
      return opMap[instruction.type] || "00";
    }
    if (cleanPath.includes("flagwrite")) return controlSignals.FlagWrite ? "1" : "0";
    if (cleanPath.includes("zerobranch")) return controlSignals.ZeroBranch ? "1" : "0";
    if (cleanPath.includes("uncondbranch")) return controlSignals.UncondBranch ? "1" : "0";
    if (cleanPath.includes("pcsrc")) return controlSignals.PCSrc ? "1" : "0";
    if (cleanPath.includes("branch")) return controlSignals.UncondBranch || controlSignals.ZeroBranch ? "1" : "0";
    if (cleanPath === "branchlogic-pcsrc") return controlSignals.PCSrc ? "1" : "0";
    if (cleanPath === "uncondBranch-or") return controlSignals.UncondBranch ? "1" : "0";
    if (cleanPath === "and-to-or") return controlSignals.ZeroBranch && cpuState.flags?.Z ? "1" : "0";
    if (cleanPath === "and-to-or-2") return controlSignals.ZeroBranch && !cpuState.flags?.Z ? "1" : "0";
    if (cleanPath === "or-to-mux") return controlSignals.PCSrc ? "1" : "0";
    return "?";
  }

  // --- 2. XỬ LÝ ĐƯỜNG DỮ LIỆU / ĐỊA CHỈ ---

  // Các đường ra từ Instruction Memory
  if (cleanPath.startsWith("path-im-")) {
    if (cleanPath === "path-im-control") return `${opcode.toString(2).padStart(11, "0")}`;
    if (cleanPath === "path-im-readreg1") return `${rs1.toString(2).padStart(5, "0")}`;
    if (cleanPath === "path-im-mux-reg2loc-0") return `${rs2.toString(2).padStart(5, "0")}`;
    if (cleanPath === "path-im-mux-reg2loc-1") return `${rd.toString(2).padStart(5, "0")}`;
    // đường từ instruction memory đến with register file
    if (cleanPath === "path-im-writereg") return `${rd.toString(2).padStart(5, "0")}`;
    if (cleanPath === "path-im-signext") return `${fullInstructionHex.toString(2).padStart(32, "0")}`;
    if (cleanPath === "path-im-aluIn") return `${opcode.toString(2).padStart(11, "0")}`;
    return "--------";
  }

  // Các đường khác theo từng giai đoạn (ĐÃ SỬA LỖI SO SÁNH)
  switch (microStep) {
    case 0: // Fetch
      if (cleanPath === "path-pc-im" || cleanPath === "path-pc-adder4") return `0x${(cpuState.pc || 0).toString(16).padStart(8, "0")}`;
      if (cleanPath === "path-adder4-mux-pcsrc-0") return `0x${((cpuState.pc || 0) + 4).toString(16).padStart(8, "0")}`;
      break;

    case 1: // Decode
      // path-mux-reg2loc-readreg2 (đường từ mux đến readreg2) là giá trị của rs2 hoặc rd
      // if (cleanPath === "path-mux-reg2loc-readreg2") return `X${controlSignals.Reg2Loc ? (rs2 || 0) : (rd || 0)}`; 
      if (cleanPath === "path-mux-reg2loc-readreg2") {
        // Nếu là lệnh I-type (ADDI, SUBI, ...) thì luôn là XZR (00000)
        if (["ADDI", "SUBI"].includes(instruction.type)) {
          return "00000";
        }
        // ĐÚNG: Reg2Loc = 1 => chọn rd, Reg2Loc = 0 => chọn rs2
        const regValue = controlSignals.Reg2Loc ? rd : rs2;
        return `${(regValue || 0).toString(2).padStart(5, "0")}`;
      }
      if (cleanPath === "path-im-writereg") return `X${rd}`;
      break;

    case 2: // Execute
      if (cleanPath === "path-readreg1-alu") return `${registers[rs1] || 0}`;
      if (cleanPath === "path-readreg2-mux-alusrc-0") return `${registers[rs2] || 0}`;
      if (cleanPath === "path-signext-mux-alusrc-1") return `${immediate}`;
      if (cleanPath === "path-mux-alusrc-alu") return `${controlSignals.ALUSrc ? immediate : (registers[rs2] || 0)}`;
      if (cleanPath === "path-alucontrol-aluop") return instruction.type.replace("I", "");
      if (cleanPath === "path-alu-flags") return `${cpuState.flags?.N ? "N" : ""}${cpuState.flags?.Z ? "Z" : ""}${cpuState.flags?.C ? "C" : ""}${cpuState.flags?.V ? "V" : ""}`;
      break;

    case 3: // Memory
      const address = cpuState.aluResult ?? 0;
      if (cleanPath === "path-alu-memaddr") return `0x${address.toString(16).padStart(4, "0")}`;
      if (cleanPath === "path-readreg2-memwrite") return `${registers[rd] || 0}`;
      if (cleanPath === "path-memread-mux-memtoreg-1") return `${state.memory[address] || 0}`;
      break;

    case 4: // Write Back
      if (cleanPath === "path-memread-mux-memtoreg-1") return `${cpuState.lastMemoryAccess?.value ?? 0}`;
      if (cleanPath === "path-alu-mux-memtoreg-0") return `${cpuState.aluResult ?? 0}`;
      if (cleanPath === "path-mux-memtoreg-writedata") return `${controlSignals.MemToReg ? (cpuState.lastMemoryAccess?.value ?? 0) : (cpuState.aluResult ?? 0)}`;
      break;

    case 5: // Update PC
      const pcVal = cpuState.pc || 0;
      const branchTarget = pcVal + (immediate * 4);
      if (cleanPath === "path-pc-adder4" || cleanPath === "path-pc-branchadder") return `0x${pcVal.toString(16).padStart(8, "0")}`;
      if (cleanPath === "path-signext-shift") return `${immediate}`;
      if (cleanPath === "path-shift-branchadder") return `${immediate * 4}`;
      if (cleanPath === "path-adder4-mux-pcsrc-0") return `0x${(pcVal + 4).toString(16).padStart(8, "0")}`;
      if (cleanPath === "path-branchadder-mux-pcsrc-1") return `0x${branchTarget.toString(16).padStart(8, '0')}`;
      if (cleanPath === "path-mux-pcsrc-pc") return `0x${(controlSignals.PCSrc ? branchTarget : pcVal + 4).toString(16).padStart(8, "0")}`;
      if (cleanPath === "path-flags-zeroflagin") return cpuState.flags?.Z ? "1" : "0";
      break;
  }

  return "";
}

// === KẾT THÚC PHẦN THAY THẾ ===

function getParticleType(path: string): "data" | "address" | "control" {
  const cleanPath = path.replace(/^path-/, "").replace(/^signal-/, "")
  if (
    cleanPath.startsWith("signal") ||
    cleanPath.includes("control") ||
    cleanPath.includes("pcsrc") ||
    cleanPath.includes("branchand") ||
    cleanPath.includes("branch") ||
    cleanPath === "flags-zeroflagin" ||
    cleanPath === "alucontrol-aluop" ||
    cleanPath === "im-aluIn" ||
    cleanPath.includes("regwrite") ||
    cleanPath.includes("alusrc") ||
    cleanPath.includes("memread") ||
    cleanPath.includes("memwrite") ||
    cleanPath.includes("memtoreg") ||
    cleanPath.includes("reg2loc") ||
    cleanPath.includes("aluop") ||
    cleanPath.includes("flagwrite") ||
    cleanPath.includes("zerobranch") ||
    cleanPath.includes("uncondbranch") ||
    cleanPath.includes("uncondBranch-or") ||
    cleanPath.includes("and-to-or") ||
    cleanPath.includes("or-to-mux")
  )
    return "control"
  if (
    cleanPath.includes("pc") ||
    cleanPath.includes("addr") ||
    cleanPath.includes("im") ||
    cleanPath.includes("tgt") ||
    cleanPath.includes("target")
  )
    return "address"
  return "data"
}

function getParticleColor(type: "data" | "address" | "control", isDark: boolean): string {
  switch (type) {
    case "data":
      return isDark ? "#34d399" : "#059669" // Green for data
    case "address":
      return isDark ? "#a855f7" : "#7c3aed" // Purple for addresses
    case "control":
      return isDark ? "#f87171" : "#dc2626" // Red for control signals
    default:
      return isDark ? "#9ca3af" : "#6b7280"
  }
}

// Thêm vào component state
export function CpuSimulator() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1500, height: 1000 })
  const { state, setStepAnimating } = useSimulator()

  const [animationCompleted, setAnimationCompleted] = useState(false)

  // Add safe destructuring with default values
  const {
    currentMicroStep = 0,
    showAnimations = false,
    activeComponents = [],
    activePaths = [],
    activeSignals = [],
    isStepAnimating = false,
    cpuState = { pc: 0, flags: { N: false, Z: false, C: false, V: false } },
    program = [],
    currentInstruction = 0,
    registers = {},
    memory = {},
    controlSignals = {
      RegWrite: false,
      ALUSrc: false,
      MemRead: false,
      MemWrite: false,
      MemToReg: false,
      Reg2Loc: false,
      UncondBranch: false,
      ZeroBranch: false,
      PCSrc: false,
      FlagWrite: false,
    },
    isRunning = false,
    isPaused = false,
    executionSpeed = 1,
    instructionAssembly = "Idle",
  } = state || {}

  // Add pan/drag functionality for fullscreen
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isFullscreen) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !isFullscreen) return
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Add safe access for getCurrentInstructionAssembly function:
  // Thay đổi function getCurrentInstructionAssembly
  const getCurrentInstructionAssembly = () => {
    if (program && program.length > 0 && currentInstruction >= 0 && currentInstruction < program.length) {
      const instr = program[currentInstruction]
      return instr?.assembly || "Loading..."
    }
    if (program && program.length > 0 && currentInstruction >= program.length) return "Program Completed"
    return "Idle"
  }

  // Sử dụng trực tiếp thay vì fallback
  const currentInstructionText = getCurrentInstructionAssembly()

  // Use safe fallback for instructionAssembly
  const safeInstructionAssembly = instructionAssembly || getCurrentInstructionAssembly()

  // Thêm state cho fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Focus mode state
  const [focusMode, setFocusMode] = useState(false)

  // Animation engine - FIX: Remove setActiveComponents and setActivePaths from callbacks
  const [animationEngine] = useState(
    () =>
      new AnimationEngine({
        onStepStart: (step: AnimationStep) => {
          console.log(`Animation step started: ${step.componentId} -> ${step.pathId}`)
          // Remove the problematic calls - these will be handled by the simulator context
        },
        onStepComplete: (step: AnimationStep) => {
          console.log(`Animation step completed: ${step.componentId}`)
        },
        onSequenceComplete: (sequence: AnimationSequence) => {
          console.log(`Animation sequence completed for micro step ${sequence.microStep}`)
          setStepAnimating(false)
        },
      }),
  )

  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" || theme === "dark" : false
  const colors = isDark ? darkColors : lightColors

  // Animation state
  const [isPanningAnimation, setIsPanningAnimation] = useState(false)
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 })
  const [showTooltip, setShowTooltip] = useState<{ id: string; x: number; y: number } | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [showComponentDialog, setShowComponentDialog] = useState(false)

  // Enhanced sequential particle system with speed control
  const [particles, setParticles] = useState<Particle[]>([])
  const [illuminatedPaths, setIlluminatedPaths] = useState<Map<string, number>>(new Map())
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number | null>(null)
  const particleIdRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const lastActivePathsRef = useRef<string>("")
  const lastActiveSignalsRef = useRef<string>("")

  // Clear particles when paused or stopped
  useEffect(() => {
    if (isPaused || (!isRunning && (activePaths?.length || 0) === 0)) {
      setParticles([])
      setIlluminatedPaths(new Map())
      setIsAnimating(false)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPaused, isRunning, activePaths?.length])

  // Enhanced particle system với sequential animation và speed control
  useEffect(() => {
    if (!showAnimations || ((activePaths?.length || 0) === 0 && (activeSignals?.length || 0) === 0)) {
      if ((particles?.length || 0) > 0) {
        setParticles([])
        setIlluminatedPaths(new Map())
        setIsAnimating(false)
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
      }
      return
    }

    // Clear previous particles before spawning new ones
    setParticles([])
    setIlluminatedPaths(new Map())

    // Use animation engine for sequential flow
    if (state.datapathManager && state.componentStates) {
      const sequence = animationEngine.createSequence(currentMicroStep, state.componentStates)

      animationEngine.playSequence(currentMicroStep).then(() => {
        setIsAnimating(false)
        if (isStepAnimating) {
          setStepAnimating(false)
        }
      })
    } else {
      // Fallback to original particle system with speed control
      setTimeout(() => {
        spawnAllActivePaths()
      }, 100) // Small delay to ensure DOM is updated
    }
  }, [
    showAnimations,
    (activePaths || []).join(","),
    (activeSignals || []).join(","),
    currentMicroStep,
    state?.componentStates,
    executionSpeed,
  ])

  // Spawn particles for all active paths with speed control
  const spawnAllActivePaths = useCallback(() => {
    if (!showAnimations || ((activePaths?.length || 0) === 0 && (activeSignals?.length || 0) === 0)) return

    const newParticles: Particle[] = []
    const baseSpeed = 0.008 * executionSpeed // Multiply instead of divide for correct speed

    // Create particles for data/address paths
    for (const pathId of activePaths || []) {
      const pathElement =
        svgRef.current?.querySelector(`#path-${pathId}`) || svgRef.current?.querySelector(`#${pathId}`)
      if (pathElement && typeof (pathElement as SVGPathElement).getTotalLength === "function") {
        const pathLength = (pathElement as SVGPathElement).getTotalLength()
        const particleValue = getParticleValue(`path-${pathId}`, currentMicroStep, state)
        const particleType = getParticleType(`path-${pathId}`)

        newParticles.push({
          id: particleIdRef.current++,
          path: pathId,
          progress: 0,
          value: particleValue,
          type: particleType,
          size: 12, // Slightly larger for better visibility
          opacity: 1,
          speed: baseSpeed,
          startTime: performance.now(),
          pathLength,
          sequenceOrder: 0,
          isActive: true,
          color: getParticleColor(particleType, isDark),
        })
      }
    }

    // Create particles for control signals
    for (const signalName of activeSignals || []) {
      const signalPath = `signal-${signalName}`
      const pathElement = svgRef.current?.querySelector(`#${signalPath}`)
      if (pathElement && typeof (pathElement as SVGPathElement).getTotalLength === "function") {
        const pathLength = (pathElement as SVGPathElement).getTotalLength()
        const particleValue = getParticleValue(`signal-${signalName}`, currentMicroStep, state)

        newParticles.push({
          id: particleIdRef.current++,
          path: signalName,
          progress: 0,
          value: particleValue,
          type: "control",
          size: 12,
          opacity: 1,
          speed: baseSpeed,
          startTime: performance.now(),
          pathLength,
          sequenceOrder: 0,
          isActive: true,
          color: getParticleColor("control", isDark),
        })
      }
    }

    if (newParticles.length > 0) {
      setParticles(newParticles)

      if (!animationRef.current) {
        startAnimationLoop()
      }
    }

    setIsAnimating(false)
  }, [showAnimations, activePaths, activeSignals, currentMicroStep, state, isDark, executionSpeed])

  // Animation loop with speed control
  const startAnimationLoop = useCallback(() => {
    lastFrameTimeRef.current = performance.now()

    const animate = (currentTime: number) => {
      if (currentTime - lastFrameTimeRef.current < 16.67) {
        // Giới hạn 60 FPS
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTimeRef.current = currentTime

      setParticles((prevParticles) => {
        let hasActiveParticles = false
        const updatedParticles = prevParticles
          .map((p) => {
            const speedMultiplier = executionSpeed // Use executionSpeed directly
            const newProgress = p.progress + (p.speed || 0.008) * speedMultiplier
            if (newProgress < 1) {
              hasActiveParticles = true
              return { ...p, progress: newProgress }
            }
            return null
          })
          .filter((p) => p !== null)

        if (hasActiveParticles) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          animationRef.current = null
          setAnimationCompleted(true)
        }
        return updatedParticles as Particle[]
      })
    }
    animationRef.current = requestAnimationFrame(animate)
  }, [executionSpeed])

  useEffect(() => {
    if (animationCompleted) {
      // Add a small delay before marking step as complete
      setTimeout(() => {
        if (isStepAnimating) {
          setStepAnimating(false)
        }
        setAnimationCompleted(false)
      }, 200)
    }
  }, [animationCompleted, isStepAnimating, setStepAnimating])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Handle fullscreen mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "auto"
    }
  }, [isFullscreen])

  const exportImage = () => {
    if (!svgRef.current) return

    const svg = svgRef.current
    const serializer = new XMLSerializer()
    let source = serializer.serializeToString(svg)

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
    }

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)

    const link = document.createElement("a")
    link.href = url
    link.download = "legv8-datapath.svg"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleZoomIn = () => {
    setViewBox((prev) => ({
      x: prev.x + prev.width * 0.05,
      y: prev.y + prev.height * 0.05,
      width: prev.width * 0.9,
      height: prev.height * 0.9,
    }))
  }

  const handleZoomOut = () => {
    setViewBox((prev) => ({
      x: prev.x - prev.width * 0.055,
      y: prev.y - prev.height * 0.055,
      width: prev.width * 1.1,
      height: prev.height * 1.1,
    }))
  }

  const handleResetView = () => {
    setViewBox({ x: 0, y: 0, width: 1500, height: 1000 })
  }

  const handleComponentHover = (id: string, e: React.MouseEvent) => {
    setShowTooltip({
      id: id,
      x: e.clientX,
      y: e.clientY,
    })
  }

  const handleComponentLeave = () => {
    setShowTooltip(null)
  }

  const handleComponentClick = (id: string) => {
    setSelectedComponent(id)
    setShowComponentDialog(true)
  }

  // Enhanced stroke style function with theme support
  const getStrokeStyle = useMemo(() => {
    return (id: string, type: "component" | "path" | "signal") => {
      const baseStrokeWidth = type === "component" ? "2" : "2.5"
      const activeStrokeWidth = type === "component" ? "3" : "4"
      let strokeColor = colors.componentStroke
      let isActive = false
      let opacity = 1
      const cleanPathId = type === "path" ? id.replace(/^path-/, "") : id
      const cleanSignalId = type === "signal" ? id.replace(/^signal-/, "").toLowerCase() : id

      if (type === "component" && (activeComponents || []).includes(id)) {
        isActive = true
        strokeColor = colors.dataPathActiveStroke
      } else if (type === "path" && (activePaths || []).includes(cleanPathId)) {
        isActive = true
        strokeColor = colors.dataPathActiveStroke
      } else if (type === "signal" && (activeSignals || []).includes(cleanSignalId)) {
        isActive = true
        strokeColor = colors.controlPathActiveStroke
      } else {
        if (type === "path") strokeColor = colors.dataPathStroke
        else if (type === "signal") strokeColor = colors.controlPathStroke
      }

      // Apply focus mode dimming
      if (
        focusMode &&
        !isActive &&
        ((activeComponents?.length || 0) > 0 || (activePaths?.length || 0) > 0 || (activeSignals?.length || 0) > 0)
      ) {
        opacity = 0.3
      }

      return {
        stroke: strokeColor,
        strokeWidth: isActive ? activeStrokeWidth : baseStrokeWidth,
        filter: isActive ? `drop-shadow(0 0 4px ${strokeColor})` : "none",
        opacity: opacity,
        transition: "stroke 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease, opacity 0.3s ease",
      }
    }
  }, [activeComponents, activePaths, activeSignals, colors, focusMode])

  // Function to get progressive illumination style for paths
  const getProgressivePathStyle = useCallback(
    (pathId: string) => {
      const illuminatedLength = illuminatedPaths.get(pathId) || 0
      const pathElement = svgRef.current?.querySelector(`#${pathId}`)

      if (!pathElement || typeof (pathElement as SVGPathElement).getTotalLength !== "function") {
        return getStrokeStyle(pathId, pathId.startsWith("signal-") ? "signal" : "path")
      }

      const totalLength = (pathElement as SVGPathElement).getTotalLength()
      const illuminationRatio = totalLength > 0 ? illuminatedLength / totalLength : 0

      const baseStyle = getStrokeStyle(pathId, pathId.startsWith("signal-") ? "signal" : "path")

      if (illuminationRatio > 0 && illuminationRatio < 1) {
        const activeColor = pathId.startsWith("signal-") ? colors.controlPathActiveStroke : colors.dataPathActiveStroke
        return {
          ...baseStyle,
          strokeDasharray: `${illuminatedLength} ${totalLength - illuminatedLength}`,
          strokeDashoffset: 0,
          stroke: activeColor,
          strokeWidth: "4",
          filter: `drop-shadow(0 0 5px ${activeColor})`,
        }
      } else if (illuminationRatio >= 1) {
        const activeColor = pathId.startsWith("signal-") ? colors.controlPathActiveStroke : colors.dataPathActiveStroke
        return {
          ...baseStyle,
          stroke: activeColor,
          strokeWidth: "4",
          filter: `drop-shadow(0 0 5px ${activeColor})`,
        }
      }

      return baseStyle
    },
    [illuminatedPaths, getStrokeStyle, colors],
  )

  const fontStack = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`

  // Render the SVG content
  const renderSVGContent = () => (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className="w-full h-full bg-white dark:bg-gray-900 border rounded-lg text-xs"
    >
      <defs>
        <style>
          {`
            svg text {
              font-family: ${fontStack};
              font-weight: 400;
              fill: ${colors.textColor};
              paint-order: stroke;
              stroke-linejoin: round;
              stroke-linecap: round;
              kerning: 0;
              letter-spacing: 0.1px;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            .title-label { font-size: 26px; font-weight: 500; }
            .component-title { font-size: 14px; font-weight: 400; }
            .label-text { font-size: 11px; fill: ${colors.labelColor}; }
            .signal-label-text { font-size: 11px; fill: ${colors.signalLabelColor}; font-weight: 400; }
            .signal-value-text { font-size: 14px; fill: ${colors.signalValueColor}; font-family: monospace; font-weight: 500; }
            .data-value-text { font-size: 14px; fill: ${colors.dataValueColor}; font-family: monospace; font-weight: 400; }
            .address-value-text { font-size: 14px; fill: ${colors.addressColor}; font-family: monospace; font-weight: 400; }
            .mux-label { font-size: 12px; font-weight: 500; }
            .alu-label { font-size: 20px; font-weight: 500; }
            .flags-label { font-family: monospace; font-size: 12px; font-weight: 500; }
            .microstep-label { font-size: 15px; font-weight: 500; }
            .particle-value { font-size: 16px; stroke: rgba(0,0,0,0.8); stroke-width: 0.5px; fill: white; font-weight: 500; }
            .bit-label { font-size: 9px; fill: ${colors.labelColor}; font-style: italic; }
            
            /* Add transition effects for components */
            .component-transition {
              transition: stroke 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease, opacity 0.3s ease;
            }
            .path-transition {
              transition: stroke 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease, opacity 0.3s ease;
            }
            
            /* Hover effect for components */
            .component-hover:hover {
              filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.7));
              cursor: help;
            }
          `}
        </style>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(128, 128, 128, 0.1)" strokeWidth="0.5" />
        </pattern>

        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="5"
          refX="5.5"
          refY="2.5"
          orient="auto"
          fill={colors.dataPathStroke}
        >
          <polygon points="0 0, 6 2.5, 0 5" />
        </marker>

        <marker
          id="control-arrowhead"
          markerWidth="6"
          markerHeight="5"
          refX="5.5"
          refY="2.5"
          orient="auto"
          fill={colors.controlPathStroke}
        >
          <polygon points="0 0, 6 2.5, 0 5" />
        </marker>

        <marker
          id="address-arrowhead"
          markerWidth="6"
          markerHeight="5"
          refX="5.5"
          refY="2.5"
          orient="auto"
          fill={colors.addressColor}
        >
          <polygon points="0 0, 6 2.5, 0 5" />
        </marker>
      </defs>

      {/* SỬA LẠI: Sử dụng layout thủ công của bạn */}
      {/* Title */}
      <text x="750" y="50" textAnchor="middle" className="title-label">
        LEGv8 Single-Cycle Datapath
      </text>

      {/* Microstep Indicator - SỬA LẠI: Di chuyển gần PC */}
      <g transform="translate(70, 30)">
        <rect
          x="20"
          y="0"
          width="200"
          height="80"
          fill={colors.panelBg}
          stroke={colors.panelBorder}
          strokeWidth="2"
          rx="8"
          filter="drop-shadow(0 2px 8px rgba(0,0,0,0.1))"
        />
        <text x="120" y="25" textAnchor="middle" className="text-[15px] font-semibold">
          {currentMicroStep === 0 && "Fetch (1/6)"}
          {currentMicroStep === 1 && "Decode (2/6)"}
          {currentMicroStep === 2 && "Execute (3/6)"}
          {currentMicroStep === 3 && "Memory (4/6)"}
          {currentMicroStep === 4 && "Write Back (5/6)"}
          {currentMicroStep === 5 && "Update PC (6/6)"}
          {currentInstruction >= (program?.length || 0) && (program?.length || 0) > 0 && "Completed"}
          {(program?.length || 0) === 0 || currentMicroStep < 0 ? "Idle" : null}
        </text>
        <text x="120" y="45" textAnchor="middle" className="text-[12px] text-blue-600 dark:text-blue-400 font-mono">
          {currentInstructionText && currentInstructionText.length > 30
            ? currentInstructionText.substring(0, 27) + "..."
            : currentInstructionText}
        </text>
        <text x="120" y="65" textAnchor="middle" className="text-[11px] text-gray-500 dark:text-gray-400">
          PC: 0x{(cpuState?.pc || 0).toString(16).padStart(4, "0")} | Instr: {currentInstruction}/{program?.length || 0}
        </text>
      </g>

      {/* Enhanced Control Signals Display */}
      {currentMicroStep >= 1 && (
        <g transform="translate(90, 610)">
          {/* Hộp chứa đã được làm rộng và thấp hơn */}
          <rect
            x="0"
            y="0"
            width="260"
            height="150"
            fill={colors.panelBg}
            stroke={colors.panelBorder}
            strokeWidth="2"
            rx="8"
            filter="drop-shadow(0 2px 8px rgba(0,0,0,0.1))"
          />
          {/* Tiêu đề được căn giữa lại theo chiều rộng mới */}
          <text x="130" y="25" textAnchor="middle" className="text-[13px] font-semibold">
            Control Signals
          </text>

          {/* --- Các tín hiệu được sắp xếp lại thành 2 cột --- */}

          {/* Dòng 1 */}
          <text x="15" y="50" className="text-[11px] font-mono">
            RegWrite: <tspan className="signal-value-text">{controlSignals.RegWrite ? "1" : "0"}</tspan>
          </text>
          <text x="140" y="50" className="text-[11px] font-mono">
            ALUSrc: <tspan className="signal-value-text">{controlSignals.ALUSrc ? "1" : "0"}</tspan>
          </text>

          {/* Dòng 2 */}
          <text x="15" y="70" className="text-[11px] font-mono">
            MemRead: <tspan className="signal-value-text">{controlSignals.MemRead ? "1" : "0"}</tspan>
          </text>
          <text x="140" y="70" className="text-[11px] font-mono">
            MemWrite: <tspan className="signal-value-text">{controlSignals.MemWrite ? "1" : "0"}</tspan>
          </text>

          {/* Dòng 3 */}
          <text x="15" y="90" className="text-[11px] font-mono">
            MemToReg: <tspan className="signal-value-text">{controlSignals.MemToReg ? "1" : "0"}</tspan>
          </text>
          <text x="140" y="90" className="text-[11px] font-mono">
            Reg2Loc: <tspan className="signal-value-text">{controlSignals.Reg2Loc ? "1" : "0"}</tspan>
          </text>

          {/* Dòng 4 */}
          <text x="15" y="110" className="text-[11px] font-mono">
            Branch: <tspan className="signal-value-text">{controlSignals.UncondBranch ? "1" : "0"}</tspan>
          </text>
          <text x="140" y="110" className="text-[11px] font-mono">
            ZeroBranch: <tspan className="signal-value-text">{controlSignals.ZeroBranch ? "1" : "0"}</tspan>
          </text>

          {/* Dòng 5 - Tín hiệu còn lại */}
          <text x="15" y="130" className="text-[11px] font-mono">
            PCSrc: <tspan className="signal-value-text">{controlSignals.PCSrc ? "1" : "0"}</tspan>
          </text>
        </g>
      )}
      {/* === Components - SỬA LẠI: Sử dụng layout đã cải thiện === */}

      {/* PC */}
      <g
        id="pc"
        style={{
          ...getStrokeStyle("pc", "component"),
        }}
        className="component-transition component-hover cursor-pointer"
        onMouseEnter={(e) => handleComponentHover("pc", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("pc")}
      >
        <rect x="110" y="475" width="70" height="75" fill={colors.componentFill} stroke="currentColor" rx="6" />
        <text x="145" y="505" textAnchor="middle" className="component-title">
          PC
        </text>
        <text x="145" y="530" textAnchor="middle" className="address-value-text">
          0x{(cpuState?.pc || 0).toString(16).padStart(4, "0")}
        </text>
      </g>

      {/* PC+4 Adder - SỬA LẠI: Cải thiện vị trí */}
      <g
        id="pc-adder-4"
        style={getStrokeStyle("pc-adder-4", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("pc-adder-4", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(0, -55)"
      >
        {/* Thân của khối Add */}
        <path
          d="M 280 180 L 350 210 L 350 270 L 280 300 L 280 255 L 300 240 L 280 230 Z"
          fill={colors.componentFill}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Nhãn "Add" bên trong khối */}
        <text x="320" y="245" textAnchor="middle" className="component-title">
          Add
        </text>

        {/* Nhãn số "4", đã được dời sang trái một chút */}
        <text x="245" y="278" textAnchor="end" className="label-text">
          4
        </text>

        <path
          d="M 250 275 H 279"
          fill="none"
          stroke={colors.dataPathStroke}
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
      </g>

      {/* Instruction Memory - SỬA LẠI: Cải thiện vị trí */}
      <g
        id="instruction-memory"
        style={{
          ...getStrokeStyle("instruction-memory", "component"),
        }}
        className="component-transition component-hover cursor-pointer"
        onMouseEnter={(e) => handleComponentHover("instruction-memory", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("instruction-memory")}
        transform="translate(-40, 30)"
      >
        <rect
          x="270"
          y="430"
          width="140"
          height="135"
          fill={colors.componentFill}
          stroke="currentColor"
          rx="6"
          strokeWidth="2"
        />
        <text x="340" y="450" textAnchor="middle" className="component-title">
          Instruction
        </text>
        <text x="340" y="470" textAnchor="middle" className="component-title">
          Memory
        </text>
        <text x="310" y="500" textAnchor="middle" className="label-text">
          Read Addr
        </text>
        <text x="365" y="525" textAnchor="middle" className="label-text">
          Instr Out [31:0]
        </text>
        <text x="340" y="550" textAnchor="middle" className="text-[11px] font-mono text-blue-500 dark:text-blue-400">
          {currentInstructionText && currentInstructionText.length > 20
            ? currentInstructionText.substring(0, 18) + "..."
            : currentInstructionText}
        </text>
      </g>

      {/* Control Unit - Fix layout gọn gàng và căn giữa chính xác */}
      <g
        id="control-unit"
        style={{
          ...getStrokeStyle("control-unit", "component"),
        }}
        className="component-transition component-hover cursor-pointer"
        onMouseEnter={(e) => handleComponentHover("control-unit", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("control-unit")}
        transform="translate(-60, 55)"
      >
        {/* Thu nhỏ ellipse, chỉnh vừa nội dung */}
        <ellipse
          cx="550"
          cy="310"
          rx="50"
          ry="100"
          fill={colors.controlFill}
          stroke={colors.controlStroke}
          strokeWidth="2"
        />
        {/* Căn chữ Control Unit đúng giữa ellipse */}
        <text x="550" y="305" textAnchor="middle" className="component-title">
          Control
        </text>
        <text x="550" y="325" textAnchor="middle" className="component-title">
          Unit
        </text>

        {/* Input signal */}
        <text x="455" y="310" textAnchor="end" className="label-text">
          Opcode[31:21]
        </text>

        {/* Các control signals: thu sát lại và đều hàng */}
        {[
          "Reg2Loc",
          "UncondBranch",
          "FlagBranch",
          "ZeroBranch",
          "MemRead",
          "MemToReg",
          "MemWrite",
          "FlagWrite",
          "ALUSrc",
          "ALUOp",
          "RegWrite",
        ].map((label, index) => (
          <text
            key={label}
            x="615" // kéo gần về control unit
            y={230 + index * 16} // giãn dòng nhỏ hơn
            textAnchor="start"
            className="signal-label-text"
          // style={{ stroke: "none" }}
          >
            {label}
          </text>
        ))}
      </g>

      {/* Reg2Loc MUX - SỬA LẠI: Cải thiện vị trí và labels */}
      <g
        id="reg2loc-mux"
        style={getStrokeStyle("reg2loc-mux", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("reg2loc-mux", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(-40, -50)"
      >
        {/* Thay thế <path> bằng <rect> để tạo hình viên thuốc */}
        <rect
          x="490" // Vị trí bắt đầu theo trục X
          y="555" // Vị trí bắt đầu theo trục Y
          width="40" // Chiều rộng của MUX
          height="90" // Chiều cao của MUX
          rx="20" // Bán kính bo tròn trục X (một nửa chiều rộng để tạo hình tròn)
          ry="20" // Bán kính bo tròn trục Y
          fill={colors.muxFill}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Chỉnh lại vị trí các nhãn cho phù hợp với hình dạng mới */}
        <text x="510" y="585" textAnchor="middle" className="mux-label">
          M
        </text>
        <text x="510" y="605" textAnchor="middle" className="mux-label">
          U
        </text>
        <text x="510" y="625" textAnchor="middle" className="mux-label">
          X
        </text>
        <text x="480" y="570" textAnchor="end" className="text-[11px]">
          0
        </text>
        <text x="480" y="640" textAnchor="end" className="text-[11px]">
          1
        </text>

        {/* Nhãn tín hiệu điều khiển có thể đặt ở dưới */}
        <text x="510" y="670" textAnchor="middle" className="signal-label-text">
          Reg2Loc
        </text>
        <text x="510" y="685" textAnchor="middle" className="signal-value-text">
          {controlSignals.Reg2Loc ? "1" : "0"}
        </text>
      </g>

      {/* Register File - SỬA LẠI: Cải thiện vị trí */}
      <g
        id="registers"
        style={{
          ...getStrokeStyle("registers", "component"),
        }}
        className="component-transition component-hover cursor-pointer"
        onMouseEnter={(e) => handleComponentHover("registers", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("registers")}
        transform="translate(-40, -40)"
      >
        <rect
          x="580"
          y="510"
          width="200"
          height="155"
          fill={colors.componentFill}
          stroke="currentColor"
          rx="6"
          strokeWidth="2"
        />
        <text x="680" y="530" textAnchor="middle" className="component-title">
          Registers
        </text>
        <text x="585" y="560" textAnchor="start" className="label-text">
          Read Reg 1 [9:5]
        </text>
        <text x="775" y="560" textAnchor="end" className="label-text">
          Read Data 1 Out
        </text>
        <text x="585" y="590" textAnchor="start" className="label-text">
          Read Reg 2 [MUX]
        </text>
        <text x="775" y="590" textAnchor="end" className="label-text">
          Read Data 2 Out
        </text>
        <text x="585" y="620" textAnchor="start" className="label-text">
          Write Reg [4:0]
        </text>
        <text x="585" y="650" textAnchor="start" className="label-text">
          Write Data In
        </text>
        <text x="775" y="650" textAnchor="end" className="signal-label-text">
          RegWrite In
        </text>
        {cpuState.lastRegisterAccess && (
          <text x="680" y="730" textAnchor="middle" className="data-value-text">
            {cpuState.lastRegisterAccess.register}={cpuState.lastRegisterAccess.value}
          </text>
        )}
      </g>

      {/* Sign Extend - SỬA LẠI: Di chuyển gần ALU và MUX */}
      <g
        id="sign-extend"
        style={getStrokeStyle("sign-extend", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("sign-extend", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(-40, -50)"
      >
        <ellipse cx="680" cy="800" rx="50" ry="30" fill={colors.componentFill} stroke="currentColor" strokeWidth="2" />
        <text x="680" y="795" textAnchor="middle" className="component-title">
          Sign-
        </text>
        <text x="680" y="810" textAnchor="middle" className="component-title">
          extend
        </text>
        <text x="620" y="790" textAnchor="end" className="label-text">
          32
        </text>
        <text x="740" y="790" textAnchor="start" className="label-text">
          64
        </text>
      </g>

      {/* ALUSrc MUX - SỬA LẠI: Di chuyển gần ALU */}
      <g
        id="alusrc-mux"
        style={getStrokeStyle("alusrc-mux", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("alusrc-mux", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(-40, -50)" // Giữ lại transform để di chuyển cả khối
      >
        {/* Thay thế <path> bằng <rect> để tạo hình viên thuốc */}
        <rect
          x="830"
          y="605"
          width="40"
          height="90"
          rx="20"
          ry="20"
          fill={colors.muxFill}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Chỉnh lại vị trí các nhãn */}
        <text x="850" y="635" textAnchor="middle" className="mux-label">
          M
        </text>
        <text x="850" y="655" textAnchor="middle" className="mux-label">
          U
        </text>
        <text x="850" y="675" textAnchor="middle" className="mux-label">
          X
        </text>
        <text x="820" y="623" textAnchor="end" className="text-[11px]">
          0
        </text>
        <text x="820" y="695" textAnchor="end" className="text-[11px]">
          1
        </text>
        <text x="850" y="730" textAnchor="middle" className="signal-label-text">
          ALUSrc
        </text>
        <text x="850" y="745" textAnchor="middle" className="signal-value-text">
          {controlSignals.ALUSrc ? "1" : "0"}
        </text>
      </g>

      {/* ALU - SỬA LẠI: Căn chỉnh tốt hơn */}
      <g
        id="alu"
        style={{
          ...getStrokeStyle("alu", "component"),
        }}
        className="component-transition component-hover cursor-pointer"
        onMouseEnter={(e) => handleComponentHover("alu", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("alu")}
        transform="translate(-40, -50)" // Giữ lại transform
      >
        {/* Thuộc tính 'd' đã được điều chỉnh để khối nhỏ hơn */}
        <path
          d="M 930 550 L 1020 570 L 1020 630 L 930 650 L 930 620 L 955 605 L 930 590 Z"
          fill={colors.aluFill}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Vị trí các nhãn đã được căn chỉnh lại */}
        <text x="985" y="610" textAnchor="middle" className="alu-label">
          ALU
        </text>
        <text x="990" y="583" textAnchor="start" className="label-text">
          Zero
        </text>
        {cpuState.aluResult !== undefined && (
          <text x="975" y="625" textAnchor="middle" className="data-value-text">
            0x{cpuState.aluResult.toString(16).padStart(4, "0")}
          </text>
        )}
      </g>

      {/* ALU Control - SỬA LẠI: Di chuyển gần ALU */}
      <g
        id="alu-control"
        style={getStrokeStyle("alu-control", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("alu-control", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("alu")}
        transform="translate(-140, -60)"
      >
        {/* Elip đã được thu nhỏ bằng cách giảm rx và ry */}
        <ellipse
          cx="1020" // Giữ nguyên tâm để không bị dịch chuyển quá nhiều
          cy="800"
          rx="65" // Giảm từ 80
          ry="45" // Giảm từ 60
          fill={colors.controlFill}
          stroke={colors.controlStroke}
          strokeWidth="2"
        />
        {/* Các nhãn đã được căn chỉnh lại cho vừa với hình mới */}
        <text x="1020" y="795" textAnchor="middle" className="component-title">
          ALU
        </text>
        <text x="1020" y="810" textAnchor="middle" className="component-title">
          Control
        </text>
      </g>

      {/* Flags - SỬA LẠI: Cải thiện vị trí và sửa chiều mũi tên */}
      <g
        id="flags"
        style={{
          ...getStrokeStyle("flags", "component"),
        }}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("flags", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("flags")}
        transform="translate(-230, -80)"
      >
        {/* Hình chữ nhật đã được thu nhỏ */}
        <rect
          x="1110" // Dịch sang phải một chút để cân đối
          y="505"
          width="110" // Giảm từ 130
          height="40" // Giảm từ 50
          fill={colors.flagsFill}
          stroke="currentColor"
          rx="4"
          strokeWidth="2"
        />
        {/* Các nhãn đã được căn chỉnh lại */}
        <text x="1120" y="530" textAnchor="start" className="flags-label">
          N
        </text>
        <text x="1145" y="530" textAnchor="start" className="flags-label">
          Z
        </text>
        <text x="1170" y="530" textAnchor="start" className="flags-label">
          C
        </text>
        <text x="1195" y="530" textAnchor="start" className="flags-label">
          V
        </text>
        <text x="1165" y="495" textAnchor="middle" className="signal-label-text">
          FlagWr In
        </text>
        <text x="1120" y="520" textAnchor="start" className="signal-value-text">
          {cpuState.flags?.N ? "1" : "0"}
        </text>
        <text x="1145" y="520" textAnchor="start" className="signal-value-text">
          {cpuState.flags?.Z ? "1" : "0"}
        </text>
        <text x="1170" y="520" textAnchor="start" className="signal-value-text">
          {cpuState.flags?.C ? "1" : "0"}
        </text>
        <text x="1195" y="520" textAnchor="start" className="signal-value-text">
          {cpuState.flags?.V ? "1" : "0"}
        </text>
      </g>

      {/* Data Memory */}
      <g
        id="data-memory"
        style={{
          ...getStrokeStyle("data-memory", "component"),
        }}
        className="component-transition component-hover cursor-pointer"
        onMouseEnter={(e) => handleComponentHover("data-memory", e)}
        onMouseLeave={handleComponentLeave}
        onClick={() => handleComponentClick("data-memory")}
        transform="translate(-230, -20)"
      >
        {/* Hình chữ nhật đã được thu nhỏ hơn nữa, đặc biệt là chiều cao */}
        <rect
          x="1290"
          y="565" // Dịch xuống một chút
          width="180" // Giữ nguyên chiều rộng
          height="160" // Giảm đáng kể từ 220
          fill={colors.componentFill}
          stroke="currentColor"
          rx="6"
          strokeWidth="2"
        />

        {/* Các nhãn được co lại gần nhau hơn */}
        <text x="1380" y="610" textAnchor="middle" className="component-title">
          Data
        </text>
        <text x="1380" y="628" textAnchor="middle" className="component-title">
          Memory
        </text>
        <text x="1300" y="655" textAnchor="start" className="label-text">
          Address In
        </text>
        <text x="1300" y="685" textAnchor="start" className="label-text">
          Write Data In
        </text>
        <text x="1460" y="655" textAnchor="end" className="label-text">
          Read Data Out
        </text>
        <text x="1380" y="580" textAnchor="middle" className="signal-label-text">
          MemRead In
        </text>
        <text x="1380" y="720" textAnchor="middle" className="signal-label-text">
          MemWrite In
        </text>
        {cpuState.lastMemoryAccess && (
          <text x="1380" y="680" textAnchor="middle" className="address-value-text">
            Addr: 0x{cpuState.lastMemoryAccess.address.toString(16).padStart(4, "0")}
          </text>
        )}
      </g>

      {/* MemToReg MUX */}
      <g
        id="memtoreg-mux"
        style={getStrokeStyle("memtoreg-mux", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("memtoreg-mux", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(110, -70)"
      >
        {/* Thay thế <path> bằng <rect> với kích thước 40x90 */}
        <rect
          x="1160" // Vị trí X
          y="660" // Vị trí Y
          width="40" // Chiều rộng mong muốn
          height="90" // Chiều cao mong muốn
          rx="20" // Bo tròn góc bằng một nửa chiều rộng
          ry="20"
          fill={colors.muxFill}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Căn chỉnh lại các nhãn cho vừa vặn */}
        <text x="1180" y="695" textAnchor="middle" className="mux-label">
          M
        </text>
        <text x="1180" y="710" textAnchor="middle" className="mux-label">
          U
        </text>
        <text x="1180" y="725" textAnchor="middle" className="mux-label">
          X
        </text>
        <text x="1210" y="680" textAnchor="start" className="text-[11px]">
          0
        </text>
        <text x="1210" y="730" textAnchor="start" className="text-[11px]">
          1
        </text>
        <text x="1180" y="765" textAnchor="middle" className="signal-label-text">
          MemToReg
        </text>
        <text x="1180" y="780" textAnchor="middle" className="signal-value-text">
          {controlSignals.MemToReg ? "1" : "0"}
        </text>
      </g>

      {/* Branch Components - SỬA LẠI: Cải thiện layout */}

      {/* Shift Left - SỬA LẠI: Căn chỉnh với branch adder */}
      <g
        id="shift-left"
        style={getStrokeStyle("shift-left", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("shift-left", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(0, 45)"
      >
        <circle cx="850" cy="220" r="35" fill={colors.componentFill} stroke="currentColor" strokeWidth="2" />
        <text x="850" y="215" textAnchor="middle" className="component-title">
          Shift
        </text>
        <text x="850" y="230" textAnchor="middle" className="component-title">
          left 2
        </text>
      </g>

      {/* Branch Adder - SỬA LẠI: Căn chỉnh với shift left */}
      <g
        id="branch-adder"
        style={getStrokeStyle("branch-adder", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("branch-adder", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(-20, -10)"
      >
        {/* Thuộc tính 'd' đã được thay đổi để tạo vết lõm */}
        <path
          d="M 950 170 L 1020 200 L 1020 260 L 950 290 L 950 250 L 975 230 L 950 210 Z"
          fill={colors.componentFill}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Căn chỉnh lại chữ "Add" một chút */}
        <text x="990" y="235" textAnchor="middle" className="component-title">
          Add
        </text>
      </g>

      {/* PC MUX - SỬA LẠI: Di chuyển gần PC */}
      <g
        id="pc-mux"
        style={getStrokeStyle("pc-mux", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("pc-mux", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(-50, -60)"
      >
        {/* Thay thế <path> bằng <rect> với kích thước 40x90 */}
        <rect
          x="1155" // Vị trí X
          y="190" // Vị trí Y
          width="40" // Chiều rộng mong muốn
          height="90" // Chiều cao mong muốn
          rx="20" // Bo tròn góc bằng một nửa chiều rộng
          ry="20"
          fill={colors.muxFill}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Căn chỉnh lại các nhãn cho vừa vặn */}
        <text x="1175" y="225" textAnchor="middle" className="mux-label">
          M
        </text>
        <text x="1175" y="240" textAnchor="middle" className="mux-label">
          U
        </text>
        <text x="1175" y="255" textAnchor="middle" className="mux-label">
          X
        </text>
        <text x="1205" y="210" textAnchor="start" className="text-[11px]">
          0
        </text>
        <text x="1205" y="260" textAnchor="start" className="text-[11px]">
          1
        </text>
        <text x="1135" y="285" textAnchor="middle" className="signal-label-text">
          PCSrc
        </text>
        <text x="1135" y="300" textAnchor="middle" className="signal-value-text">
          {controlSignals.PCSrc ? "1" : "0"}
        </text>
      </g>

      {/* Branch Logic Unit - CBZ AND Gate */}
      <g
        id="branch-logic-unit-cbz"
        style={getStrokeStyle("branch-logic-unit", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("branch-logic-unit", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(110, 190) scale(0.8)"
      >
        <path
          d="M 1050 130 L 1080 130 Q 1100 130 1100 150 Q 1100 170 1080 170 L 1050 170 Z"
          fill={colors.componentFill}
          stroke="currentColor"
          strokeWidth="2"
        />
        <text x="1075" y="155" textAnchor="middle" className="text-xl font-light">
          &
        </text>
      </g>

      {/* Branch Logic Unit - CBNZ AND Gate */}
      <g
        id="branch-logic-unit-cbnz"
        style={getStrokeStyle("branch-logic-unit", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("branch-logic-unit", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(190, 210) scale(0.8)"
      >
        <path
          d="M 1050 130 L 1080 130 Q 1100 130 1100 150 Q 1100 170 1080 170 L 1050 170 Z"
          fill={colors.componentFill}
          stroke="currentColor"
          strokeWidth="2"
        />
        <text x="1075" y="155" textAnchor="middle" className="text-xl font-light">
          &
        </text>
      </g>

      {/* OR Gate - SỬA LẠI: Thêm OR gate từ snippet */}
      <g
        id="jump-or-gate"
        style={getStrokeStyle("jump-or-gate", "component")}
        className="component-transition component-hover"
        onMouseEnter={(e) => handleComponentHover("jump-or-gate", e)}
        onMouseLeave={handleComponentLeave}
        transform="translate(1100, 255)"
      >
        <path
          d=" M 10 0 Q 25 20, 10 40 Q 35 40, 70 20 Q 35 0, 10 0 Z "
          fill={colors.componentFill}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <text x="40" y="25" textAnchor="middle" className="text-lg font-light">
          OR
        </text>
      </g>

      {/* === WIRES (Paths) - SỬA LẠI: Sử dụng routing đã cải thiện từ snippet === */}

      {/* --- STAGE 1 & 2: FETCH & DECODE --- */}
      <path
        id="path-pc-im"
        d="M 180 512 H 200 V 525 H 230" // PC.out -> InstructionMemory.in
        fill="none"
        style={getProgressivePathStyle("path-pc-im")}
        markerEnd="url(#address-arrowhead)"
        className="path-transition"
      />

      {/* inm to AlU control in */}
      <path
        id="path-im-aluIn"
        d="M 370 550 H 390 V 750 H 550 V 788 H 790 V 745 H 815" // IM.instr -> ALUControl.in
        fill="none"
        style={getProgressivePathStyle("path-im-aluIn")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />

      <path
        id="path-im-control"
        d="M 370 550 H 390 V 360 H 435" // IM.instr -> ControlUnit.opcode
        fill="none"
        style={getProgressivePathStyle("path-im-control")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-im-readreg1"
        d="M 370 550 H 400 V 480 H 520 V 516 H 540" // IM.instr[rs1] -> Registers.ReadReg1
        fill="none"
        style={getProgressivePathStyle("path-im-readreg1")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-im-mux-reg2loc-0"
        d="M 370 550 H 430 V 525 H 450" // IM.instr[rt] -> Mux.0
        fill="none"
        style={getProgressivePathStyle("path-im-mux-reg2loc-0")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-im-mux-reg2loc-1"
        d="M 370 550 H 430 V 575 H 450" // IM.instr[rd] -> Mux.1
        fill="none"
        style={getProgressivePathStyle("path-im-mux-reg2loc-1")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-mux-reg2loc-readreg2"
        d="M 490 550 H 540" // Mux.out -> Registers.ReadReg2
        fill="none"
        style={getProgressivePathStyle("path-mux-reg2loc-readreg2")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-im-writereg"
        d="M 370 550 H 430 V 610 H 515 V 575 H 540" // Trùng với path-im-mux-reg2loc-1, nhưng đi tới WriteReg
        fill="none"
        style={getProgressivePathStyle("path-im-writereg")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-im-signext"
        d="M 370 550 H 390 V 750 H 590" // IM.instr[imm] -> SignExtend.in
        fill="none"
        style={getProgressivePathStyle("path-im-signext")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />

      {/* --- STAGE 3: EXECUTE --- */}
      <path
        id="path-readreg1-alu"
        d="M 740 515 H 890" // Registers.ReadData1 -> ALU.in1
        fill="none"
        style={getProgressivePathStyle("path-readreg1-alu")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-readreg2-mux-alusrc-0"
        d="M 740 545 H 750 V 580 H 790" // Registers.ReadData2 -> ALUSrcMux.0
        fill="none"
        style={getProgressivePathStyle("path-readreg2-mux-alusrc-0")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-signext-mux-alusrc-1"
        d="M 690 750 H 760 V 630 H 790" // SignExtend.out -> ALUSrcMux.1
        fill="none"
        style={getProgressivePathStyle("path-signext-mux-alusrc-1")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-mux-alusrc-alu"
        d="M 830 605 H 860 V 585 H 890" // ALUSrcMux.out -> ALU.in2
        fill="none"
        style={getProgressivePathStyle("path-mux-alusrc-alu")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-alucontrol-aluop"
        d="M 945 740 H 955 V 588" // ALUControl.out -> ALU.op
        fill="none"
        style={getProgressivePathStyle("path-alucontrol-aluop")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="path-alu-flags"
        d="M 980 530 H 995 V 320 H 1030" // ALU.zero -> Flags.in
        fill="none"
        style={getProgressivePathStyle("path-alu-flags")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />

      {/* --- STAGE 4 & 5: MEMORY & WRITE BACK --- */}
      <path
        id="path-alu-memaddr"
        d="M 980 550 H 1000 V 630 H 1060" // ALU.Result -> DataMemory.Address
        fill="none"
        style={getProgressivePathStyle("path-alu-memaddr")}
        markerEnd="url(#address-arrowhead)"
        className="path-transition"
      />
      <path
        id="path-readreg2-memwrite"
        d="M 740 545 H 750 V 660 H 1060" // Registers.ReadData2 -> DataMemory.WriteData
        fill="none"
        style={getProgressivePathStyle("path-readreg2-memwrite")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-memread-mux-memtoreg-1"
        d="M 1240 630 H 1250 V 660 H 1270" // DataMemory.ReadData -> MemToRegMux.1
        fill="none"
        style={getProgressivePathStyle("path-memread-mux-memtoreg-1")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-alu-mux-memtoreg-0"
        d="M 980 550 H 1000 V 530 H 1250 V 610 H 1270" // ALU.Result -> MemToRegMux.0
        fill="none"
        style={getProgressivePathStyle("path-alu-mux-memtoreg-0")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-mux-memtoreg-writedata"
        d="M 1310 635 H 1340 V 798 H 523 V 605 H 540" // MemToRegMux.out -> Registers.WriteData
        fill="none"
        style={getProgressivePathStyle("path-mux-memtoreg-writedata")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />

      {/* --- PC UPDATE & BRANCHING LOGIC --- */}
      <path
        id="path-pc-adder4"
        d="M 180 512 H 200 V 155 H 280" // PC.out -> PC+4 Adder.in1
        fill="none"
        style={getProgressivePathStyle("path-pc-adder4")}
        markerEnd="url(#address-arrowhead)"
        className="path-transition"
      />
      <path
        id="path-adder4-mux-pcsrc-0"
        d="M 350 185 H 500 V 150 H 1105" // PC+4 Adder.out -> PCMux.0
        fill="none"
        style={getProgressivePathStyle("path-adder4-mux-pcsrc-0")}
        markerEnd="url(#address-arrowhead)"
        className="path-transition"
      />
      <path
        id="path-mux-pcsrc-pc"
        d="M 1145 175 H 1220 V 120 H 90 V 512 H 110" // PCMux.out -> PC.in
        fill="none"
        style={getProgressivePathStyle("path-mux-pcsrc-pc")}
        markerEnd="url(#address-arrowhead)"
        className="path-transition"
      />
      <path
        id="path-pc-branchadder"
        d="M 200 280 H 380 V 220 H 600 V 180 H 930" // Tap from PC+4 path -> BranchAdder.in1
        fill="none"
        style={getProgressivePathStyle("path-pc-branchadder")}
        markerEnd="url(#address-arrowhead)"
        className="path-transition"
      />
      <path
        id="path-signext-shift"
        d="M 710 750 H 760 V 267 H 814" // SignExtend.out -> ShiftLeft2.in
        fill="none"
        style={getProgressivePathStyle("path-signext-shift")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-shift-branchadder"
        d="M 885 265 H 929" // ShiftLeft2.out -> BranchAdder.in2
        fill="none"
        style={getProgressivePathStyle("path-shift-branchadder")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-branchadder-mux-pcsrc-1"
        d="M 1000 220 H 1050 V 200 H 1105" // BranchAdder.out -> PCMux.1
        fill="none"
        style={getProgressivePathStyle("path-branchadder-mux-pcsrc-1")}
        markerEnd="url(#address-arrowhead)"
        className="path-transition"
      />

      {/* === CONTROL SIGNALS (Paths) === */}
      <path
        id="signal-regwrite"
        d="M 518 450 H 645 V 470" // ControlUnit.RegWrite -> Registers.RegWriteIn
        fill="none"
        style={getProgressivePathStyle("signal-regwrite")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="signal-alusrc"
        d="M 534 417 H 810 V 555" // ControlUnit.ALUSrc -> ALUSrcMux.select
        fill="none"
        style={getProgressivePathStyle("signal-alusrc")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="signal-memread"
        d="M 540 353 H 1150 V 543" // ControlUnit.MemRead -> DataMemory.MemReadIn
        fill="none"
        style={getProgressivePathStyle("signal-memread")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="signal-memwrite"
        d="M 540 385 H 1030 V 750 H 1150 V 708" // ControlUnit.MemWrite -> DataMemory.MemWriteIn
        fill="none"
        style={getProgressivePathStyle("signal-memwrite")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="signal-memtoreg"
        d="M 541 370 H 1290 V 585" // ControlUnit.MemToReg -> MemToRegMux.select
        fill="none"
        style={getProgressivePathStyle("signal-memtoreg")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="signal-reg2loc"
        d="M 525 288 H 610 V 250 H 420 V 490 H 470 V 505" // ControlUnit.Reg2Loc -> Reg2LocMux.select
        fill="none"
        style={getProgressivePathStyle("signal-reg2loc")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="signal-aluop"
        d="M 527 433 H 850 V 640 H 880 V 690" // ControlUnit.ALUOp -> ALUControl.in
        fill="none"
        style={getProgressivePathStyle("signal-aluop")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="signal-flagwrite"
        d="M 536 401 H 935 V 425" // ControlUnit.FlagWrite -> Flags.WriteEnable
        fill="none"
        style={getProgressivePathStyle("signal-flagwrite")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />

      {/* Branch Control Signals - SỬA LẠI: Thêm các đường dây mới */}
      <path
        id="signal-zerobranch"
        d="M 537 337 H 1030"
        fill="none"
        style={getProgressivePathStyle("signal-zerobranch")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />
      <path
        id="path-flags-zeroflagin"
        d="M 935 425 V 300 H 950"
        fill="none"
        style={getProgressivePathStyle("path-flags-zeroflagin")}
        markerEnd="url(#arrowhead)"
        className="path-transition"
      />
      <path
        id="path-branchlogic-pcsrc"
        d="M 537 321 H 950"
        fill="none"
        style={getProgressivePathStyle("path-branchlogic-pcsrc")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />

      <path
        id="uncondBranch-or"
        d="M 530 304 H 900 V 290 H 1110" // Unconditional branch signal path
        fill="none"
        style={getProgressivePathStyle("uncondBranch-or")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />

      {/* and to or */}
      <path
        id="and-to-or"
        d="M 990 310 H 1020 V 260 H 1110" // Path from AND gate to OR gate
        fill="none"
        style={getProgressivePathStyle("and-to-or")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />

      <path
        id="and-to-or-2"
        d="M 1070 330 H 1090 V 275 H 1110" // Path from AND gate to OR gate
        fill="none"
        style={getProgressivePathStyle("and-to-or-2")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />

      {/* or to mux */}
      <path
        id="or-to-mux"
        d="M 1170 275 H 1200 V 245 H 1128 V 220" // Path from OR gate to MUX
        fill="none"
        style={getProgressivePathStyle("or-to-mux")}
        strokeDasharray="6,6"
        markerEnd="url(#control-arrowhead)"
        className="path-transition"
      />

      {/* === PARTICLES === */}
      {particles.map((particle) => {
        const pathElement =
          svgRef.current?.querySelector(`#path-${particle.path}`) ||
          svgRef.current?.querySelector(`#signal-${particle.path}`) ||
          svgRef.current?.querySelector(`#${particle.path}`)
        if (!pathElement || typeof (pathElement as SVGPathElement).getPointAtLength !== "function") {
          return null
        }

        const pathLength = (pathElement as SVGPathElement).getTotalLength()
        if (pathLength === 0) return null

        const point = (pathElement as SVGPathElement).getPointAtLength(particle.progress * pathLength)
        const particleSize = particle.size || 12

        return (
          <g key={particle.id} opacity={particle.opacity || 1}>
            {/* Enhanced particle circle with better visibility */}
            <circle
              cx={point.x}
              cy={point.y}
              r={particleSize / 2}
              fill={particle.color || getParticleColor(particle.type, isDark)}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="2"
              filter="drop-shadow(0 0 4px rgba(0,0,0,0.5))"
            />
            {/* Enhanced particle value text with better formatting */}
            {particle.value && particle.value !== "" && (
              <text
                x={point.x}
                y={point.y - particleSize - 6}
                textAnchor="middle"
                className="particle-value"
                fontSize="14"
                fontWeight="600"
                fill="white"
                stroke="rgba(0,0,0,0.8)"
                strokeWidth="0.5"
              >
                {particle.value}
              </text>
            )}
          </g>
        )
      })}

      {/* Enhanced bit field labels for instruction fields */}
      {currentMicroStep === 1 && (program || [])[currentInstruction] && (
        <g>
          <text x="370" y="440" textAnchor="start" className="bit-label">
            [31:21] Opcode
          </text>
          <text x="370" y="500" textAnchor="start" className="bit-label">
            [9:5] Rs1
          </text>
          <text x="370" y="520" textAnchor="start" className="bit-label">
            [20:16] Rs2
          </text>
          <text x="370" y="540" textAnchor="start" className="bit-label">
            [4:0] Rd
          </text>
          <text x="370" y="560" textAnchor="start" className="bit-label">
            [31:0] Full Instruction
          </text>
        </g>
      )}
    </svg>
  )

  const handleWheel = (e: React.WheelEvent) => {
    if (!isFullscreen) return
    e.preventDefault()

    if (e.deltaY < 0) {
      handleZoomIn()
    } else {
      handleZoomOut()
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Controls overlay */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullscreen(true)}
                className="bg-white/90 dark:bg-gray-800/90"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Focus datapath (fullscreen)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={exportImage} className="bg-white/90 dark:bg-gray-800/90">
                <Camera className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export as SVG image</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleZoomIn} className="bg-white/90 dark:bg-gray-800/90">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom in</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleZoomOut} className="bg-white/90 dark:bg-gray-800/90">
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom out</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleResetView}
                className="bg-white/90 dark:bg-gray-800/90"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset view</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={focusMode ? "default" : "outline"}
                size="icon"
                onClick={() => setFocusMode(!focusMode)}
                className="bg-white/90 dark:bg-gray-800/90"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{focusMode ? "Exit focus mode" : "Focus on active components"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Component tooltip */}
      {showTooltip && (
        <div
          className="absolute z-20 bg-black/90 text-white px-3 py-2 rounded-lg text-sm max-w-xs shadow-lg"
          style={{
            left: showTooltip.x,
            top: showTooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {componentDescriptions[showTooltip.id as keyof typeof componentDescriptions]}
        </div>
      )}

      {/* Normal view */}
      {!isFullscreen && renderSVGContent()}

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
          {/* Top bar with controls - reorganized layout */}
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between p-3">
              {/* Left side - Compact control panel */}
              <div className="flex-1 max-w-4xl">
                <ControlPanel isCompact={true} />
              </div>

              {/* Right side - View controls */}
              <div className="flex items-center gap-2 ml-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportImage}
                        className="bg-white/90 dark:bg-gray-800/90"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export as SVG image</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleZoomIn}
                        className="bg-white/90 dark:bg-gray-800/90"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Zoom in</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleZoomOut}
                        className="bg-white/90 dark:bg-gray-800/90"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Zoom out</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetView}
                        className="bg-white/90 dark:bg-gray-800/90"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset view</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={focusMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFocusMode(!focusMode)}
                        className="bg-white/90 dark:bg-gray-800/90"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{focusMode ? "Exit focus mode" : "Focus on active components"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFullscreen(false)}
                        className="bg-white/90 dark:bg-gray-800/90"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exit fullscreen (ESC)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* NEW: Current Instruction Display */}
            <div className="px-3 pb-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Current Instruction:</div>
                    <div className="text-lg font-mono font-semibold text-blue-900 dark:text-blue-100">
                      {currentInstructionText}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-blue-600 dark:text-blue-400">
                    <span>PC: 0x{(cpuState?.pc || 0).toString(16).padStart(4, "0")}</span>
                    <span>
                      Step: {currentInstruction + 1}/{program?.length || 0}
                    </span>
                    <span>
                      Phase: {currentMicroStep === 0 && "Fetch"}
                      {currentMicroStep === 1 && "Decode"}
                      {currentMicroStep === 2 && "Execute"}
                      {currentMicroStep === 3 && "Memory"}
                      {currentMicroStep === 4 && "Write Back"}
                      {currentMicroStep === 5 && "Update PC"}
                      {currentMicroStep < 0 && "Idle"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fullscreen datapath with pan support */}
          <div
            className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              className="w-full h-full"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                transition: isPanning ? "none" : "transform 0.1s ease-out",
              }}
            >
              {renderSVGContent()}
            </div>

            {/* Pan instructions */}
            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
              Click and drag to pan • Scroll to zoom
            </div>
          </div>
        </div>
      )}

      {/* Component Detail Dialog */}
      <ComponentDetailDialog
        componentId={selectedComponent}
        isOpen={showComponentDialog}
        onClose={() => {
          setShowComponentDialog(false)
          setSelectedComponent(null)
        }}
      />
    </div>
  )
}
