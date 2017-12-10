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

export function isObject(item: any) {
	return (item && typeof item === 'object' && !Array.isArray(item))
}

export default function mergeDeep(target: any, source: any) {
	const output = {...target}
	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach(key => {
			if (isObject(source[key])) {
				if (!(key in target)) {
					Object.assign(output, { [key]: source[key] })
				} else {
					output[key] = mergeDeep(target[key], source[key])
				}
			} else {
				Object.assign(output, { [key]: source[key] })
			}
		})
	}
	return output
}

declare global {
	interface Array<T> {
		/**
		 * Returns the array with distinct/unique elements, optionally based on some property value.
		 */
		distinct<U>(map?: (el: T) => U): T[]
	}
}

if (!Array.prototype.distinct) {
	Array.prototype.distinct = function <T, U>(map?: (el: T) => U): T[] {
		if (map) {
		return this.filter((elem: T, pos: number, arr: T[]) => arr.map(map).indexOf(map(elem)) === pos)
		} else {
			return this.filter((elem: T, pos: number, arr: T[]) => arr.indexOf(elem) === pos)
		}
	}
}

/** Utility function to create a K:V from a list of strings */
export function strEnum<T extends string>(o: T[]): {[K in T]: K} {
	return o.reduce((res, key) => {
		res[key] = key
		return res
	}, Object.create(null))
}

/**
 * Check if value is defined (not null and not undefined).
 * @param myParam Value
 * @param msg Failure message
 */
export function checkDefined<T extends {}>(value: T | undefined | null, message: string): T {
	if (value === undefined || value === null) {
		throw new Error('Value not set: ' + message)
	}
	return value
}

export function delayAsync(ms: number): Promise<void> { return new Promise<void>((res) => setTimeout(res, ms)) }

export function withTimeout<T>(srcPromise: Promise<T>, timeoutMs: number, err: string = 'Timed out.') {
	return new Promise<T>((resolve, reject) => {
		const timeoutTimer = setTimeout(() => reject(err), timeoutMs)
		srcPromise.then(res => {
			clearTimeout(timeoutTimer)
			resolve(res)
		}, reject)
	})
}
