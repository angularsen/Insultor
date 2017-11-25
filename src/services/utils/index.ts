import { clearTimeout, setTimeout } from 'timers'

/** Debounce, copied from underscoreJS */
// export function debounce<T>(func: (arg: T) => void, wait: number, immediate: boolean = false) {
// 	let timeoutHandle: NodeJS.Timer | null = null
// 	return (arg: T) => {
// 		// tslint:disable-next-line:no-this-assignment
// 		const context = this
// 		const later = () => {
// 			timeoutHandle = null
// 			if (!immediate) func.apply(context, [arg])
// 		}
// 		const callNow = immediate && !timeoutHandle
// 		clearTimeout(timeoutHandle!)
// 		timeoutHandle = setTimeout(later, wait)
// 		if (callNow) func.apply(context, arg)
// 	}
// }

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
