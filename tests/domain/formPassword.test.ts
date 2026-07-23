import test from 'node:test'
import assert from 'node:assert/strict'
import { hashSecret } from '@korajs/core'
import {
	clearFormAccessPassword,
	hasFormAccessPasswordSecret,
	stripFormAccessSecrets,
	verifyFormAccessPasswordSecret,
} from '../../src/domain/formPassword'

test('form access password helpers detect Kora secret values', () => {
	assert.equal(hasFormAccessPasswordSecret(undefined), false)
	assert.equal(hasFormAccessPasswordSecret('secret:v1:hash'), true)
})

test('form access password helpers keep settings free of secrets', () => {
	const settings = { publicResults: true } as const
	assert.deepEqual(clearFormAccessPassword(settings), { publicResults: true })
	assert.deepEqual(stripFormAccessSecrets(settings), { publicResults: true })
})

test('form access password verification uses Kora hashed secrets', async () => {
	const secret = await hashSecret('field-secret')
	assert.notEqual(secret, 'field-secret')
	assert.equal(await verifyFormAccessPasswordSecret(secret, 'field-secret'), true)
	assert.equal(await verifyFormAccessPasswordSecret(secret, 'wrong'), false)
})
