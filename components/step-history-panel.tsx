"use client"

import { useSimulator } from "@/lib/context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Undo, Redo } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function StepHistoryPanel() {
  const { state, undoStep, redoStep, canUndo, canRedo } = useSimulator()
  const { stepHistory, currentHistoryIndex, isRunning, isExecuting } = state

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Step History</h3>
        <div className="flex items-center space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={undoStep} disabled={!canUndo || isRunning || isExecuting}>
                  <Undo className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo last step (Ctrl+Z)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={redoStep} disabled={!canRedo || isRunning || isExecuting}>
                  <Redo className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo step (Ctrl+Y)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <ScrollArea className="h-32">
        <div className="space-y-1">
          {stepHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No steps executed yet</p>
          ) : (
            stepHistory.map((step, index) => (
              <div
                key={step.stepId}
                className={`text-xs p-2 rounded border transition-colors ${
                  index === currentHistoryIndex
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : index < currentHistoryIndex
                      ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      : "bg-gray-25 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60"
                }`}
              >
                <div className="font-medium">{step.description}</div>
                <div className="text-muted-foreground text-[10px] mt-1">
                  <span>PC: 0x{step.cpuState.pc.toString(16).padStart(4, "0")}</span>
                  <span className="mx-2">•</span>
                  <span>Phase: {step.microStep + 1}/6</span>
                  <span className="mx-2">•</span>
                  <span>{formatTimestamp(step.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="flex justify-between items-center mt-3 pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          {stepHistory.length > 0 ? `${currentHistoryIndex + 1}/${stepHistory.length}` : "0/0"}
        </span>
        <div className="flex items-center space-x-1">
          <span className="text-xs text-muted-foreground">Can undo: {canUndo ? "Yes" : "No"}</span>
          <span className="text-xs text-muted-foreground">Can redo: {canRedo ? "Yes" : "No"}</span>
        </div>
      </div>
    </div>
  )
}
