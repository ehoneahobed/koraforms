import test from 'node:test'
import assert from 'node:assert/strict'
import {
	LOCAL_BLOB_STORAGE_KIND,
	collectLocalBlobManifestsFromResponseJson,
	serializeLocalBlobManifest,
	type LocalBlobManifest,
} from '../../../src/features/form-fill/blobStorage'

test('collects local blob manifests from response JSON', () => {
	const manifest: LocalBlobManifest = {
		kind: LOCAL_BLOB_STORAGE_KIND,
		blobId: 'blob-1',
		name: 'field-photo.jpg',
		type: 'image/jpeg',
		size: 1234,
		createdAt: 100,
	}

	assert.deepEqual(
		collectLocalBlobManifestsFromResponseJson(JSON.stringify({
			name: 'Ada',
			photo: serializeLocalBlobManifest(manifest),
			count: 3,
		})),
		[manifest],
	)
})

test('ignores invalid local blob response payloads', () => {
	assert.deepEqual(collectLocalBlobManifestsFromResponseJson('not json'), [])
	assert.deepEqual(collectLocalBlobManifestsFromResponseJson('[]'), [])
	assert.deepEqual(collectLocalBlobManifestsFromResponseJson(JSON.stringify({ file: '{"kind":"koraforms-local-blob"}' })), [])
})
