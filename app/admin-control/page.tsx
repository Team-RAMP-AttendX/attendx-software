'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Mail, 
  Send, 
  Key, 
  RefreshCw, 
  Lock, 
  UserCheck, 
  Clock, 
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  Sliders,
  Check,
  X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Administrator } from '@/types';
import emailjs from '@emailjs/browser';
import { useSystemMode } from '@/context/SystemModeContext';

export default function AdminControlPage() {
  const { isSimulationMode } = useSystemMode();
  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Admin Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Administrator['role']>('Security Officer');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // EmailJS Settings & Live Test State
  const [emailJsServiceId, setEmailJsServiceId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('attendx_emailjs_service_id') || '';
  });
  const [emailJsTemplateId, setEmailJsTemplateId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('attendx_emailjs_template_id') || '';
  });
  const [emailJsPublicKey, setEmailJsPublicKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('attendx_emailjs_public_key') || '';
  });
  const [showEmailJsConfig, setShowEmailJsConfig] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; previewCode?: string } | null>(null);

  const fetchAdministrators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/administrators');
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        console.warn('Non-JSON response from administrators API');
      }

      if (data && data.success && Array.isArray(data.administrators)) {
        setAdmins(data.administrators);
      } else {
        // Fallback default
        setAdmins([
          {
            id: 'admin_master',
            email: 'redemptionjonathan1@gmail.com',
            name: 'Jonathan Redemption',
            role: 'Master Administrator',
            status: 'Active',
            isMaster: true,
            addedAt: '2026-09-01T00:00:00.000Z',
            addedBy: 'Root Provisioning',
            notes: 'Primary Master Administrator with full security authority.'
          }
        ]);
      }
    } catch (err: unknown) {
      console.error('Failed to load administrators:', err);
      setError('Unable to fetch administrators from database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/administrators')
      .then(res => res.text())
      .then(text => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })
      .then(data => {
        if (active) {
          if (data && data.success && Array.isArray(data.administrators)) {
            setAdmins(data.administrators);
          } else {
            setAdmins([
              {
                id: 'admin_master',
                email: 'redemptionjonathan1@gmail.com',
                name: 'Jonathan Redemption',
                role: 'Master Administrator',
                status: 'Active',
                isMaster: true,
                addedAt: '2026-09-01T00:00:00.000Z',
                addedBy: 'Root Provisioning',
                notes: 'Primary Master Administrator with full security authority.'
              }
            ]);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError('Unable to fetch administrators from database.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/administrators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim(),
          role: newRole,
          notes: newNotes.trim(),
          addedBy: 'Jonathan Redemption (Master Admin)'
        })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned an unexpected response format.');
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to provision administrator.');
      }

      setSuccess(data.message || `Administrator ${newName} provisioned successfully!`);
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewName('');
      setNewNotes('');
      setNewRole('Security Officer');
      fetchAdministrators();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error provisioning administrator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: Administrator) => {
    if (admin.isMaster) {
      alert('The Master Administrator account cannot be suspended.');
      return;
    }

    const nextStatus = admin.status === 'Active' ? 'Suspended' : 'Active';
    try {
      const res = await fetch('/api/admin/administrators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: admin.id,
          status: nextStatus
        })
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Unexpected response format.');
      }

      if (data.success) {
        setSuccess(`Status for ${admin.name} updated to ${nextStatus}.`);
        fetchAdministrators();
      } else {
        setError(data.message || 'Failed to update status.');
      }
    } catch {
      setError('Failed to update administrator status.');
    }
  };

  const handleDeleteAdmin = async (admin: Administrator) => {
    if (admin.isMaster) {
      alert('The Master Administrator cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to revoke administrator access for ${admin.name} (${admin.email})? They will no longer be able to receive OTPs.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/administrators?id=${encodeURIComponent(admin.id)}`, {
        method: 'DELETE'
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Unexpected response format.');
      }

      if (data.success) {
        setSuccess(data.message);
        fetchAdministrators();
      } else {
        setError(data.message || 'Failed to delete administrator.');
      }
    } catch {
      setError('Failed to revoke administrator.');
    }
  };

  const handleSaveEmailJs = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendx_emailjs_service_id', emailJsServiceId.trim());
      localStorage.setItem('attendx_emailjs_template_id', emailJsTemplateId.trim());
      localStorage.setItem('attendx_emailjs_public_key', emailJsPublicKey.trim());
      setSuccess('EmailJS configuration saved to local storage.');
      setShowEmailJsConfig(false);
    }
  };

  const handleSendTestEmail = async () => {
    const sId = emailJsServiceId || process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const tId = emailJsTemplateId || process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const pKey = emailJsPublicKey || process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    if (!sId || !tId || !pKey) {
      setTestResult({
        success: false,
        message: 'Please provide all 3 EmailJS credentials (Service ID, Template ID, Public Key) before running the test.'
      });
      setShowEmailJsConfig(true);
      return;
    }

    setTestSending(true);
    setTestResult(null);

    const testCode = Math.floor(100000 + Math.random() * 900000).toString();
    const targetEmail = 'redemptionjonathan1@gmail.com';
    const nowFormatted = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    try {
      // Exact variable mapping for your EmailJS portfolio template:
      // {{name}}, {{subject}}, {{email}}, {{time}}, {{message}}, {{otp}}, {{expiry}}, {{to_email}}
      const templateParams = {
        name: 'AttendX Biometric Security',
        subject: `AttendX Admin Verification Code: ${testCode}`,
        email: targetEmail,
        to_email: targetEmail,
        recipient_email: targetEmail,
        reply_to: targetEmail,
        time: nowFormatted,
        date: new Date().toLocaleDateString('en-US'),
        otp: testCode,
        otp_code: testCode,
        passcode: testCode,
        code: testCode,
        expiry: '5 minutes',
        expiry_minutes: '5',
        message: `Your AttendX System Administrator verification code is: ${testCode}\n\nThis one-time passcode will expire in 5 minutes.\n\nUse this code to unlock the AttendX Biometric Administration Console. If you did not request this, please disregard.`,
        app_name: 'AttendX Biometric Administration System'
      };

      await emailjs.send(sId, tId, templateParams, pKey);

      setTestResult({
        success: true,
        previewCode: testCode,
        message: `Test email successfully dispatched to ${targetEmail}! Check your inbox. The OTP is embedded in {{otp}}, {{message}}, and {{subject}}.`
      });
    } catch (err: unknown) {
      console.error('EmailJS test failed:', err);
      const errText = (err && typeof err === 'object' && 'text' in err)
        ? String((err as { text: unknown }).text)
        : (err instanceof Error ? err.message : 'Unknown transmission failure');
      setTestResult({
        success: false,
        previewCode: testCode,
        message: `EmailJS error: ${errText}. Please check that your Service ID, Template ID, and Public Key are correct in EmailJS.`
      });
    } finally {
      setTestSending(false);
    }
  };

  const masterAdmin = admins.find(a => a.isMaster) || {
    id: 'admin_master',
    email: 'redemptionjonathan1@gmail.com',
    name: 'Jonathan Redemption',
    role: 'Master Administrator' as const,
    status: 'Active' as const,
    isMaster: true,
    addedAt: '2026-09-01T00:00:00.000Z'
  };

  const activeAdminsCount = admins.filter(a => a.status === 'Active').length;
  const isEmailJsConfigured = Boolean(
    (emailJsServiceId || process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID) &&
    (emailJsTemplateId || process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID) &&
    (emailJsPublicKey || process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Admin Control & Authorization
              </h1>
              <p className="text-sm text-slate-500">
                Provision authorized administrators, enforce strict OTP access, and manage EmailJS delivery.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowEmailJsConfig(!showEmailJsConfig)}
            className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>EmailJS Setup</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 flex items-center space-x-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Provision Administrator</span>
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Security Enforcement Policy Callout */}
      <Card className="p-5 border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>Strict Security Guard Active</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  HTTP 403 Enforcement
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Only email addresses explicitly provisioned in this table are permitted to receive 5-minute authentication OTPs. Any unlisted email submitted on the login screen is immediately blocked by the backend API.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Master Administrator</span>
              <span className="text-xs font-mono font-bold text-slate-800">{masterAdmin.email}</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>
      </Card>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Administrators</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{admins.length}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Provisioned in database</span>
        </Card>

        <Card className="p-4 border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Accounts</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{activeAdminsCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Authorized to receive OTP</span>
        </Card>

        <Card className="p-4 border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">OTP Expiration</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">5 Mins</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Auto-expires in memory</span>
        </Card>

        <Card className="p-4 border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">EmailJS Service</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEmailJsConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-base font-bold mt-2 ${isEmailJsConfigured ? 'text-emerald-700' : 'text-rose-600'}`}>
            {isEmailJsConfigured ? 'Configured & Ready' : 'Keys Required'}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Portfolio template mapped</span>
        </Card>
      </div>

      {/* EmailJS Credentials & Template Diagnostic Card */}
      <Card className="p-6 border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>EmailJS Portfolio Template Configuration</span>
            </h2>
            <p className="text-xs text-slate-500">
              Your existing EmailJS template format is fully supported. All required variables are dynamically mapped.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSendTestEmail}
              disabled={testSending}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-50"
            >
              {testSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Test...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Test Result Callout */}
        {testResult && (
          <div className={`p-4 rounded-xl text-xs flex items-start space-x-3 ${testResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{testResult.message}</p>
              {testResult.previewCode && (
                <p className="font-mono text-[11px] opacity-80">
                  Dispatched OTP Code: <strong className="underline">{testResult.previewCode}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Template Variables Mapping Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-mono font-bold text-indigo-600 block">{'{{otp}}'}</span>
            <span className="text-[11px] text-slate-500 mt-1 block">Large 30px bold passcode code in verification box.</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-mono font-bold text-indigo-600 block">{'{{message}}'}</span>
            <span className="text-[11px] text-slate-500 mt-1 block">Embedded message box containing the OTP code as fallback.</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-mono font-bold text-indigo-600 block">{'{{subject}}'}</span>
            <span className="text-[11px] text-slate-500 mt-1 block">&quot;AttendX Admin Verification Code: [OTP]&quot;</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-mono font-bold text-indigo-600 block">{'{{name}}'} &amp; {'{{time}}'}</span>
            <span className="text-[11px] text-slate-500 mt-1 block">Sender name &amp; localized timestamp formatted properly.</span>
          </div>
        </div>

        {/* Credentials Form (Collapsible) */}
        {showEmailJsConfig && (
          <form onSubmit={handleSaveEmailJs} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 mt-4">
            <div className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-600" />
              <span>Update EmailJS Account API Keys</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Service ID</label>
                <input
                  type="text"
                  placeholder="e.g. service_attendx"
                  value={emailJsServiceId}
                  onChange={(e) => setEmailJsServiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Template ID</label>
                <input
                  type="text"
                  placeholder="e.g. template_attendx_otp"
                  value={emailJsTemplateId}
                  onChange={(e) => setEmailJsTemplateId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Public Key</label>
                <input
                  type="text"
                  placeholder="e.g. user_xxx or public_xxx"
                  value={emailJsPublicKey}
                  onChange={(e) => setEmailJsPublicKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmailJsConfig(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                Save Credentials
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* Authorized Administrators Table */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Provisioned Administrators Registry</h2>
            <p className="text-xs text-slate-500">Only email accounts listed here will be granted access to OTP generation.</p>
          </div>
          <button
            onClick={fetchAdministrators}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs flex items-center space-x-1"
            title="Refresh Registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Administrator</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Security Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date Provisioned</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span>Loading administrator directory...</span>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No administrators registered.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          admin.isMaster ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                            <span>{admin.name}</span>
                            {admin.isMaster && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-100 text-indigo-700 font-bold uppercase tracking-wider">
                                Master
                              </span>
                            )}
                          </div>
                          {admin.notes && (
                            <span className="text-[11px] text-slate-400 block max-w-xs truncate">{admin.notes}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {admin.email}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {admin.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleStatus(admin)}
                        disabled={admin.isMaster}
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                          admin.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        } ${admin.isMaster ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:opacity-80'}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${admin.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        <span>{admin.status}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(admin.addedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {admin.isMaster ? (
                        <span className="text-[10px] text-slate-400 font-medium italic">
                          Permanent Root
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDeleteAdmin(admin)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Revoke Administrator Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Provision New Administrator */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Provision New Administrator</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAdmin} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. colleague@university.edu"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Once registered, this address can immediately receive OTPs at login.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Jenkins"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assigned Security Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Administrator['role'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Security Officer">Security Officer</option>
                  <option value="Attendance Supervisor">Attendance Supervisor</option>
                  <option value="System Operator">System Operator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Department / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Faculty of Engineering Biometric Lead"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Authorize Administrator</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
