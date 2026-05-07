import sqliteWasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url'

;(globalThis as Record<string, unknown>).__KORA_SQLITE_WASM_URL = sqliteWasmUrl

import '@korajs/store/sqlite-wasm/worker'
