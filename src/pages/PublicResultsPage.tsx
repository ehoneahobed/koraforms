import { useParams, useNavigate } from 'react-router-dom'
import { PublicResults } from './PublicResults'

export function PublicResultsPage() {
	const { slug } = useParams()
	const nav = useNavigate()
	const navigate = (path: string) => {
		if (path === 'dashboard') return nav('/dashboard')
		if (path === '' || path === '/') return nav('/')
		nav(path)
	}
	return <PublicResults slug={slug!} navigate={navigate} />
}
