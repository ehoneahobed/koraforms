import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEmbedCode, qrCodeFilename } from '../../src/utils/embed'

const embedInput = {
	formUrl: 'https://koraforms.test/f/rsvp-night',
	baseUrl: 'https://koraforms.test',
	slug: 'rsvp-night',
}

test('buildEmbedCode creates the inline iframe snippet', () => {
	assert.equal(
		buildEmbedCode({ ...embedInput, mode: 'inline' }),
		'<iframe src="https://koraforms.test/f/rsvp-night?embed=1" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>',
	)
})

test('buildEmbedCode creates popup and slide-in snippets', () => {
	assert.equal(
		buildEmbedCode({ ...embedInput, mode: 'popup' }),
		'<script src="https://koraforms.test/embed.js"></script>\n<button onclick="KoraForms.popup(\'rsvp-night\')">Open Form</button>',
	)
	assert.equal(
		buildEmbedCode({ ...embedInput, mode: 'slidein' }),
		'<script src="https://koraforms.test/embed.js"></script>\n<script>KoraForms.slideIn(\'rsvp-night\', { position: \'right\' })</script>',
	)
})

test('buildEmbedCode escapes slugs before inserting them into JavaScript snippets', () => {
	const embedCode = buildEmbedCode({
		...embedInput,
		mode: 'popup',
		slug: "event's\\night",
	})

	assert.match(embedCode, /KoraForms\.popup\('event\\'s\\\\night'\)/)
})

test('qrCodeFilename normalizes file names with a stable fallback', () => {
	assert.equal(qrCodeFilename('rsvp-night'), 'rsvp-night-qr-code.png')
	assert.equal(qrCodeFilename(' RSVP Night! '), 'RSVP-Night-qr-code.png')
	assert.equal(qrCodeFilename('   '), 'form-qr-code.png')
})
