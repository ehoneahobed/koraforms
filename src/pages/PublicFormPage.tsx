import { useParams, useNavigate } from 'react-router-dom'
import { FormFill } from './FormFill'

export function PublicFormPage() {
	const { formId } = useParams()
	const nav = useNavigate()
	const navigate = (path: string) => {
		if (path === 'dashboard') return nav('/dashboard')
		if (path === '' || path === '/') return nav('/')
		nav(path)
	}
	return <FormFill formId={formId!} navigate={navigate} />
}
