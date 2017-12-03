import {addMilliseconds} from 'date-fns'
export const MAX_AGE_1DAY = 24 * 3600 * 1000

interface Entry<T> {
	_cacheExpires: string
	value: T
}

class Cached<T> {
	public readonly expires: Date

	constructor(public readonly cacheKey: string, public readonly maxAgeMs: number, private readonly _factory: () => Promise<T>) {}
	public getValueAsync(): Promise<T> {
		return getOrSetAsync(this.cacheKey, this.maxAgeMs, this._factory)
	}

	public setValue(value: T): void {
		set<T>(this.cacheKey, value, this.maxAgeMs)
	}
}

function getOrPruneIfOld<T>(cacheKey: string): T | undefined {
	const entryJson = localStorage.getItem(cacheKey)
	if (!entryJson) { return undefined }

	try {
		const entry: Entry<T> = JSON.parse(entryJson)
		if (entry._cacheExpires && new Date(entry._cacheExpires) > new Date()) {
			// Not expired
			return entry.value
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
	set<T>(cacheKey, value, maxAgeMs)
	return value
}

export function set<T>(cacheKey: string, value: T, maxAgeMs: number) {
	const entry = createEntry(value, maxAgeMs)
	localStorage.setItem(cacheKey, JSON.stringify(entry))
}

function createEntry<T>(value: T, maxAgeMs: number): Entry<T> {
	return {
		value,
		_cacheExpires: addMilliseconds(new Date(), maxAgeMs).toISOString(),
	}
}

export default {
	MAX_AGE_1DAY,
	getOrSetAsync,
}
