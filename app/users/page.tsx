"use client"
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Search, Plus, MoreVertical, Fingerprint, Hash, X, 
  ChevronLeft, ChevronRight, UserCheck, UserX, 
  Edit, Trash2, Eye, KeyRound, CheckCircle2, AlertCircle, RefreshCw,
  HardDrive, Radio, Layers, Clock, Cpu
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSystemMode } from '@/context/SystemModeContext'

interface UserItem {
  id: string
  name: string
  role: 'Student' | 'Staff' | 'Admin'
  status: 'Active' | 'Inactive'
  dateRegistered: string
  totalAttendance: number
  lateOccurrences: number
  hasFingerprint: boolean
  hasPin: boolean
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("All Roles")
  const [statusFilter, setStatusFilter] = useState("All Status")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6

  // Add User Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newRole, setNewRole] = useState<"Student" | "Staff" | "Admin">("Student")
  const [newUserId, setNewUserId] = useState("")
  const [userIdError, setUserIdError] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const getSuggestedKeypadId = (role: "Student" | "Staff" | "Admin", userList: UserItem[]) => {
    let maxNum = 0;
    for (const u of userList) {
      const match = u.id.match(/^0*(\d+)[A-Za-z]?$/i) || u.id.match(/(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    const suffix = role === 'Staff' ? 'B' : role === 'Admin' ? 'C' : 'A';
    return `${String(nextNum).padStart(3, '0')}${suffix}`;
  };
  
  // Actions Dropdown & Modals
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [viewingUser, setViewingUser] = useState<UserItem | null>(null)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editRole, setEditRole] = useState<"Student" | "Staff" | "Admin">("Student")
  const [editStatus, setEditStatus] = useState<"Active" | "Inactive">("Active")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev)
    }, 3500)
  }

  // Live Terminal Fingerprint Enrollment Modal
  const [enrollFpUser, setEnrollFpUser] = useState<UserItem | null>(null)
  const [terminals, setTerminals] = useState<Array<{ id: string; name?: string; status: string; freeSlots?: number }>>([])
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('DEV_TERM_01')
  const [targetSlot, setTargetSlot] = useState<number>(1)
  const [fpEnrollStatus, setFpEnrollStatus] = useState<'IDLE' | 'ARMING' | 'PENDING_TERMINAL_PICKUP' | 'WAITING_FOR_FINGER' | 'SUCCESS' | 'FAILED'>('IDLE')
  const [fpStatusMsg, setFpStatusMsg] = useState<string>('')
  const [fpFailureReason, setFpFailureReason] = useState<string>('')
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  // PIN Management Modal
  const [pinUser, setPinUser] = useState<UserItem | null>(null)
  const [pinValue, setPinValue] = useState("")
  const [confirmPinValue, setConfirmPinValue] = useState("")
  const [pinError, setPinError] = useState("")
  const [isSavingPin, setIsSavingPin] = useState(false)

  const { isSimulationMode, simState } = useSystemMode()

  // Delete User Confirmation
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = useCallback(() => {
    if (isSimulationMode) return

    fetch('/api/users')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setUsers(data)
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
      })
  }, [isSimulationMode])

  // Fetch terminals for enrollment
  useEffect(() => {
    if (isSimulationMode) return
    fetch('/api/devices')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setTerminals(data)
          if (data.length > 0 && !selectedTerminalId) {
            setSelectedTerminalId(data[0].id)
          }
        }
      })
      .catch(console.error)
  }, [isSimulationMode, selectedTerminalId])

  useEffect(() => {
    let active = true
    if (!isSimulationMode) {
      fetch('/api/users')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (active && Array.isArray(data)) {
            setUsers(data)
            setLoading(false)
          }
        })
        .catch(() => {
          if (active) setLoading(false)
        })
    }
    const handleClickOutside = () => setOpenDropdown(null)
    document.addEventListener('click', handleClickOutside)
    return () => {
      active = false
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isSimulationMode])

  const displayedUsers: UserItem[] = isSimulationMode
    ? simState.users.map(u => ({
        ...u,
        hasFingerprint: true,
        hasPin: true
      }))
    : users

  const handleOpenEnrollModal = async (user: UserItem) => {
    setEnrollFpUser(user)
    setFpEnrollStatus('IDLE')
    setFpStatusMsg('')
    setFpFailureReason('')
    setElapsedSeconds(0)

    if (isSimulationMode) {
      setTargetSlot(1)
      return
    }

    try {
      const res = await fetch(`/api/devices/enrollment?deviceId=${encodeURIComponent(selectedTerminalId || 'DEV_TERM_01')}`)
      const data = res.ok ? await res.json() : null
      if (data && data.totalEnrolledInDb !== undefined) {
        setTargetSlot(data.totalEnrolledInDb + 1)
      } else {
        setTargetSlot(1)
      }
    } catch {
      setTargetSlot(1)
    }
  }

  const handleDispatchEnrollCommand = async () => {
    if (!enrollFpUser) return
    const targetId = enrollFpUser.id
    const targetName = enrollFpUser.name
    const targetDev = selectedTerminalId || 'DEV_TERM_01'

    setFpEnrollStatus('ARMING')
    setFpStatusMsg(`Queuing enrollment command for terminal ${targetDev}...`)
    setFpFailureReason('')
    setElapsedSeconds(0)

    if (isSimulationMode) {
      setTimeout(() => {
        setFpEnrollStatus('WAITING_FOR_FINGER')
        setFpStatusMsg(`[SIMULATION] Terminal armed for ${targetName}. Place finger on sensor twice (Slot #${targetSlot})...`)
        setTimeout(() => {
          setFpEnrollStatus('SUCCESS')
          setFpStatusMsg(`[SIMULATION] Confirmed! Enrolled fingerprint for ${targetName} into Slot #${targetSlot}.`)
          setUsers(prev => prev.map(u => u.id === targetId ? { ...u, hasFingerprint: true } : u))
          showNotification(`[SIMULATION] Fingerprint enrolled for ${targetName}.`)
        }, 2000)
      }, 1000)
      return
    }

    try {
      const armRes = await fetch('/api/devices/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'QUEUE_ENROLLMENT',
          deviceId: targetDev,
          userId: targetId,
          slotNumber: Number(targetSlot)
        })
      })

      if (!armRes.ok) {
        throw new Error('Failed to queue terminal enrollment command.')
      }

      const armData = armRes.ok ? await armRes.json().catch(() => null) : null
      const currentJobId = armData?.job?.jobId

      setFpEnrollStatus('PENDING_TERMINAL_PICKUP')
      setFpStatusMsg(`Command queued in Firestore! Waiting for terminal ${targetDev} to fetch command on next heartbeat...`)

      const startTime = Date.now()
      const timerInterval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)

      let attempts = 0
      const maxAttempts = 45 // 90s timeout (every 2s)
      const pollInterval = setInterval(async () => {
        attempts++
        try {
          const pollRes = await fetch(`/api/devices/enrollment?jobId=${currentJobId}&deviceId=${encodeURIComponent(targetDev)}`)
          if (pollRes.ok) {
            const pollData = await pollRes.json().catch(() => ({}))

            if (pollData.status === 'PENDING_SCAN' || pollData.status === 'SCANNING' || pollData.status === 'EXECUTING') {
              setFpEnrollStatus('WAITING_FOR_FINGER')
              setFpStatusMsg(`Terminal armed & active! Waiting for ${targetName} to place finger twice on DY50 optical sensor (Slot #${targetSlot})...`)
            } else if (pollData.status === 'COMPLETED' || pollData.status === 'SUCCESS') {
              clearInterval(pollInterval)
              clearInterval(timerInterval)
              setFpEnrollStatus('SUCCESS')
              setFpStatusMsg(`Hardware confirmed! Successfully registered fingerprint for ${targetName} in Slot #${targetSlot}!`)
              setUsers(prev => prev.map(u => u.id === targetId ? { ...u, hasFingerprint: true } : u))
              showNotification(`Fingerprint registered for ${targetName} on terminal ${targetDev}.`)
              fetchUsers()
              return
            } else if (pollData.status === 'FAILED' || pollData.status === 'ERROR') {
              clearInterval(pollInterval)
              clearInterval(timerInterval)
              setFpEnrollStatus('FAILED')
              setFpFailureReason(pollData.job?.reason || pollData.reason || 'Terminal reported scan failure or sensor timeout.')
              return
            }
          }
        } catch {
          // Continue polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval)
          clearInterval(timerInterval)
          setFpEnrollStatus('FAILED')
          setFpFailureReason('Enrollment timed out: No hardware scan completion received after 90 seconds. Ensure ESP32 is powered on and finger placed firmly twice.')
        }
      }, 2000)

    } catch (err: unknown) {
      setFpEnrollStatus('FAILED')
      setFpFailureReason(err instanceof Error ? err.message : 'Error dispatching enrollment command')
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return

    const cleanId = (newUserId || getSuggestedKeypadId(newRole, displayedUsers)).trim().toUpperCase()
    if (!/^[0-9]+[A-Za-z]$/.test(cleanId)) {
      setUserIdError("User ID must start with 0-9 numeric digits and end with a single letter (e.g. 001A, 102B)")
      return
    }

    setIsAdding(true)
    const addingName = newName.trim()
    const addingRole = newRole

    if (isSimulationMode) {
      const newSimUser: UserItem = {
        id: cleanId,
        name: addingName,
        role: addingRole,
        status: 'Active',
        dateRegistered: new Date().toISOString(),
        totalAttendance: 0,
        lateOccurrences: 0,
        hasFingerprint: false,
        hasPin: false
      }
      simState.users.unshift(newSimUser)
      showNotification(`[SIMULATION] User ${addingName} (${cleanId}) registered successfully.`)
      setIsModalOpen(false)
      setNewName("")
      setNewUserId("")
      setIsAdding(false)
      return
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cleanId, name: addingName, role: addingRole })
      })
      const created = await res.json().catch(() => ({}))
      if (!res.ok) {
        showNotification(created?.error || "Failed to add user.", "error")
        return
      }

      if (created && created.id) {
        setUsers(prev => [created, ...prev])
        showNotification(`User ${created.name} (${created.id}) added successfully.`)
      } else {
        showNotification(`User ${addingName} created.`)
      }
      setIsModalOpen(false)
      setNewName("")
      setNewUserId("")
      setNewRole("Student")
      fetchUsers()
    } catch (err) {
      console.error(err)
      showNotification("Failed to add user. Please try again.", "error")
    } finally {
      setIsAdding(false)
    }
  }

  const toggleStatus = async (user: UserItem) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u))
    showNotification(`User ${user.name} is now ${newStatus}.`)
    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      fetchUsers()
    } catch (err) {
      console.error(err)
      showNotification("Failed to update status on server.", "error")
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser || !editName.trim()) return
    const targetId = editingUser.id
    const updatedName = editName.trim()
    const updatedRole = editRole
    const updatedStatus = editStatus

    setIsSavingEdit(true)
    setUsers(prev => prev.map(u => u.id === targetId ? {
      ...u,
      name: updatedName,
      role: updatedRole,
      status: updatedStatus
    } : u))
    setEditingUser(null)
    showNotification(`Changes saved for ${updatedName}.`)

    try {
      const res = await fetch(`/api/users/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedName,
          role: updatedRole,
          status: updatedStatus
        })
      })
      if (!res.ok) {
        showNotification("Warning: Server update returned an error.", "error")
      }
      fetchUsers()
    } catch (err) {
      console.error(err)
      showNotification("Failed to sync edit with cloud database.", "error")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinUser) return
    if (!/^\d{4,6}$/.test(pinValue)) {
      setPinError("PIN must be 4 to 6 numeric digits")
      return
    }
    if (pinValue !== confirmPinValue) {
      setPinError("PIN confirmation does not match")
      return
    }

    const targetId = pinUser.id
    const targetName = pinUser.name
    setIsSavingPin(true)
    setPinError("")

    setUsers(prev => prev.map(u => u.id === targetId ? { ...u, hasPin: true } : u))
    setPinUser(null)
    showNotification(`Keypad PIN configured for ${targetName}.`)

    try {
      await fetch(`/api/users/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue })
      })
      setPinValue("")
      setConfirmPinValue("")
      fetchUsers()
    } catch (err) {
      setPinError("Failed to update PIN")
      console.error(err)
      showNotification("Failed to update PIN on cloud server.", "error")
    } finally {
      setIsSavingPin(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    const targetId = deletingUser.id
    const targetName = deletingUser.name

    setIsDeleting(true)
    setUsers(prev => prev.filter(u => u.id !== targetId))
    setDeletingUser(null)
    showNotification(`User ${targetName} deleted permanently.`)

    try {
      const res = await fetch(`/api/users/${targetId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        showNotification("Failed to delete user on cloud server.", "error")
      }
      fetchUsers()
    } catch (err) {
      console.error(err)
      showNotification(`Error deleting user ${targetName}.`, "error")
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredUsers = displayedUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "All Roles" || user.role === roleFilter
    const matchesStatus = statusFilter === "All Status" || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const startIndex = filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(filteredUsers.length, currentPage * pageSize)

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage students, staff, hardware credentials, and authentication methods.</p>
        </div>
        <button 
          onClick={() => {
            const suggested = getSuggestedKeypadId(newRole, displayedUsers);
            setNewUserId(suggested);
            setUserIdError("");
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 shadow-sm w-full sm:w-auto mt-2 sm:mt-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Add User
        </button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or User ID..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <select 
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Roles</option>
              <option>Student</option>
              <option>Staff</option>
            </select>
            <select 
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto min-h-[320px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-medium">User Details</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Authentication</th>
                <th className="px-6 py-4 font-medium">Total Attendance</th>
                <th className="px-6 py-4 font-medium">Late</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="inline-flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading users directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : paginatedUsers.map((user, index) => (
                <tr key={user.id} className="bg-white hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{user.name}</span>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200" title="Keypad User ID">
                          {user.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Keypad ID</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-full inline-block",
                      user.role === 'Student' ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-purple-50 text-purple-700 border border-purple-100"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div 
                        className={cn(
                          "p-1.5 rounded flex items-center space-x-1 text-xs font-medium border", 
                          user.hasFingerprint ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
                        )} 
                        title={user.hasFingerprint ? "Fingerprint Registered" : "No Fingerprint"}
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>{user.hasFingerprint ? "FP" : "No FP"}</span>
                      </div>
                      <div 
                        className={cn(
                          "p-1.5 rounded flex items-center space-x-1 text-xs font-medium border", 
                          user.hasPin ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-200"
                        )} 
                        title={user.hasPin ? "PIN Active" : "No PIN"}
                      >
                        <Hash className="w-3.5 h-3.5" />
                        <span>{user.hasPin ? "PIN" : "No PIN"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {user.totalAttendance} days
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "font-medium inline-flex items-center px-2 py-0.5 rounded text-xs",
                      user.lateOccurrences > 0 ? "bg-amber-50 text-amber-700 font-semibold" : "text-slate-600"
                    )}>
                      {user.lateOccurrences} {user.lateOccurrences === 1 ? 'time' : 'times'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={cn("w-2 h-2 rounded-full mr-2", user.status === 'Active' ? "bg-emerald-500" : "bg-slate-300")}></div>
                      <span className={cn("text-xs font-medium", user.status === 'Active' ? "text-slate-900" : "text-slate-500")}>
                        {user.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1 relative">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingUser(user);
                          setEditName(user.name);
                          setEditRole(user.role);
                          setEditStatus(user.status);
                          setOpenDropdown(null);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                        title="Edit User Details"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingUser(user);
                          setOpenDropdown(null);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setOpenDropdown(openDropdown === user.id ? null : user.id); 
                        }}
                        className={cn(
                          "p-1.5 rounded-md transition-colors border",
                          openDropdown === user.id 
                            ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm" 
                            : "text-slate-500 hover:text-slate-900 border-transparent hover:border-slate-200 hover:bg-slate-100"
                        )}
                        title="More Actions"
                        aria-haspopup="true"
                        aria-expanded={openDropdown === user.id}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdown === user.id && (
                        <div 
                          onClick={(e) => e.stopPropagation()} 
                          className={cn(
                            "absolute right-0 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1.5 text-left text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100",
                            index >= 3 ? "bottom-full mb-2" : "top-full mt-2"
                          )}
                        >
                          <div className="px-3.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Actions: {user.name} ({user.id})
                          </div>
                          
                          <div className="py-1">
                            <button 
                              type="button"
                              onClick={() => { setViewingUser(user); setOpenDropdown(null); }}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors"
                            >
                              <Eye className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-xs">View User Profile</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                setEditingUser(user);
                                setEditName(user.name);
                                setEditRole(user.role);
                                setEditStatus(user.status);
                                setOpenDropdown(null);
                              }}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center space-x-2.5 transition-colors"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-xs">Edit Details</span>
                            </button>
                          </div>

                          <div className="py-1">
                            <button 
                              type="button"
                              onClick={() => {
                                setOpenDropdown(null);
                                handleOpenEnrollModal(user);
                              }}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center space-x-2.5 transition-colors font-medium"
                            >
                              <Fingerprint className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs">{user.hasFingerprint ? 'Re-enroll to Terminal (DY50)' : 'Enroll to Terminal (DY50)'}</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                setPinUser(user);
                                setPinValue("");
                                setConfirmPinValue("");
                                setPinError("");
                                setOpenDropdown(null);
                              }}
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center space-x-2.5 transition-colors"
                            >
                              <KeyRound className="w-4 h-4 text-indigo-600" />
                              <span className="font-medium text-xs">{user.hasPin ? 'Change Keypad PIN' : 'Set Keypad PIN'}</span>
                            </button>
                          </div>

                          <div className="py-1">
                            <button 
                              type="button"
                              onClick={() => { toggleStatus(user); setOpenDropdown(null); }} 
                              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors"
                            >
                              {user.status === 'Active' ? (
                                <>
                                  <UserX className="w-4 h-4 text-amber-500" />
                                  <span className="font-medium text-xs text-amber-700">Deactivate Account</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 text-emerald-500" />
                                  <span className="font-medium text-xs text-emerald-700">Activate Account</span>
                                </>
                              )}
                            </button>
                            <button 
                              type="button"
                              onClick={() => { setDeletingUser(user); setOpenDropdown(null); }} 
                              className="w-full px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center space-x-2.5 transition-colors font-medium"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                              <span className="font-semibold text-xs text-red-600">Delete User</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-semibold text-slate-800">{startIndex}</span> to{" "}
            <span className="font-semibold text-slate-800">{endIndex}</span> of{" "}
            <span className="font-semibold text-slate-800">{filteredUsers.length}</span> users
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={cn(
                "inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors",
                currentPage === 1 
                  ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50" 
                  : "border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
              )}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
                  currentPage === pageNum
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm font-semibold"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                "inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors",
                currentPage === totalPages || totalPages === 0
                  ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50" 
                  : "border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
              )}
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </Card>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold">Add New User</CardTitle>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g., Sarah Jenkins" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Role Classification</label>
                  <select 
                    value={newRole}
                    onChange={(e) => {
                      const updatedRole = e.target.value as "Student" | "Staff" | "Admin";
                      setNewRole(updatedRole);
                      const suggested = getSuggestedKeypadId(updatedRole, displayedUsers);
                      setNewUserId(suggested);
                      setUserIdError("");
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                  >
                    <option value="Student">Student (Keypad Suffix [A])</option>
                    <option value="Staff">Staff (Keypad Suffix [B])</option>
                    <option value="Admin">Admin (Keypad Suffix [C])</option>
                  </select>
                </div>
                
                {/* Keypad User ID Configuration */}
                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center">
                      <Hash className="w-3.5 h-3.5 mr-1 text-blue-600" /> Keypad User ID
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">Digits 0-9 + Letter</span>
                  </div>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g., 001A, 102B" 
                    value={newUserId}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setNewUserId(val);
                      if (val && !/^[0-9]+[A-Za-z]$/.test(val)) {
                        setUserIdError("Must start with 0-9 numeric digits and end with a single letter (e.g. 001A)");
                      } else {
                        setUserIdError("");
                      }
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-sm font-mono font-bold tracking-wide border rounded-md focus:outline-none focus:ring-2",
                      userIdError ? "border-red-300 focus:ring-red-500 bg-red-50/30 text-red-900" : "border-slate-300 focus:ring-blue-500 bg-white text-slate-900"
                    )}
                  />

                  {/* Keypad letter quick selector */}
                  <div className="flex items-center space-x-1.5 pt-1">
                    <span className="text-[11px] font-medium text-slate-500">Keypad Key:</span>
                    {['A', 'B', 'C', 'D'].map(letter => {
                      const numPart = newUserId.replace(/[^0-9]/g, '') || '001';
                      const isSelected = newUserId.endsWith(letter);
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => {
                            const next = `${numPart}${letter}`;
                            setNewUserId(next);
                            setUserIdError("");
                          }}
                          className={cn(
                            "px-2 py-0.5 text-xs font-mono font-bold rounded border transition-all",
                            isSelected 
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs scale-105" 
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          )}
                          title={`4x4 Matrix Keypad [${letter}]`}
                        >
                          [{letter}]
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = getSuggestedKeypadId(newRole, displayedUsers);
                        setNewUserId(suggested);
                        setUserIdError("");
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 ml-auto font-medium underline"
                    >
                      Reset Next ID
                    </button>
                  </div>

                  {userIdError ? (
                    <p className="text-[11px] text-red-600 flex items-center mt-1 font-medium">
                      <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                      {userIdError}
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-700 flex items-center mt-1">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 flex-shrink-0" />
                      Compatible with hardware 4x4 matrix keypad input (0-9 + A/B/C/D)
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isAdding}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                  >
                    {isAdding ? "Registering..." : "Create User"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View User Profile Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-base">
                  {viewingUser.name.charAt(0)}
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">{viewingUser.name}</CardTitle>
                  <p className="text-xs font-mono text-slate-500">{viewingUser.id} • {viewingUser.role}</p>
                </div>
              </div>
              <button onClick={() => setViewingUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Account Status</span>
                  <div className="flex items-center mt-1">
                    <div className={cn("w-2 h-2 rounded-full mr-2", viewingUser.status === 'Active' ? "bg-emerald-500" : "bg-slate-400")}></div>
                    <span className="text-sm font-semibold text-slate-800">{viewingUser.status}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Registration Date</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {new Date(viewingUser.dateRegistered).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Authentication Credentials</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <Fingerprint className={cn("w-4 h-4", viewingUser.hasFingerprint ? "text-emerald-600" : "text-slate-400")} />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Biometric DY50 Fingerprint</p>
                        <p className="text-[11px] text-slate-500">Optical sensor enrollment</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded",
                      viewingUser.hasFingerprint ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    )}>
                      {viewingUser.hasFingerprint ? "Enrolled" : "Not Enrolled"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <Hash className={cn("w-4 h-4", viewingUser.hasPin ? "text-blue-600" : "text-slate-400")} />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Keypad Backup PIN</p>
                        <p className="text-[11px] text-slate-500">Triggers ESP32-S3-CAM photo capture</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded",
                      viewingUser.hasPin ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600"
                    )}>
                      {viewingUser.hasPin ? "Configured" : "Not Set"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => setViewingUser(null)} 
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Close
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold">Edit User ({editingUser.id})</CardTitle>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Role Classification</label>
                  <select 
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as "Student" | "Staff" | "Admin")}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Student">Student</option>
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Account Status</label>
                  <select 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "Active" | "Inactive")}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setEditingUser(null)} 
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingEdit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                  >
                    {isSavingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live Fingerprint Terminal Enrollment Modal */}
      {enrollFpUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-lg shadow-2xl border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 bg-slate-50/80">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-lg">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Send Enrollment to Terminal
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    User: <strong className="text-slate-800">{enrollFpUser.name}</strong> • Keypad ID: <span className="font-mono font-bold text-blue-700">{enrollFpUser.id}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setEnrollFpUser(null)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Configuration Section (Terminal & Auto-Assigned Slot) */}
              {fpEnrollStatus === 'IDLE' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                      <HardDrive className="w-3.5 h-3.5 mr-1 text-slate-500" /> Target Hardware Terminal
                    </label>
                    <select
                      value={selectedTerminalId}
                      onChange={(e) => setSelectedTerminalId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                    >
                      {terminals.length > 0 ? (
                        terminals.map(term => (
                          <option key={term.id} value={term.id}>
                            {term.name || term.id} ({term.id}) - [{term.status}]
                          </option>
                        ))
                      ) : (
                        <option value="DEV_TERM_01">DEV_TERM_01 - Main Campus Terminal A (ONLINE)</option>
                      )}
                    </select>
                  </div>

                  {/* Auto-Assigned Slot Info */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center">
                        <Layers className="w-4 h-4 mr-1.5 text-emerald-600" /> Auto-Allocated EEPROM Slot
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-xs font-mono font-bold shadow-xs">
                        Slot #{targetSlot}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      The firmware backend automatically coordinates available DY50 optical slots. When dispatched, terminal <strong className="font-mono">{selectedTerminalId}</strong> will arm and save this user&apos;s biometric template into <strong>Slot #{targetSlot}</strong>.
                    </p>
                  </div>

                  {/* Instructions preview */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-slate-800 flex items-center">
                      <Cpu className="w-3.5 h-3.5 mr-1.5 text-slate-600" /> Hardware Handshake Sequence:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-500">
                      <li>Dashboard queues command into central Firestore <code className="font-mono text-slate-700">commands</code>.</li>
                      <li>ESP32 terminal picks up command on next telemetry packet and displays <code className="font-mono text-slate-700">** ENROLL MODE **</code>.</li>
                      <li>User places finger twice on optical glass; sensor captures 500 DPI ridge map.</li>
                      <li>Terminal posts verified template confirmation to backend.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Progress & Live Terminal Telemetry Monitor */}
              {fpEnrollStatus !== 'IDLE' && (
                <div className="py-6 px-4 bg-slate-900 rounded-xl border border-slate-800 text-white relative overflow-hidden flex flex-col items-center justify-center space-y-4">
                  <div className={cn(
                    "p-5 rounded-full border-2 transition-all duration-300",
                    fpEnrollStatus === 'ARMING' && "border-blue-500/50 bg-blue-950/40 text-blue-400 animate-pulse",
                    fpEnrollStatus === 'PENDING_TERMINAL_PICKUP' && "border-amber-500/50 bg-amber-950/40 text-amber-400 animate-pulse",
                    fpEnrollStatus === 'WAITING_FOR_FINGER' && "border-emerald-500/50 bg-emerald-950/40 text-emerald-400 animate-bounce",
                    fpEnrollStatus === 'SUCCESS' && "border-emerald-500 bg-emerald-900/60 text-emerald-300",
                    fpEnrollStatus === 'FAILED' && "border-red-500 bg-red-950/50 text-red-400"
                  )}>
                    {fpEnrollStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                    ) : fpEnrollStatus === 'FAILED' ? (
                      <AlertCircle className="w-12 h-12 text-red-400" />
                    ) : (
                      <Fingerprint className="w-12 h-12" />
                    )}
                  </div>

                  <div className="space-y-1 text-center max-w-sm px-2">
                    <p className="text-sm font-bold text-emerald-300">
                      {fpEnrollStatus === 'ARMING' && "Arming Terminal..."}
                      {fpEnrollStatus === 'PENDING_TERMINAL_PICKUP' && "Command Dispatched — Awaiting Terminal Heartbeat..."}
                      {fpEnrollStatus === 'WAITING_FOR_FINGER' && "Sensor Armed: Place Finger Twice on Sensor"}
                      {fpEnrollStatus === 'SUCCESS' && "Biometric Enrollment Verified & Stored!"}
                      {fpEnrollStatus === 'FAILED' && "Enrollment Failure"}
                    </p>
                    <p className="text-xs text-slate-300">
                      {fpStatusMsg}
                    </p>
                    {fpFailureReason && (
                      <p className="text-xs text-red-300 bg-red-950/80 p-2 rounded mt-2 border border-red-800">
                        {fpFailureReason}
                      </p>
                    )}
                  </div>

                  {fpEnrollStatus !== 'SUCCESS' && fpEnrollStatus !== 'FAILED' && (
                    <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                      <span>Elapsed Time: {elapsedSeconds}s (Timeout: 90s)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEnrollFpUser(null)} 
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
                >
                  {fpEnrollStatus === 'SUCCESS' ? "Done" : "Cancel"}
                </button>

                {fpEnrollStatus === 'IDLE' && (
                  <button 
                    type="button" 
                    onClick={handleDispatchEnrollCommand}
                    className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-all flex items-center"
                  >
                    <Radio className="w-4 h-4 mr-2 animate-pulse" /> Dispatch Enroll Command
                  </button>
                )}

                {fpEnrollStatus === 'FAILED' && (
                  <button 
                    type="button" 
                    onClick={handleDispatchEnrollCommand}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                  >
                    Retry Enrollment
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Set / Reset PIN Modal */}
      {pinUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-base font-bold">Keypad Backup PIN</CardTitle>
              </div>
              <button onClick={() => setPinUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSavePin} className="space-y-4">
                <p className="text-xs text-slate-500">
                  Configure a 4 to 6 digit backup numeric PIN for <strong className="text-slate-800">{pinUser.name}</strong> ({pinUser.id}) to punch on the 4x4 keypad matrix.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">New Numeric PIN (4-6 digits)</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    required
                    placeholder="Enter 4-6 digit PIN" 
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Confirm PIN</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    required
                    placeholder="Confirm PIN" 
                    value={confirmPinValue}
                    onChange={(e) => setConfirmPinValue(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {pinError && (
                  <p className="text-xs text-red-600 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                    {pinError}
                  </p>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setPinUser(null)} 
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingPin}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm"
                  >
                    {isSavingPin ? "Saving..." : "Save Keypad PIN"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-red-600">Delete User Account</CardTitle>
              <button onClick={() => setDeletingUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deletingUser.name}</strong> (<span className="font-mono text-xs">{deletingUser.id}</span>)? This will remove all associated attendance records and biometric fingerprint mappings.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setDeletingUser(null)} 
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  disabled={isDeleting}
                  onClick={handleDeleteUser}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm"
                >
                  {isDeleting ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center space-x-2 animate-in slide-in-from-bottom-5 duration-200",
          notification.type === 'success' ? "bg-emerald-600 text-white border-emerald-500" : "bg-red-600 text-white border-red-500"
        )}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  )
}
