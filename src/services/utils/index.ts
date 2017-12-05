import { clearTimeout, setTimeout } from 'timers'

// Copied from https://stackoverflow.com/a/30106551/134761
// Handles Unicode
export function b64EncodeUnicode(str: string) {
	return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
			return String.fromCharCode(parseInt(p1, 16))
	}))
}

export function b64DecodeUnicode(str: string) {
	return decodeURIComponent(Array.prototype.map.call(atob(str), (c: string) => {
			return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
	}).join(''))
}

export function flatten<T>(arr: T[][]) {
	return arr.reduce((acc: T[], cur: T[]) => [...acc, ...cur], [])
}

/** Utility function to create a K:V from a list of strings */
export function strEnum<T extends string>(o: T[]): {[K in T]: K} {
	return o.reduce((res, key) => {
		res[key] = key
		return res
	}, Object.create(null))
}

/**
 * Verify parameter is not undefined.
 * @param myParam Parameter value
 * @param msg Failure message
 */
export function isDefined<T>(myParam: T | undefined, msg: string): T {
	if (myParam === undefined) {
		throw new Error(`Parameter ${myParam} was undefined: ${msg}`)
	}
	return myParam
}

export function timeout(ms: number): Promise<void> { return new Promise<void>((res) => setTimeout(res, ms)) }

export function withTimeout<T>(srcPromise: Promise<T>, timeoutMs: number, err: string = 'Timed out.') {
	return new Promise<T>((resolve, reject) => {
		srcPromise.then(resolve, reject)
		setTimeout(() => reject(err), timeoutMs)
	})
}
