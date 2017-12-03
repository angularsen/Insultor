export async function encryptText(plainText: string, password: string): any {
	const ptUtf8 = new TextEncoder().encode(plainText)

	const pwUtf8 = new TextEncoder().encode(password)
	const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8)

	const iv = crypto.getRandomValues(new Uint8Array(12))
	const alg = { name: 'AES-GCM', iv }
	const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['encrypt'])

	return { iv, encrypted: await crypto.subtle.encrypt(alg, key, ptUtf8) }
}
