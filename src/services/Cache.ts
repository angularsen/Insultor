const moment = require('moment-mini')

export const MAX_AGE_1DAY = 24 * 3600 * 1000

function getOrPruneIfOld<T>(cacheKey: string): T | undefined {
	const entryJson = localStorage.getItem(cacheKey)
	if (entryJson === undefined) { return undefined }

	try {
		const entry = JSON.parse(entryJson)
		if (entry._cacheExpires && moment(entry._cacheExpires) > moment()) {
			// Not expired
			return entry
		}
		// Expired or no expiration info found
		return undefined
	} catch (err) {
		console.error('Failed to parse cache info from local storage. Clearing cache entry.', err)
		localStorage.removeItem(cacheKey)
		return undefined
	}
}

export async function getOrSetAsync<T>(cacheKey: string, maxAgeMs: number, factory: () => Promise<T>): Promise<T> {
	const entry = getOrPruneIfOld<T>(cacheKey)

	if (entry !== undefined) {
		return entry
	}

	const value: T = await factory()

	// Spread does not support generic type T
	// tslint:disable-next-line:prefer-object-spread
	const newEntry = Object.assign({}, value, { _cacheExpires: moment.utc().toISOString() })
	localStorage.setItem(cacheKey, JSON.stringify(newEntry))
	return value
}

export default {
	MAX_AGE_1DAY,
	getOrSetAsync,
}
