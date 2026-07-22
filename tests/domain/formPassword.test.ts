import test from 'node:test'
import assert from 'node:assert/strict'
import {
	clearFormAccessPassword,
	hasFormAccessPassword,
	stripFormAccessSecrets,
	withFormAccessPasswordHash,
	FORM_PASSWORD_ALGORITHM,
	FORM_PASSWORD_ITERATIONS,
} from '../../src/domain/formPassword'

test('form access password helpers detect legacy and hashed settings', () => {
	assert.equal(hasFormAccessPassword({}), false)
	assert.equal(hasFormAccessPassword({ password: 'legacy' }), true)
	assert.equal(hasFormAccessPassword({ passwordHash: 'hash', passwordSalt: 'salt' }), true)
})

test('form access password helpers strip every stored secret', () => {
	const settings = {
		publicResults: true,
		password: 'legacy',
		passwordHash: 'hash',
		passwordSalt: 'salt',
		passwordAlgorithm: FORM_PASSWORD_ALGORITHM,
		passwordIterations: FORM_PASSWORD_ITERATIONS,
	} as const

	assert.deepEqual(clearFormAccessPassword(settings), { publicResults: true })
	assert.deepEqual(stripFormAccessSecrets(settings), { publicResults: true })
})

test('form access password hashing stores metadata instead of plaintext', async () => {
	const settings = await withFormAccessPasswordHash({ publicResults: true }, 'field-secret')

	assert.equal(settings.publicResults, true)
	assert.equal(settings.password, undefined)
	assert.equal(settings.passwordAlgorithm, FORM_PASSWORD_ALGORITHM)
	assert.equal(settings.passwordIterations, FORM_PASSWORD_ITERATIONS)
	assert.equal(typeof settings.passwordHash, 'string')
	assert.equal(typeof settings.passwordSalt, 'string')
	assert.notEqual(settings.passwordHash, 'field-secret')
})
