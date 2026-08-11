import { useState } from 'react'
import {
	UserPlus,
	Users,
	Crown,
	Shield,
	Pencil,
	Eye,
	MoreHorizontal,
	X,
	Check,
	Clock,
	Mail,
	Loader2,
	LogOut,
	Trash2,
	ChevronDown,
} from 'lucide-react'
import { authClient } from '../../auth'
import {
	ROLE_LABELS,
	ROLE_DESCRIPTIONS,
	MAX_COLLABORATORS_PER_FORM,
	type CollaboratorRecord,
} from '../../features/collaborators/access'
import type { CollaboratorRole } from '../../types'

interface CollaboratorsPanelProps {
	formId: string
	formTitle: string
	collaborators: CollaboratorRecord[]
	userRole: 'owner' | CollaboratorRole
	userId: string
	userEmail: string
}

const ROLE_OPTIONS: { value: CollaboratorRole; label: string; description: string; icon: typeof Eye }[] = [
	{ value: 'viewer', label: 'Viewer', description: ROLE_DESCRIPTIONS.viewer, icon: Eye },
	{ value: 'editor', label: 'Editor', description: ROLE_DESCRIPTIONS.editor, icon: Pencil },
	{ value: 'admin', label: 'Admin', description: ROLE_DESCRIPTIONS.admin, icon: Shield },
]

export function CollaboratorsPanel({
	formId,
	formTitle,
	collaborators,
	userRole,
	userId,
	userEmail,
}: CollaboratorsPanelProps) {
	const [inviteEmail, setInviteEmail] = useState('')
	const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor')
	const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
	const [inviteMessage, setInviteMessage] = useState('')
	const [actionMenuId, setActionMenuId] = useState<string | null>(null)
	const [roleMenuId, setRoleMenuId] = useState<string | null>(null)
	const [actionLoading, setActionLoading] = useState<string | null>(null)
	const [showRoleDropdown, setShowRoleDropdown] = useState(false)
	const [leaveLoading, setLeaveLoading] = useState(false)

	const canManage = userRole === 'owner' || userRole === 'admin'
	const canAssignAdmin = userRole === 'owner'
	const activeCollaborators = collaborators.filter(c => c.status !== 'declined')
	const acceptedCollaborators = collaborators.filter(c => c.status === 'accepted')
	const pendingCollaborators = collaborators.filter(c => c.status === 'pending')

	async function handleInvite(e: React.FormEvent) {
		e.preventDefault()
		if (!inviteEmail.trim()) return
		setInviteStatus('sending')
		setInviteMessage('')

		try {
			const token = await authClient.getAccessToken()
			if (!token) {
				setInviteStatus('error')
				setInviteMessage('Sign in again to invite collaborators.')
				return
			}
			const res = await fetch('/api/forms/collaborators/invite', {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ formId, email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
			})
			const body = await res.json().catch(() => ({})) as { message?: string; error?: string }
			if (res.ok) {
				setInviteStatus('sent')
				setInviteMessage(body.message || 'Invitation sent!')
				setInviteEmail('')
				setTimeout(() => setInviteStatus('idle'), 3000)
			} else {
				setInviteStatus('error')
				setInviteMessage(body.error || 'Failed to send invitation.')
			}
		} catch {
			setInviteStatus('error')
			setInviteMessage('Something went wrong.')
		}
	}

	async function handleRoleChange(collaboratorId: string, newRole: CollaboratorRole) {
		setActionLoading(collaboratorId)
		setRoleMenuId(null)
		try {
			const token = await authClient.getAccessToken()
			if (!token) return
			await fetch('/api/forms/collaborators/role', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ formId, collaboratorId, role: newRole }),
			})
		} catch {
			// Silently fail — sync will show actual state
		} finally {
			setActionLoading(null)
		}
	}

	async function handleRemove(collaboratorId: string) {
		setActionLoading(collaboratorId)
		setActionMenuId(null)
		try {
			const token = await authClient.getAccessToken()
			if (!token) return
			await fetch('/api/forms/collaborators/remove', {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ formId, collaboratorId }),
			})
		} catch {
			// Silently fail
		} finally {
			setActionLoading(null)
		}
	}

	async function handleLeave() {
		setLeaveLoading(true)
		try {
			const token = await authClient.getAccessToken()
			if (!token) return
			await fetch('/api/forms/collaborators/leave', {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ formId }),
			})
		} catch {
			// Silently fail
		} finally {
			setLeaveLoading(false)
		}
	}

	function getRoleIcon(role: CollaboratorRole | 'owner') {
		if (role === 'owner') return <Crown className="h-3.5 w-3.5 text-amber-500" />
		if (role === 'admin') return <Shield className="h-3.5 w-3.5 text-violet-500" />
		if (role === 'editor') return <Pencil className="h-3.5 w-3.5 text-blue-500" />
		return <Eye className="h-3.5 w-3.5 text-gray-400" />
	}

	function getRoleBadgeClasses(role: CollaboratorRole | 'owner') {
		if (role === 'owner') return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
		if (role === 'admin') return 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
		if (role === 'editor') return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
		return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
	}

	return (
		<section className="animate-fade-in rounded-b-2xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark sm:p-6">
			<div className="space-y-6">
				{/* Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-[22px] font-semibold tracking-tight text-slate-950 dark:text-gray-100">
							Collaborators
						</h2>
						<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">
							Invite people to collaborate on {formTitle}.
						</p>
					</div>
					<div className="text-[13px] text-slate-400 dark:text-gray-500">
						{acceptedCollaborators.length + 1} / {MAX_COLLABORATORS_PER_FORM + 1} people
					</div>
				</div>

				{/* Invite form — only for owner/admin */}
				{canManage && (
					<form onSubmit={handleInvite} className="kf-panel p-5">
						<div className="flex items-center gap-2 mb-4">
							<UserPlus className="h-5 w-5 text-brand-600 dark:text-brand-400" />
							<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">
								Invite people
							</h3>
						</div>
						<div className="flex flex-col sm:flex-row gap-3">
							<div className="flex-1">
								<input
									type="email"
									value={inviteEmail}
									onChange={e => setInviteEmail(e.target.value)}
									placeholder="Email address"
									className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
									required
								/>
							</div>
							<div className="relative">
								<button
									type="button"
									onClick={() => setShowRoleDropdown(!showRoleDropdown)}
									className="w-full sm:w-auto inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 min-w-[130px]"
								>
									{ROLE_LABELS[inviteRole]}
									<ChevronDown className="h-3.5 w-3.5 text-slate-400" />
								</button>
								{showRoleDropdown && (
									<>
										<div className="fixed inset-0 z-40" onClick={() => setShowRoleDropdown(false)} />
										<div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg z-50 py-1">
											{ROLE_OPTIONS.filter(r => canAssignAdmin || r.value !== 'admin').map(opt => (
												<button
													key={opt.value}
													type="button"
													onClick={() => { setInviteRole(opt.value); setShowRoleDropdown(false) }}
													className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors ${inviteRole === opt.value ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
												>
													<div className="flex items-center gap-2">
														<opt.icon className="h-3.5 w-3.5 text-slate-400" />
														<span className="font-medium text-slate-900 dark:text-gray-100">{opt.label}</span>
													</div>
													<p className="text-[12px] text-slate-400 dark:text-gray-500 mt-0.5 ml-5.5">{opt.description}</p>
												</button>
											))}
										</div>
									</>
								)}
							</div>
							<button
								type="submit"
								disabled={inviteStatus === 'sending' || !inviteEmail.trim()}
								className="kf-primary px-5 py-3 text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{inviteStatus === 'sending' ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : inviteStatus === 'sent' ? (
									<Check className="h-4 w-4" />
								) : (
									'Invite'
								)}
							</button>
						</div>
						{inviteMessage && (
							<p className={`mt-3 text-[13px] ${inviteStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
								{inviteMessage}
							</p>
						)}
					</form>
				)}

				{/* People list */}
				<div className="kf-panel divide-y divide-slate-100 dark:divide-gray-800">
					{/* Owner row */}
					<div className="flex items-center justify-between px-5 py-4">
						<div className="flex items-center gap-3 min-w-0">
							<div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
								<Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
							</div>
							<div className="min-w-0">
								<p className="text-[14px] font-medium text-slate-900 dark:text-gray-100 truncate">
									{userRole === 'owner' ? `${userEmail} (you)` : 'Form owner'}
								</p>
							</div>
						</div>
						<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${getRoleBadgeClasses('owner')}`}>
							{getRoleIcon('owner')}
							Owner
						</span>
					</div>

					{/* Accepted collaborators */}
					{acceptedCollaborators.map(collab => (
						<div key={String(collab.id)} className="flex items-center justify-between px-5 py-4">
							<div className="flex items-center gap-3 min-w-0">
								<div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
									<Users className="h-4 w-4 text-slate-500 dark:text-gray-400" />
								</div>
								<div className="min-w-0">
									<p className="text-[14px] font-medium text-slate-900 dark:text-gray-100 truncate">
										{collab.email}{collab.userId === userId ? ' (you)' : ''}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{actionLoading === String(collab.id) ? (
									<Loader2 className="h-4 w-4 animate-spin text-slate-400" />
								) : (
									<>
										{/* Role badge / role menu */}
										<div className="relative">
											<button
												onClick={() => canManage ? setRoleMenuId(roleMenuId === String(collab.id) ? null : String(collab.id)) : undefined}
												className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${getRoleBadgeClasses(collab.role)} ${canManage ? 'cursor-pointer hover:opacity-80' : ''}`}
												disabled={!canManage}
											>
												{getRoleIcon(collab.role)}
												{ROLE_LABELS[collab.role]}
												{canManage && <ChevronDown className="h-3 w-3" />}
											</button>
											{roleMenuId === String(collab.id) && (
												<>
													<div className="fixed inset-0 z-40" onClick={() => setRoleMenuId(null)} />
													<div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg z-50 py-1">
														{ROLE_OPTIONS.filter(r => canAssignAdmin || r.value !== 'admin').map(opt => (
															<button
																key={opt.value}
																onClick={() => handleRoleChange(String(collab.id), opt.value)}
																className={`w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-gray-700 ${collab.role === opt.value ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
															>
																<div className="flex items-center gap-2">
																	<opt.icon className="h-3.5 w-3.5 text-slate-400" />
																	<span className="font-medium text-slate-900 dark:text-gray-100">{opt.label}</span>
																</div>
															</button>
														))}
													</div>
												</>
											)}
										</div>

										{/* Action menu */}
										{(canManage || collab.userId === userId) && (
											<div className="relative">
												<button
													onClick={() => setActionMenuId(actionMenuId === String(collab.id) ? null : String(collab.id))}
													className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
												>
													<MoreHorizontal className="h-4 w-4" />
												</button>
												{actionMenuId === String(collab.id) && (
													<>
														<div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
														<div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg z-50 py-1">
															{collab.userId === userId ? (
																<button
																	onClick={handleLeave}
																	className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
																>
																	<LogOut className="h-3.5 w-3.5" />
																	Leave form
																</button>
															) : canManage ? (
																<button
																	onClick={() => handleRemove(String(collab.id))}
																	className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
																>
																	<Trash2 className="h-3.5 w-3.5" />
																	Remove
																</button>
															) : null}
														</div>
													</>
												)}
											</div>
										)}
									</>
								)}
							</div>
						</div>
					))}

					{/* Pending invitations */}
					{pendingCollaborators.map(collab => (
						<div key={String(collab.id)} className="flex items-center justify-between px-5 py-4 opacity-70">
							<div className="flex items-center gap-3 min-w-0">
								<div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
									<Mail className="h-4 w-4 text-slate-400 dark:text-gray-500" />
								</div>
								<div className="min-w-0">
									<p className="text-[14px] font-medium text-slate-700 dark:text-gray-300 truncate">
										{collab.email}
									</p>
									<p className="text-[12px] text-slate-400 dark:text-gray-500 flex items-center gap-1">
										<Clock className="h-3 w-3" />
										Pending invitation
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${getRoleBadgeClasses(collab.role)}`}>
									{getRoleIcon(collab.role)}
									{ROLE_LABELS[collab.role]}
								</span>
								{canManage && (
									<button
										onClick={() => handleRemove(String(collab.id))}
										disabled={actionLoading === String(collab.id)}
										className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
										title="Cancel invitation"
									>
										{actionLoading === String(collab.id) ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<X className="h-3.5 w-3.5" />
										)}
									</button>
								)}
							</div>
						</div>
					))}

					{/* Empty state */}
					{activeCollaborators.length === 0 && (
						<div className="px-5 py-8 text-center">
							<Users className="h-8 w-8 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
							<p className="text-[14px] text-slate-500 dark:text-gray-400">
								No collaborators yet. Invite someone to get started.
							</p>
						</div>
					)}
				</div>

				{/* Leave button for non-owner collaborators */}
				{userRole !== 'owner' && (
					<div className="flex justify-end">
						<button
							onClick={handleLeave}
							disabled={leaveLoading}
							className="inline-flex items-center gap-2 text-[13px] font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
						>
							{leaveLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
							Leave this form
						</button>
					</div>
				)}
			</div>
		</section>
	)
}
