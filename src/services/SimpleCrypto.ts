export interface EncryptedText {
	iv: Uint8Array,
	buffer: ArrayBuffer,
}

export async function encryptText(plainText: string, passphrase: string): Promise<EncryptedText> {
	const plainTextUtf8 = new TextEncoder().encode(plainText)
	const passwordUtf8 = new TextEncoder().encode(passphrase)

	const passwordHash = await crypto.subtle.digest('SHA-256', passwordUtf8)

	const iv = crypto.getRandomValues(new Uint8Array(12))
	const alg = { name: 'AES-GCM', iv }
	const key = await crypto.subtle.importKey('raw', passwordHash, alg, false, ['encrypt'])
	const buffer = await crypto.subtle.encrypt(alg, key, plainTextUtf8)

	return { iv, buffer }
}

export async function decryptText(encrypted: EncryptedText, passphrase: string): Promise<string> {
	const passwordUtf8 = new TextEncoder().encode(passphrase)
	const passwordHash = await crypto.subtle.digest('SHA-256', passwordUtf8)

	const alg = { name: 'AES-GCM', iv: encrypted.iv }
	const key = await crypto.subtle.importKey('raw', passwordHash, alg, false, ['decrypt'])
	const plainTextBuffer = await crypto.subtle.decrypt(alg, key, encrypted.buffer)

	const plainText = new TextDecoder().decode(plainTextBuffer)
	return plainText
}

const index = {
	encryptText,
	decryptText,
}
export default index
