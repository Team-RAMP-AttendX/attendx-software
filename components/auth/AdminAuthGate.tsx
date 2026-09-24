'use client';

import React, { useState, useEffect } from 'react';
import { useSystemMode } from '@/context/SystemModeContext';
import { 
  ShieldCheck, 
  KeyRound, 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  Lock, 
  Sparkles, 
  HelpCircle,
  Clock,
  Terminal,
  Cpu,
  Fingerprint,
  Camera,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import emailjs from '@emailjs/browser';

export default function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, login, setSimulationMode, isHydrated } = useSystemMode();

  const [email, setEmail] = useState('redemptionjonathan1@gmail.com');
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [otpInput, setOtpInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);

  // 5-minute countdown timer (300 seconds)
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [canResend, setCanResend] = useState(false);

  // EmailJS settings modal / drawer
  const [showEmailJsConfig, setShowEmailJsConfig] = useState(false);
  const [emailJsServiceId, setEmailJsServiceId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('emailjs_service_id') || process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '';
    } catch {
      return '';
    }
  });
  const [emailJsTemplateId, setEmailJsTemplateId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('emailjs_template_id') || process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
    } catch {
      return '';
    }
  });
  const [emailJsPublicKey, setEmailJsPublicKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('emailjs_public_key') || process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';
    } catch {
      return '';
    }
  });

  // Timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'OTP' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          if (prev === 270) setCanResend(true); // Allow resend after 30s
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const saveEmailJsSettings = () => {
    try {
      localStorage.setItem('emailjs_service_id', emailJsServiceId);
      localStorage.setItem('emailjs_template_id', emailJsTemplateId);
      localStorage.setItem('emailjs_public_key', emailJsPublicKey);
      setShowEmailJsConfig(false);
      setSuccessMsg('EmailJS parameters saved.');
    } catch {
      // Ignore
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid administrator email.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Call server to generate and record 5-minute OTP
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ action: 'SEND_OTP', email: email.trim() })
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Handle HTML error responses from cloud reverse proxies or gateway interceptors
        const isForbiddenOrDenied = res.status === 403 || res.status === 401 || /forbidden|unauthorized|denied|access/i.test(rawText);
        if (isForbiddenOrDenied) {
          throw new Error(
            `Access Denied: "${email.trim()}" is not in our record of approved administrators. Only provisioned administrator emails can receive verification passcodes. Please contact the Master Administrator (redemptionjonathan1@gmail.com).`
          );
        }
        throw new Error(
          `Unable to verify administrator status. Please verify that "${email.trim()}" is provisioned as an approved administrator in the Admin Control panel.`
        );
      }

      if (!res.ok || !data || !data.success) {
        throw new Error(
          data?.message || `Access Denied: "${email.trim()}" is not in our record of approved administrators.`
        );
      }

      const generatedCode = data.previewCode;
      setPreviewOtp(generatedCode);
      setTimeLeft(300);
      setCanResend(false);
      setStep('OTP');

      // 2. Dispatch via EmailJS if credentials are provided
      const sId = emailJsServiceId || process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const tId = emailJsTemplateId || process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const pKey = emailJsPublicKey || process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (sId && tId && pKey) {
        try {
          const nowFormatted = new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
          });

          // Exact variable mapping for your EmailJS template format:
          // {{name}}, {{subject}}, {{email}}, {{time}}, {{message}}, {{otp}}, {{expiry}}, {{to_email}}
          const templateParams = {
            name: data.adminName ? `${data.adminName} (AttendX Security)` : 'AttendX Biometric Security',
            subject: `AttendX Admin Verification Code: ${generatedCode}`,
            email: email,
            to_email: email,
            recipient_email: email,
            reply_to: email,
            time: nowFormatted,
            date: new Date().toLocaleDateString('en-US'),
            otp: generatedCode,
            otp_code: generatedCode,
            passcode: generatedCode,
            code: generatedCode,
            expiry: '5 minutes',
            expiry_minutes: '5',
            message: `Your AttendX System Administrator verification code is: ${generatedCode}\n\nThis one-time passcode will expire in 5 minutes.\n\nUse this code to unlock the AttendX Biometric Administration Console. If you did not request this, please disregard.`,
            app_name: 'AttendX Biometric Administration System'
          };

          await emailjs.send(
            sId,
            tId,
            templateParams,
            pKey
          );
          setSuccessMsg(`A 5-minute security OTP has been dispatched to ${email}. Check your inbox!`);
        } catch (emailErr: unknown) {
          console.warn('EmailJS dispatch note:', emailErr);
          const errorMsgText = (emailErr && typeof emailErr === 'object' && 'text' in emailErr)
            ? String((emailErr as { text: unknown }).text)
            : 'EmailJS transmission error';
          setSuccessMsg(`OTP generated! Note: EmailJS service message (${errorMsgText}). Code preview is available below: ${generatedCode}`);
        }
      } else {
        setSuccessMsg(`Security OTP generated! Ready for verification. Code preview: ${generatedCode}`);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error generating verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpInput || otpInput.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ action: 'VERIFY_OTP', email: email.trim(), otp: otpInput.trim() })
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Verification failed. Server returned an invalid response.');
      }

      if (!res.ok || !data || !data.success) {
        throw new Error(data?.message || 'Invalid or expired OTP code.');
      }

      // Success
      login(email.trim(), data.sessionToken);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchSimulationDirectly = () => {
    setSimulationMode(true);
    login(email, 'simulated_guest_session');
  };

  // While hydrating on the client, render identical unauthenticated gate to ensure SSR HTML matches 100%
  if (!isHydrated) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950 font-sans selection:bg-indigo-500 selection:text-white">
        {/* Cinematic dark glassmorphic vignette placeholder */}
        <div className="absolute inset-0 bg-slate-950" />
      </div>
    );
  }

  // If already authenticated on client, render protected dashboard
  if (isAuthenticated) {
    return <>{children}</>;
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Video Overlay Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          src="/overlay-attendx.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-60 scale-105"
        />
        {/* Cinematic dark glassmorphic vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-900/80 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950/60 to-slate-950" />
      </div>

      {/* Foreground Container */}
      <div className="relative z-10 w-full max-w-md px-4 py-8">
        {/* Terminal Hardware Badge */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-indigo-500/30 text-indigo-300 text-xs font-medium shadow-xl backdrop-blur-md">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>ESP32-S3 Biometric Security Barrier</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/40 text-slate-100">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3 border border-indigo-400/30">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center space-x-2">
              <span>AttendX Admin Gate</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Hardware synchronized with ESP32-CAM, DY50 optical sensor, and Cloud Firestore.
            </p>
          </div>

          {/* Status Messages */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-950/80 border border-red-800/60 text-red-200 text-xs flex flex-col space-y-2 shadow-lg animate-in fade-in duration-200">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-300 text-[13px] mb-0.5">
                    {errorMsg.toLowerCase().includes('not in our record') || errorMsg.toLowerCase().includes('access denied') 
                      ? 'Access Denied: Unapproved Administrator' 
                      : 'Security Notification'}
                  </div>
                  <div className="text-red-200/90 leading-relaxed text-xs">
                    {errorMsg}
                  </div>
                </div>
              </div>
              {errorMsg.toLowerCase().includes('not in our record') && (
                <div className="pt-2 border-t border-red-900/60 flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('redemptionjonathan1@gmail.com');
                      setErrorMsg(null);
                    }}
                    className="text-indigo-300 hover:text-white underline underline-offset-2 transition-colors font-medium"
                  >
                    Use Master Admin (redemptionjonathan1@gmail.com)
                  </button>
                  <span className="text-red-500">•</span>
                  <button
                    type="button"
                    onClick={handleLaunchSimulationDirectly}
                    className="text-amber-300 hover:text-white underline underline-offset-2 transition-colors font-medium"
                  >
                    Launch Simulation Mode
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/50 text-emerald-200 text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Step 1: Admin Email Input */}
          {step === 'EMAIL' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Administrator Email
                  </label>
                  <span className="text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-mono">
                    Provisioned Admins Only
                  </span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="redemptionjonathan1@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
                <div className="mt-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p className="flex items-center space-x-1.5 text-slate-300 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Security Policy:</span>
                  </p>
                  <p>
                    Only emails provisioned via <strong className="text-white">Admin Control</strong> (default: <span className="text-indigo-300 font-mono">redemptionjonathan1@gmail.com</span>) can receive one-time passcodes.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: OTP Verification Form */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Enter 6-Digit Code
                  </label>
                  <div className="flex items-center space-x-1 text-xs font-mono text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires in {formatTimer(timeLeft)}</span>
                  </div>
                </div>

                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-indigo-500/50 rounded-xl text-lg tracking-[0.35em] text-center font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {previewOtp && (
                  <div className="mt-2 p-2.5 bg-indigo-950/50 border border-indigo-800/40 rounded-lg flex items-center justify-between text-xs text-indigo-300">
                    <span>Evaluation Code Preview:</span>
                    <span className="font-mono font-bold text-indigo-200 bg-indigo-900/60 px-2 py-0.5 rounded">
                      {previewOtp}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || otpInput.length < 6}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Unlock Admin Console</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('EMAIL')}
                  className="hover:text-slate-200 transition-colors"
                >
                  ← Change Email
                </button>
                <button
                  type="button"
                  disabled={!canResend || isLoading}
                  onClick={() => handleSendOtp()}
                  className="text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors font-medium"
                >
                  Resend Code
                </button>
              </div>
            </form>
          )}

          {/* Footer Controls */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col space-y-3">
            {/* Simulation Bypass Button */}
            <button
              type="button"
              onClick={handleLaunchSimulationDirectly}
              className="w-full py-2 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/40 text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Launch Full System Simulation (Zero DB Read/Write)</span>
            </button>

            {/* EmailJS Credentials Accordion Button */}
            <button
              type="button"
              onClick={() => setShowEmailJsConfig(!showEmailJsConfig)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>EmailJS API Credentials Details</span>
            </button>

            {/* EmailJS Config Drawer */}
            {showEmailJsConfig && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2.5 animate-fadeIn">
                <div className="font-semibold text-white flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Required EmailJS Credentials:</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  To receive real emails on Gmail via EmailJS, provide your 3 keys below (or set them in <code className="text-indigo-300 font-mono">.env.example</code>):
                </p>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">1. Service ID</label>
                  <input
                    type="text"
                    placeholder="e.g. service_attendx"
                    value={emailJsServiceId}
                    onChange={(e) => setEmailJsServiceId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">2. Template ID</label>
                  <input
                    type="text"
                    placeholder="e.g. template_attendx_otp"
                    value={emailJsTemplateId}
                    onChange={(e) => setEmailJsTemplateId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono mt-0.5"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                    Compatible with your portfolio template variables: <code className="text-indigo-400">{'{{otp}}'}</code>, <code className="text-indigo-400">{'{{message}}'}</code>, <code className="text-indigo-400">{'{{subject}}'}</code>, <code className="text-indigo-400">{'{{name}}'}</code>, <code className="text-indigo-400">{'{{expiry}}'}</code>
                  </span>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">3. Public Key</label>
                  <input
                    type="text"
                    placeholder="e.g. user_xxxx or public_xxxx"
                    value={emailJsPublicKey}
                    onChange={(e) => setEmailJsPublicKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono mt-0.5"
                  />
                </div>

                <button
                  type="button"
                  onClick={saveEmailJsSettings}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded transition-colors"
                >
                  Save EmailJS Keys
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hardware Architecture Footer Indicator */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 px-2">
          <div className="flex items-center space-x-1.5">
            <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
            <span>DY50 Optical Sensor</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Camera className="w-3.5 h-3.5 text-indigo-400" />
            <span>ESP-CAM Evidence</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>16x2 LCD + 4x4 Keypad</span>
          </div>
        </div>
      </div>
    </div>
  );
}
