import test from 'node:test'
import assert from 'node:assert/strict'
import { htmlToPlainText, isRichTextEmpty } from '../../src/utils/plainText'

// The server has no DOM: tags are stripped and entities decoded by hand.
test('htmlToPlainText strips tags and decodes entities without a DOM', () => {
	assert.equal(htmlToPlainText('<p><strong>Tom &amp; Jerry</strong></p>'), 'Tom & Jerry')
	assert.equal(htmlToPlainText('<p>a&nbsp;b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x2014; &#8212;</p>'), 'a b <c> "d" \'e\' — —')
	assert.equal(htmlToPlainText('<p>Unknown &bogus; and &#0; stay</p>'), 'Unknown &bogus; and &#0; stay')
	assert.equal(htmlToPlainText('plain & simple'), 'plain & simple', 'non-HTML text is returned as is')
	assert.equal(htmlToPlainText(''), '')
})

test('isRichTextEmpty sees through empty markup', () => {
	assert.equal(isRichTextEmpty('<p></p>'), true)
	assert.equal(isRichTextEmpty('<p><br></p>'), true)
	assert.equal(isRichTextEmpty('<p>x</p>'), false)
})
