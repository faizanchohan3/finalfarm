"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, getStatusColor } from "@/lib/utils"
import { Plus, CheckCircle, Clock, AlertCircle, Edit, Trash2, User } from "lucide-react"

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [filter, setFilter] = useState("ALL")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    title: "", description: "", assignedToId: "", priority: "MEDIUM",
    dueDate: "", status: "PENDING",
  })

  async function loadData() {
    try {
      setLoading(true)
      const [tr, ur] = await Promise.all([
        fetch("/api/tasks").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ])
      setTasks(tr.tasks || [])
      setUsers(ur.users || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ title: "", description: "", assignedToId: "", priority: "MEDIUM", dueDate: "", status: "PENDING" })
    setShowModal(true)
  }

  function openEdit(t: any) {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description || "",
      assignedToId: t.assignedToId || "unassigned",
      priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
      status: t.status,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title) return alert("Title required")
    const url = editing ? `/api/tasks/${editing.id}` : "/api/tasks"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, assignedToId: (form.assignedToId && form.assignedToId !== "unassigned") ? form.assignedToId : null, dueDate: form.dueDate || null }),
    })
    if (res.ok) { setShowModal(false); loadData() }
  }

  async function quickStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    loadData()
  }

  const filtered = tasks.filter((t) => filter === "ALL" || t.status === filter)

  const counts = {
    ALL: tasks.length,
    PENDING: tasks.filter((t) => t.status === "PENDING").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    COMPLETED: tasks.filter((t) => t.status === "COMPLETED").length,
  }

  const priorityIcon = (p: string) => {
    if (p === "URGENT") return <AlertCircle className="w-3 h-3 text-red-500" />
    if (p === "HIGH") return <AlertCircle className="w-3 h-3 text-orange-500" />
    return <Clock className="w-3 h-3 text-gray-400" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notes</h2>
          <p className="text-gray-500 text-sm">Assign and track work</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4" /> New Note</Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? "bg-purple-700 text-blue-900"
                : "bg-blue-50 text-gray-600 border border-blue-300 hover:bg-blue-50"
            }`}
          >
            {status.replace("_", " ")} ({counts[status as keyof typeof counts] ?? tasks.length})
          </button>
        ))}
      </div>

      {/* Tasks Grid */}
      {loading && !tasks.length ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((task) => (
            <Card key={task.id} className={`hover:shadow-md transition-shadow ${task.status === "COMPLETED" ? "opacity-70" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    {priorityIcon(task.priority)}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.priority)}`}>{task.priority}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </span>
                </div>

                <h3 className={`font-semibold text-gray-800 mb-1 ${task.status === "COMPLETED" ? "line-through text-gray-400" : ""}`}>
                  {task.title}
                </h3>
                {task.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{task.description}</p>}

                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                  <User className="w-3 h-3" />
                  <span>{task.assignedTo?.name || "Unassigned"}</span>
                  {task.dueDate && (
                    <>
                      <span>â€¢</span>
                      <Clock className="w-3 h-3" />
                      <span className={new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "text-red-500" : ""}>
                        Due {formatDate(task.dueDate)}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {task.status !== "COMPLETED" && (
                      <button
                        onClick={() => quickStatus(task.id, task.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED")}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-green-50 rounded"
                        title={task.status === "PENDING" ? "Start" : "Complete"}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openEdit(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(task.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">By {task.createdBy?.name}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No notes found</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Note" : "New Note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Note title" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional details..." /></div>
            <div>
              <Label>Assign To</Label>
              <Select value={form.assignedToId} onValueChange={(v) => setForm({ ...form, assignedToId: v })}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter((u: any) => u.isActive).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role.replace("_", " ")})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            {editing && (
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1">{editing ? "Update" : "Create Note"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

