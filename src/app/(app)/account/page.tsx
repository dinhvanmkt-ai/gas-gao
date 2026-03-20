'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { useSession } from 'next-auth/react'
import {
  User, Mail, Lock, Shield, Save, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, KeyRound, Calendar
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function AccountPage() {
  const { data: session, update: updateSession } = useSession()

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password form
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/account')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setProfile(d)
          setName(d.name)
          setEmail(d.email)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    const res = await fetch('/api/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    })
    const data = await res.json()
    if (res.ok) {
      setProfile(data)
      setProfileMsg({ type: 'success', text: 'Đã cập nhật thông tin tài khoản!' })
      // Update the session so the header reflects new name
      await updateSession({ name: data.name, email: data.email })
    } else {
      setProfileMsg({ type: 'error', text: data.error ?? 'Lỗi khi lưu' })
    }
    setProfileSaving(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' })
      return
    }
    if (newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
      return
    }
    setPwdSaving(true)
    const res = await fetch('/api/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
    })
    const data = await res.json()
    if (res.ok) {
      setPwdMsg({ type: 'success', text: 'Đã đổi mật khẩu thành công!' })
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } else {
      setPwdMsg({ type: 'error', text: data.error ?? 'Lỗi khi đổi mật khẩu' })
    }
    setPwdSaving(false)
  }

  const pwdStrength = (pwd: string) => {
    if (!pwd) return null
    if (pwd.length < 6) return { label: 'Quá ngắn', cls: 'bg-red-500', w: '25%' }
    if (pwd.length < 8) return { label: 'Yếu', cls: 'bg-orange-500', w: '50%' }
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return { label: 'Mạnh', cls: 'bg-emerald-500', w: '100%' }
    return { label: 'Trung bình', cls: 'bg-yellow-500', w: '75%' }
  }

  const strength = pwdStrength(newPwd)

  const roleLabel = (role: string) => role === 'admin' ? 'Quản trị viên' : 'Nhân viên'

  return (
    <div className="flex flex-col flex-1">
      <Header title="Tài Khoản" subtitle="Quản lý thông tin và bảo mật tài khoản" />
      <main className="flex-1 p-6 max-w-3xl space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {/* Profile card */}
            <div className="card p-6">
              {/* Avatar + role badge */}
              <div className="flex items-center gap-4 mb-6 pb-5 border-b border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
                  <span className="text-2xl font-bold text-white">
                    {(profile?.name ?? 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-100 text-lg leading-tight">{profile?.name}</p>
                  <p className="text-slate-400 text-sm">{profile?.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      profile?.role === 'admin'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {roleLabel(profile?.role)}
                    </span>
                    {profile?.createdAt && (
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Tạo lúc {formatDateTime(profile.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile form */}
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-orange-400" /> Thông tin cá nhân
              </h3>
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="label">Họ và tên</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="account-name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="input pl-9"
                      placeholder="Tên hiển thị..."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Email đăng nhập</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="account-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input pl-9"
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                </div>

                {profileMsg && (
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {profileMsg.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    {profileMsg.text}
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="submit" disabled={profileSaving} className="btn-primary">
                    {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {profileSaving ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                </div>
              </form>
            </div>

            {/* Password card */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-400" /> Đổi mật khẩu
              </h3>
              <form onSubmit={savePassword} className="space-y-4">
                {/* Current password */}
                <div>
                  <label className="label">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="current-password"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      className="input pl-9 pr-10"
                      placeholder="Nhập mật khẩu hiện tại..."
                      autoComplete="current-password"
                      required
                    />
                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="label">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      className="input pl-9 pr-10"
                      placeholder="Tối thiểu 6 ký tự..."
                      autoComplete="new-password"
                      required
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {strength && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${strength.cls} rounded-full transition-all duration-300`} style={{ width: strength.w }} />
                      </div>
                      <p className={`text-xs ${
                        strength.cls.includes('red') ? 'text-red-400' :
                        strength.cls.includes('orange') ? 'text-orange-400' :
                        strength.cls.includes('yellow') ? 'text-yellow-400' : 'text-emerald-400'
                      }`}>{strength.label}</p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="label">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      className="input pl-9 pr-10"
                      placeholder="Nhập lại mật khẩu mới..."
                      autoComplete="new-password"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Match indicator */}
                  {confirmPwd && (
                    <p className={`text-xs mt-1 ${newPwd === confirmPwd ? 'text-emerald-400' : 'text-red-400'}`}>
                      {newPwd === confirmPwd ? '✓ Mật khẩu khớp' : '✗ Mật khẩu không khớp'}
                    </p>
                  )}
                </div>

                {pwdMsg && (
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                    pwdMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {pwdMsg.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    {pwdMsg.text}
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="submit" disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                    {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {pwdSaving ? 'Đang đổi...' : 'Đổi mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
