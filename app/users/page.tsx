"use client"
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Search, Plus, MoreVertical, Fingerprint, Hash, X, 
  ChevronLeft, ChevronRight, UserCheck, UserX, 
  Edit, Trash2, Eye, KeyRound, CheckCircle2, AlertCircle, RefreshCw 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserItem {
  id: string
  name: string
  role: 'Student' | 'Staff'
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
  const [newRole, setNewRole] = useState<"Student" | "Staff">("Student")
  const [isAdding, setIsAdding] = useState(false)
  
  // Actions Dropdown & Modals
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [viewingUser, setViewingUser] = useState<UserItem | null>(null)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editRole, setEditRole] = useState<"Student" | "Staff">("Student")
  const [editStatus, setEditStatus] = useState<"Active" | "Inactive">("Active")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Fingerprint Enrollment Modal
  const [enrollFpUser, setEnrollFpUser] = useState<UserItem | null>(null)
  const [fpEnrollStep, setFpEnrollStep] = useState<'prompt' | 'scanning' | 'verifying' | 'success'>('prompt')
  const [isEnrollingFp, setIsEnrollingFp] = useState(false)

  // PIN Management Modal
  const [pinUser, setPinUser] = useState<UserItem | null>(null)
  const [pinValue, setPinValue] = useState("")
  const [confirmPinValue, setConfirmPinValue] = useState("")
  const [pinError, setPinError] = useState("")
  const [isSavingPin, setIsSavingPin] = useState(false)

  // Delete User Confirmation
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = useCallback(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data)
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchUsers()

    const handleClickOutside = () => setOpenDropdown(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [fetchUsers])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setIsAdding(true)
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, role: newRole })
      })
      setIsModalOpen(false)
      setNewName("")
      setNewRole("Student")
      fetchUsers()
    } catch (err) {
      console.error(err)
    } finally {
      setIsAdding(false)
    }
  }

  const toggleStatus = async (user: UserItem) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      fetchUsers()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser || !editName.trim()) return
    setIsSavingEdit(true)
    try {
      await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          role: editRole,
          status: editStatus
        })
      })
      setEditingUser(null)
      fetchUsers()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleStartFpEnrollment = () => {
    if (!enrollFpUser) return
    setIsEnrollingFp(true)
    setFpEnrollStep('scanning')
    setTimeout(() => {
      setFpEnrollStep('verifying')
      setTimeout(async () => {
        try {
          await fetch(`/api/users/${enrollFpUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enrollFingerprint: true })
          })
          setFpEnrollStep('success')
          fetchUsers()
        } catch (err) {
          console.error(err)
        } finally {
          setIsEnrollingFp(false)
        }
      }, 1500)
    }, 1500)
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

    setIsSavingPin(true)
    setPinError("")
    try {
      await fetch(`/api/users/${pinUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue })
      })
      setPinUser(null)
      setPinValue("")
      setConfirmPinValue("")
      fetchUsers()
    } catch (err) {
      setPinError("Failed to update PIN")
      console.error(err)
    } finally {
      setIsSavingPin(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setIsDeleting(true)
    try {
      await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE'
      })
      setDeletingUser(null)
      fetchUsers()
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "All Roles" || user.role === roleFilter
    const matchesStatus = statusFilter === "All Status" || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  // Pagination calculations
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
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 shadow-sm"
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
              ) : paginatedUsers.map(user => (
                <tr key={user.id} className="bg-white hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{user.name}</span>
                      <span className="text-xs font-mono text-slate-500 mt-0.5">{user.id}</span>
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
                  <td className="px-6 py-4 text-right relative">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setOpenDropdown(openDropdown === user.id ? null : user.id); 
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                      title="User Actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Fully Functional Dropdown Menu */}
                    {openDropdown === user.id && (
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="absolute right-6 top-12 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 text-left text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
                      >
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Actions: {user.name}
                        </div>
                        
                        <div className="py-1">
                          <button 
                            onClick={() => { setViewingUser(user); setOpenDropdown(null); }}
                            className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                          >
                            <Eye className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-sm">View User Profile</span>
                          </button>
                          <button 
                            onClick={() => {
                              setEditingUser(user);
                              setEditName(user.name);
                              setEditRole(user.role);
                              setEditStatus(user.status);
                              setOpenDropdown(null);
                            }}
                            className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                          >
                            <Edit className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-sm">Edit Details</span>
                          </button>
                        </div>

                        <div className="py-1">
                          <button 
                            onClick={() => {
                              setEnrollFpUser(user);
                              setFpEnrollStep('prompt');
                              setOpenDropdown(null);
                            }}
                            className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                          >
                            <Fingerprint className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium text-sm">{user.hasFingerprint ? 'Re-enroll Fingerprint' : 'Enroll Fingerprint'}</span>
                          </button>
                          <button 
                            onClick={() => {
                              setPinUser(user);
                              setPinValue("");
                              setConfirmPinValue("");
                              setPinError("");
                              setOpenDropdown(null);
                            }}
                            className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                          >
                            <KeyRound className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-sm">{user.hasPin ? 'Change PIN' : 'Set Fallback PIN'}</span>
                          </button>
                        </div>

                        <div className="py-1">
                          <button 
                            onClick={() => { toggleStatus(user); setOpenDropdown(null); }} 
                            className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                          >
                            {user.status === 'Active' ? (
                              <>
                                <UserX className="w-4 h-4 text-amber-500" />
                                <span className="font-medium text-sm text-amber-700">Deactivate Account</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 text-emerald-500" />
                                <span className="font-medium text-sm text-emerald-700">Activate Account</span>
                              </>
                            )}
                          </button>
                          <button 
                            onClick={() => { setDeletingUser(user); setOpenDropdown(null); }} 
                            className="w-full px-3 py-2 text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                            <span className="font-medium text-sm">Delete User</span>
                          </button>
                        </div>
                      </div>
                    )}
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
                  <label className="text-xs font-medium text-slate-700">Full Name</label>
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
                  <label className="text-xs font-medium text-slate-700">Role Classification</label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "Student" | "Staff")}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Student">Student</option>
                    <option value="Staff">Staff</option>
                  </select>
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
                    {new Date(viewingUser.dateRegistered).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Attendance Metrics</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <p className="text-xs text-slate-500">Total Check-Ins</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{viewingUser.totalAttendance}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <p className="text-xs text-slate-500">Late Arrivals</p>
                    <p className="text-lg font-bold text-amber-600 mt-0.5">{viewingUser.lateOccurrences}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <p className="text-xs text-slate-500">Punctuality</p>
                    <p className="text-lg font-bold text-emerald-600 mt-0.5">
                      {viewingUser.totalAttendance > 0 
                        ? `${Math.round(((viewingUser.totalAttendance - viewingUser.lateOccurrences) / viewingUser.totalAttendance) * 100)}%`
                        : '100%'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Hardware Credentials</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <Fingerprint className={cn("w-4 h-4", viewingUser.hasFingerprint ? "text-emerald-600" : "text-slate-400")} />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">SMF V1.7 Fingerprint</p>
                        <p className="text-[11px] text-slate-500">Primary biometric verification</p>
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
                        <p className="text-[11px] text-slate-500">Triggers ESP-CAM photo capture</p>
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
                    onChange={(e) => setEditRole(e.target.value as "Student" | "Staff")}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Student">Student</option>
                    <option value="Staff">Staff</option>
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

      {/* Fingerprint Enrollment Terminal Simulation Modal */}
      {enrollFpUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <Fingerprint className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">SMF V1.7 Sensor Enrollment</CardTitle>
              </div>
              <button onClick={() => setEnrollFpUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-5 text-center">
              <p className="text-xs text-slate-500">
                Enrolling biometric fingerprint for <strong className="text-slate-800">{enrollFpUser.name}</strong> ({enrollFpUser.id}) via connected ESP32 terminal.
              </p>

              {/* Terminal scan visual box */}
              <div className="py-8 bg-slate-900 rounded-xl border border-slate-800 text-white relative overflow-hidden flex flex-col items-center justify-center space-y-3">
                <div className={cn(
                  "p-4 rounded-full border-2 transition-all duration-300",
                  fpEnrollStep === 'prompt' && "border-emerald-500/50 bg-emerald-950/40 text-emerald-400 animate-pulse",
                  fpEnrollStep === 'scanning' && "border-blue-500 bg-blue-950/50 text-blue-400",
                  fpEnrollStep === 'verifying' && "border-purple-500 bg-purple-950/50 text-purple-400",
                  fpEnrollStep === 'success' && "border-emerald-500 bg-emerald-900/60 text-emerald-300"
                )}>
                  {fpEnrollStep === 'success' ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  ) : (
                    <Fingerprint className="w-10 h-10" />
                  )}
                </div>

                <div className="space-y-1 px-4">
                  <p className="text-sm font-semibold text-emerald-300">
                    {fpEnrollStep === 'prompt' && "Ready: Place Finger on Terminal Sensor"}
                    {fpEnrollStep === 'scanning' && "Capturing Optical 500 DPI Ridge Map..."}
                    {fpEnrollStep === 'verifying' && "Validating Template & Writing to EEPROM..."}
                    {fpEnrollStep === 'success' && "Enrollment Completed Successfully!"}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">
                    Terminal: DEV_TERM_01 • Sensor UART: 57600 baud
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEnrollFpUser(null)} 
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200"
                >
                  {fpEnrollStep === 'success' ? "Done" : "Cancel"}
                </button>
                {fpEnrollStep !== 'success' && (
                  <button 
                    type="button" 
                    disabled={isEnrollingFp}
                    onClick={handleStartFpEnrollment}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm"
                  >
                    {isEnrollingFp ? "Scanning Terminal..." : "Simulate Terminal Touch"}
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
                <KeyRound className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base font-bold">
                  {pinUser.hasPin ? "Change Fallback PIN" : "Set Fallback PIN"}
                </CardTitle>
              </div>
              <button onClick={() => setPinUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500 mb-4">
                Configure a secure 4-digit keypad PIN for <strong className="text-slate-800">{pinUser.name}</strong>. Used when fingerprint sensor fails, and triggers ESP-CAM photo capture.
              </p>

              {pinError && (
                <div className="mb-4 p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <form onSubmit={handleSavePin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">New 4-Digit PIN</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    required
                    placeholder="Enter 4-6 digits" 
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value)}
                    className="w-full px-3 py-2 text-sm tracking-widest text-center font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Confirm PIN</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    required
                    placeholder="Re-enter PIN" 
                    value={confirmPinValue}
                    onChange={(e) => setConfirmPinValue(e.target.value)}
                    className="w-full px-3 py-2 text-sm tracking-widest text-center font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                  >
                    {isSavingPin ? "Saving..." : "Save PIN"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-red-600 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span>Delete User</span>
              </CardTitle>
              <button onClick={() => setDeletingUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to permanently remove <strong className="text-slate-900">{deletingUser.name}</strong> ({deletingUser.id})? All associated biometric fingerprints and authentication credentials will be deleted.
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
                  {isDeleting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
