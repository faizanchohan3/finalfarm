"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getStatusColor } from "@/lib/utils"
import Link from "next/link"
import { CheckSquare } from "lucide-react"

export function TasksSummary() {
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/tasks?limit=5&status=PENDING,IN_PROGRESS")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {})
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">My Notes</CardTitle>
        <Link href="/tasks" className="text-xs text-purple-700 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No pending notes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any) => (
              <div key={task.id} className="flex items-start gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${getStatusColor(task.priority)}`}>
                  {task.priority}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                  <p className="text-xs text-gray-400">{task.assignedTo?.name || "Unassigned"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
