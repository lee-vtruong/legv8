"use client"

import { useRef, useEffect } from "react"
import { useSimulator } from "@/lib/context"

export function ExecutionLog() {
  const { state } = useSimulator()
  const { executionLog } = state
  const logEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll only within the container, not the whole page
  useEffect(() => {
    if (logEndRef.current && containerRef.current) {
      // Only scroll the container itself, not the page
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [executionLog])

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-1 font-mono text-xs"
      style={{ overscrollBehavior: "contain", scrollBehavior: "auto" }}
    >
      {executionLog.length > 0 ? (
        executionLog.slice(-5).map((log, index) => (
          <div
            key={index}
            className={`py-0.5 ${
              log.type === "error"
                ? "text-red-600 dark:text-red-400"
                : log.type === "warning"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {log.message}
          </div>
        ))
      ) : (
        <div className="py-0.5 text-gray-500">No execution logs yet</div>
      )}
      <div ref={logEndRef} />
    </div>
  )
}
