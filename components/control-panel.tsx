"use client"

import { useState } from "react"
import { useSimulator } from "@/lib/context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Play, Square, RotateCcw, StepForward, FastForward, Zap, ZapOff, Settings, Undo } from "lucide-react"


interface ControlPanelProps {
  isCompact?: boolean
}

export function ControlPanel({ isCompact = false }: ControlPanelProps) {
  const {
    state,
    toggleRunning,
    togglePaused,
    reset,
    executeNextMicroStep,
    executeNextInstruction,
    startContinuousExecution,
    toggleAnimations,
    undoInstruction,
    runTests,
    setExecutionSpeed,
  } = useSimulator()

  const {
    isRunning,
    isPaused,
    currentInstruction,
    currentMicroStep,
    program,
    showAnimations,
    executionSpeed,
    cpuState,
    isStepAnimating,
    isExecuting,
    currentHistoryIndex,
  } = state

  // const [isRunTestsLoading, setIsRunTestsLoading] = useState(false)
  const [isFullInstructionRunning, setIsFullInstructionRunning] = useState(false)

  // const handleRunTests = async () => {
  //   setIsRunTestsLoading(true)
  //   try {
  //     await runTests()
  //   } finally {
  //     setIsRunTestsLoading(false)
  //   }
  // }

  const handleStep = () => {
    if (!isExecuting && !isFullInstructionRunning) {
      executeNextMicroStep()
    }
  }

  const handleFullInstruction = async () => {
    if (!isExecuting && !isFullInstructionRunning) {
      setIsFullInstructionRunning(true)
      try {
        await executeNextInstruction()
      } finally {
        setIsFullInstructionRunning(false)
      }
    }
  }

  const handleContinuousExecution = async () => {
    if (!isRunning) {
      toggleRunning()
      await startContinuousExecution()
      toggleRunning() // Tự động dừng khi hoàn thành
    } else {
      toggleRunning()
    }
  }

  const getExecutionStatus = () => {
    if (isRunning && !isPaused) return "Running"
    if (isPaused) return "Paused"
    if (currentInstruction >= program.length && program.length > 0) return "Completed"
    if (isStepAnimating) return "Animating"
    return "Stopped"
  }

  const getStepInfo = () => {
    const stepNames = ["Fetch", "Decode", "Execute", "Memory", "Write Back", "Update PC"]
    if (currentMicroStep >= 0 && currentMicroStep < stepNames.length) {
      return `${stepNames[currentMicroStep]}: ${currentMicroStep + 1}/6`
    }
    return "Idle"
  }

  const getInstructionInfo = () => {
    if (program.length === 0) return "No program loaded"
    if (currentInstruction >= program.length) return `Finished: ${program.length}/${program.length}`
    return `Instr: ${currentInstruction + 1}/${program.length}`
  }

  const canExecute = program.length > 0 && currentInstruction < program.length
  const canUndoInstruction = currentInstruction > 0 && !isRunning && !isExecuting;
  const isAnyExecuting = isExecuting || isFullInstructionRunning

  if (isCompact) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg p-3 shadow-lg border">
        <div className="flex flex-wrap gap-2 items-center justify-center">
          <Button
            onClick={handleContinuousExecution}
            disabled={!canExecute || isFullInstructionRunning}
            size="sm"
            variant={isRunning ? "destructive" : "default"}
            className="flex-1 min-w-[80px]"
          >
            {isRunning ? (
              <>
                <Square className="h-4 w-4 mr-1" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Start
              </>
            )}
          </Button>

          <Button onClick={handleStep} disabled={!canExecute || isAnyExecuting} size="sm" variant="outline">
            <StepForward className="h-4 w-4 mr-1" />
            Step
          </Button>

          <Button onClick={reset} disabled={isAnyExecuting} size="sm" variant="outline">
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>

          <Button
            onClick={toggleAnimations}
            size="sm"
            variant="outline"
            className={showAnimations ? "bg-blue-50 dark:bg-blue-900/20" : ""}
          >
            {showAnimations ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Execution Control
          </CardTitle>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant={getExecutionStatus() === "Running" ? "default" : "secondary"}>{getExecutionStatus()}</Badge>
          <Badge variant="outline">{getStepInfo()}</Badge>
          <Badge variant="outline">{getInstructionInfo()}</Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            {showAnimations ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            Animations
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleStep}
            disabled={!canExecute || isAnyExecuting}
            variant="outline"
            className="flex items-center justify-center gap-2"
          >
            <StepForward className="h-4 w-4" />
            Step
          </Button>
          <Button
            onClick={handleFullInstruction}
            disabled={!canExecute || isAnyExecuting}
            variant="outline"
            className="flex items-center justify-center gap-2"
          >
            <FastForward className="h-4 w-4" />
            Full Instr
          </Button>
        </div>

        {/* Main Control - FIXED: Start/Stop button */}
        <Button
          onClick={handleContinuousExecution}
          disabled={!canExecute || isFullInstructionRunning}
          className={`w-full h-12 text-lg font-medium ${isRunning ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"
            }`}
        >
          {isRunning ? (
            <>
              <Square className="h-5 w-5 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              Start
            </>
          )}
        </Button>

        <Separator />

        {/* FIXED: Reset and Run Tests on same row */}
        {/* <div className="grid grid-cols-2 gap-2"> */}
        <div className="grid grid-cols-1 gap-2"> 
          {/* <Button
            onClick={undoInstruction}
            disabled={!canUndoInstruction}
            variant="outline"
            className="flex items-center justify-center gap-2"
            title="Go back to the start of the previous instruction"
          >
            <Undo className="h-4 w-4" />
            Undo Instr
          </Button> */}
          <Button
            onClick={reset}
            disabled={isAnyExecuting}
            variant="outline"
            className="flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Animation Toggle */}
        <Button
          onClick={toggleAnimations}
          variant="outline"
          className={`w-full ${showAnimations ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : ""}`}
        >
          {showAnimations ? (
            <>
              <ZapOff className="h-4 w-4 mr-2" />
              Disable Animations
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Enable Animations
            </>
          )}
        </Button>

        <Separator />

        {/* Animation Speed Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Animation Speed</span>
            <span className="text-xs text-muted-foreground">{executionSpeed}x</span>
          </div>
          <Slider
            value={[executionSpeed]}
            onValueChange={(value) => setExecutionSpeed(value[0])}
            min={1}
            max={5}
            step={1}
            className="w-full"
            disabled={isStepAnimating || isRunning}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
