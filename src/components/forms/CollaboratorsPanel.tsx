import { useMemo, useState } from 'react'
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
	RotateCw,
	Copy,
} from 'lucide-react'
import { useInvitations, useMembers } from '@korajs/spaces/react'
import {
	ROLE_LABELS,
	ROLE_DESCRIPTIONS,
	MAX_PEOPLE_PER_FORM,
	collaboratorRole,
} from '../../features/collaborators/access'
import { useFormPeople, useFormRole } from '../../features/collaborators/hooks'
import { formSpace, sharingErrorMessage, spaces } from '../../features/collaborators/spaces'
import type { CollaboratorRole, FormRole } from '../../types'

interface CollaboratorsPanelProps {
	formId: string
	formTitle: string
	userId: string
}

const ROLE_OPTIONS: { value: CollaboratorRole; label: string; description: string; icon: typeof Eye }[] = [
	{ value: 'viewer', label: 'Viewer', description: ROLE_DESCRIPTIONS.viewer, icon: Eye },
	{ value: 'editor', label: 'Editor', description: ROLE_DESCRIPTIONS.editor, icon: Pencil },
	{ value: 'admin', label: 'Admin', description: ROLE_DESCRIPTIONS.admin, icon: Shield },
]

const RANK: Record<FormRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 }

export function CollaboratorsPanel({ formId, formTitle, userId }: CollaboratorsPanelProps) {
	const space = useMemo(() => formSpace(formId), [formId])
	const myRole = useFormRole(formId, userId)?.role ?? null
	const members = useMembers(space)
	const invitations = useInvitations(space)
	const people = useFormPeople(formId, useMemo(() => members.map((m) => m.userId), [members]))

	const [inviteEmail, setInviteEmail] = useState('')
	const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor')
	const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
	const [inviteMessage, setInviteMessage] = useState('')
	const [inviteLink, setInviteLink] = useState('')
	const [actionMenuId, setActionMenuId] = useState<string | null>(null)
	const [roleMenuId, setRoleMenuId] = useState<string | null>(null)
	const [actionLoading, setActionLoading] = useState<string | null>(null)
	const [actionError, setActionError] = useState('')
	const [showRoleDropdown, setShowRoleDropdown] = useState(false)

	const myRank = myRole ? RANK[myRole] : -1
	const canManage = myRank >= RANK.admin
	// You grant only roles below your own, and act only on people below you.
	const grantable = ROLE_OPTIONS.filter((option) => RANK[option.value] < myRank)
	const canActOn = (role: string) => canManage && RANK[collaboratorRole(role)] < myRank
	const owner = members.find((m) => m.isOwner)
	const collaborators = members.filter((m) => !m.isOwner)

	function nameOf(memberId: string): string {
		const person = people.get(memberId)
		const label = person?.name || person?.email || (memberId === owner?.userId ? 'Form owner' : 'Collaborator')
		return memberId === userId ? `${label} (you)` : label
	}

	async function act(id: string, run: () => Promise<unknown>, fallback: string) {
		setActionLoading(id)
		setActionError('')
		try {
			await run()
		} catch (error) {
			setActionError(sharingErrorMessage(error, fallback))
		} finally {
			setActionLoading(null)
		}
	}

	async function invite(email: string, role: CollaboratorRole) {
		setInviteStatus('sending')
		setInviteMessage('')
		setInviteLink('')
		try {
			const result = await spaces.invite(space, { email, role })
			setInviteStatus('sent')
			setInviteMessage(result.url ? `Invitation saved. No email is configured here: share this link with ${email}.` : `Invitation sent to ${email}.`)
			setInviteLink(result.url ?? '')
			setInviteEmail('')
			if (!result.url) setTimeout(() => setInviteStatus('idle'), 3000)
		} catch (error) {
			setInviteStatus('error')
			setInviteMessage(sharingErrorMessage(error, 'Failed to send the invitation.'))
		}
	}

	function handleInvite(e: React.FormEvent) {
		e.preventDefault()
		const email = inviteEmail.trim().toLowerCase()
		if (email) void invite(email, inviteRole)
	}

	function getRoleIcon(role: FormRole) {
		if (role === 'owner') return <Crown className="h-3.5 w-3.5 text-amber-500" />
		if (role === 'admin') return <Shield className="h-3.5 w-3.5 text-violet-500" />
		if (role === 'editor') return <Pencil className="h-3.5 w-3.5 text-blue-500" />
		return <Eye className="h-3.5 w-3.5 text-gray-400" />
	}

	function getRoleBadgeClasses(role: FormRole) {
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
						{collaborators.length + 1} / {MAX_PEOPLE_PER_FORM + 1} people
					</div>
				</div>

				{/* Invite form: owner and admins */}
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
											{grantable.map(opt => (
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
								) : inviteStatus === 'sent' && !inviteLink ? (
									<Check className="h-4 w-4" />
								) : (
									'Invite'
								)}
							</button>
						</div>
						{inviteMessage && (
							<p role={inviteStatus === 'error' ? 'alert' : 'status'} className={`mt-3 text-[13px] ${inviteStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
								{inviteMessage}
							</p>
						)}
						{inviteLink && (
							<div className="mt-2 flex items-center gap-2">
								<input readOnly value={inviteLink} aria-label="Invitation link" className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
								<button type="button" onClick={() => void navigator.clipboard?.writeText(inviteLink)} className="kf-control p-2" title="Copy link">
									<Copy className="h-3.5 w-3.5" />
								</button>
							</div>
						)}
					</form>
				)}

				{actionError && (
					<p role="alert" className="text-[13px] text-red-600 dark:text-red-400">{actionError}</p>
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
									{owner ? nameOf(owner.userId) : 'Form owner'}
								</p>
							</div>
						</div>
						<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${getRoleBadgeClasses('owner')}`}>
							{getRoleIcon('owner')}
							Owner
						</span>
					</div>

					{/* Members */}
					{collaborators.map(member => {
						const role = collaboratorRole(member.role)
						const manageable = canActOn(member.role)
						const isMe = member.userId === userId
						return (
							<div key={member.userId} className="flex items-center justify-between px-5 py-4">
								<div className="flex items-center gap-3 min-w-0">
									<div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
										<Users className="h-4 w-4 text-slate-500 dark:text-gray-400" />
									</div>
									<div className="min-w-0">
										<p className="text-[14px] font-medium text-slate-900 dark:text-gray-100 truncate">
											{nameOf(member.userId)}
										</p>
										{people.get(member.userId)?.name && people.get(member.userId)?.email && (
											<p className="text-[12px] text-slate-400 dark:text-gray-500 truncate">{people.get(member.userId)?.email}</p>
										)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{actionLoading === member.userId ? (
										<Loader2 className="h-4 w-4 animate-spin text-slate-400" />
									) : (
										<>
											<div className="relative">
												<button
													onClick={() => manageable ? setRoleMenuId(roleMenuId === member.userId ? null : member.userId) : undefined}
													className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${getRoleBadgeClasses(role)} ${manageable ? 'cursor-pointer hover:opacity-80' : ''}`}
													disabled={!manageable}
												>
													{getRoleIcon(role)}
													{ROLE_LABELS[role]}
													{manageable && <ChevronDown className="h-3 w-3" />}
												</button>
												{roleMenuId === member.userId && (
													<>
														<div className="fixed inset-0 z-40" onClick={() => setRoleMenuId(null)} />
														<div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg z-50 py-1">
															{grantable.map(opt => (
																<button
																	key={opt.value}
																	onClick={() => {
																		setRoleMenuId(null)
																		if (opt.value !== member.role) {
																			void act(member.userId, () => spaces.changeRole(space, member.userId, opt.value, { from: member.role }), 'Failed to change the role.')
																		}
																	}}
																	className={`w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-gray-700 ${member.role === opt.value ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
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

											{(manageable || isMe) && (
												<div className="relative">
													<button
														onClick={() => setActionMenuId(actionMenuId === member.userId ? null : member.userId)}
														aria-label="More actions"
														className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
													>
														<MoreHorizontal className="h-4 w-4" />
													</button>
													{actionMenuId === member.userId && (
														<>
															<div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
															<div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg z-50 py-1">
																<button
																	onClick={() => {
																		setActionMenuId(null)
																		void act(
																			member.userId,
																			() => (isMe ? spaces.leave(space) : spaces.remove(space, member.userId, { from: member.role })),
																			isMe ? 'Failed to leave the form.' : 'Failed to remove this person.',
																		)
																	}}
																	className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
																>
																	{isMe ? <LogOut className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
																	{isMe ? 'Leave form' : 'Remove'}
																</button>
															</div>
														</>
													)}
												</div>
											)}
										</>
									)}
								</div>
							</div>
						)
					})}

					{/* Pending invitations (managers only receive them) */}
					{invitations.map(invitation => {
						const role = collaboratorRole(invitation.role)
						const manageable = canActOn(invitation.role) || invitation.invitedBy === userId
						return (
							<div key={invitation.id} className="flex items-center justify-between px-5 py-4 opacity-80">
								<div className="flex items-center gap-3 min-w-0">
									<div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
										<Mail className="h-4 w-4 text-slate-400 dark:text-gray-500" />
									</div>
									<div className="min-w-0">
										<p className="text-[14px] font-medium text-slate-700 dark:text-gray-300 truncate">
											{invitation.email}
										</p>
										<p className="text-[12px] text-slate-400 dark:text-gray-500 flex items-center gap-1">
											<Clock className="h-3 w-3" />
											{invitation.expired ? 'Invitation expired' : 'Pending invitation'}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${getRoleBadgeClasses(role)}`}>
										{getRoleIcon(role)}
										{ROLE_LABELS[role]}
									</span>
									{manageable && (
										<>
											<button
												onClick={() => void act(invitation.id, () => invite(invitation.email, role), 'Failed to re-send the invitation.')}
												disabled={actionLoading === invitation.id}
												className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
												title="Re-send invitation"
												aria-label={`Re-send the invitation to ${invitation.email}`}
											>
												<RotateCw className="h-3.5 w-3.5" />
											</button>
											<button
												onClick={() => void act(invitation.id, () => spaces.revokeInvitation(invitation.id), 'Failed to cancel the invitation.')}
												disabled={actionLoading === invitation.id}
												className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
												title="Cancel invitation"
												aria-label={`Cancel the invitation to ${invitation.email}`}
											>
												{actionLoading === invitation.id ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<X className="h-3.5 w-3.5" />
												)}
											</button>
										</>
									)}
								</div>
							</div>
						)
					})}

					{/* Empty state */}
					{collaborators.length === 0 && invitations.length === 0 && (
						<div className="px-5 py-8 text-center">
							<Users className="h-8 w-8 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
							<p className="text-[14px] text-slate-500 dark:text-gray-400">
								{canManage ? 'No collaborators yet. Invite someone to get started.' : 'No other collaborators yet.'}
							</p>
						</div>
					)}
				</div>

				{/* Leave, for members who are not the owner */}
				{myRole !== null && myRole !== 'owner' && (
					<div className="flex justify-end">
						<button
							onClick={() => void act('leave', () => spaces.leave(space), 'Failed to leave the form.')}
							disabled={actionLoading === 'leave'}
							className="inline-flex items-center gap-2 text-[13px] font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
						>
							{actionLoading === 'leave' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
							Leave this form
						</button>
					</div>
				)}
			</div>
		</section>
	)
}
