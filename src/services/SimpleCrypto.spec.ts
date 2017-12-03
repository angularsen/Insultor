import {} from 'jasmine'
import SimpleCrypto from './SimpleCrypto'
const jasmineReporters = require('jasmine-reporters')

jasmine.getEnv().addReporter(new jasmineReporters.TerminalReporter({
	color: true,
	showStack: true,
	verbosity: 3,
}))

describe('SimpleCrypto', () => {
	it('Can encrypt then decrypt', async () => {
		const encrypted = await SimpleCrypto.encryptText('I am secretly in love with you', 'and that is my little secret')
		const decrypted = await SimpleCrypto.decryptText(encrypted, 'and that is my little secret')
		expect(decrypted).toEqual('I am secretly in love with you')
	})
	it('Throws error trying to decrypt with wrong passphrase', async () => {
		const encrypted = await SimpleCrypto.encryptText('I am secretly in love with you', 'and that is my little secret')
		try {
			const decrypted = await SimpleCrypto.decryptText(encrypted, 'but I forgot the secret')
		} catch (err) {
			expect(() => { throw err }).toThrow()
		}
	})
	it('Throws error trying to decrypt with wrong initialization vector (IV)', async () => {
		const differentIv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
		const encrypted = await SimpleCrypto.encryptText('I am secretly in love with you', 'and that is my little secret')
		try {
			const decrypted = await SimpleCrypto.decryptText({ ...encrypted, iv: differentIv }, 'and that is my little secret')
		} catch (err) {
			expect(() => { throw err }).toThrow()
		}
	})
})
