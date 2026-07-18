import { createKoraAuth } from '@korajs/auth'

const serverUrl = import.meta.env.VITE_AUTH_URL ||
	`${window.location.protocol}//${window.location.host}`

export const authClient = createKoraAuth({ serverUrl })
