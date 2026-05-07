import { createProductionServer, createSqliteServerStore } from '@korajs/server'

const store = createSqliteServerStore({ filename: './koraforms-server.db' })

const server = createProductionServer({
	store,
	port: Number(process.env.PORT) || 3001,
	staticDir: './dist',
	syncPath: '/kora-sync',
})

server.start().then((url) => {
	console.log(`KoraForms running at ${url}`)
})
