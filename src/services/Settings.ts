import { Cached, getOrSetAsync, set } from './Cache'

// Copied from https://stackoverflow.com/a/30106551/134761
// Handles Unicode
function b64EncodeUnicode(str: string) {
	return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
			return String.fromCharCode(parseInt(p1, 16))
	}))
}

function b64DecodeUnicode(str: string) {
	return decodeURIComponent(Array.prototype.map.call(atob(str), (c: string) => {
			return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
	}).join(''))
}

export interface Settings {
	persons: PersonSettings[]
}

export interface PersonSettings {
	personId: AAGUID
	name: string
	jokes: string[]
	photos: Photo[]
}

export interface Photo {
	url: string
	width: number
	height: number

}

export const defaultSettings: Settings = {
	persons: [],
}

const localStorageKeys = {
	settings: 'settings',
}

const cacheAge1Hr = 3600 * 1000

const getDefaultHeaders = (token: string) => {
	const headers = new Headers()
	headers.append('Authorization', `Bearer ${token}`)
	headers.append('Accept', 'application/json')
	headers.append('Content-Type', 'application/json')
	return headers
}

// TODO Complete this
interface GitHubCreateFileResult {
	content: {
		download_url: string,
	},
	commit: any,
	message: string,
}

export class SettingsStore {
	private readonly _settingsCache = new Cached<Settings | undefined>(localStorageKeys.settings, cacheAge1Hr, this._fetchSettingsAsync.bind(this))

	constructor(public githubApiToken?: string, public githubRepoUrl?: string) { }

	public async uploadImageByDataUrlAsync(imageDataUrl: string, remoteFilePath: string): Promise<GitHubCreateFileResult> {
		const apiUrl = this._getFileApiUrl(remoteFilePath)
		if (!apiUrl) { throw new Error('No GitHub repo URL.') }

		const token = this.githubApiToken
		if (!token || token.length === 0) { throw new Error('No GitHub token is configured.') }

		const method = 'PUT'
		const headers = getDefaultHeaders(token)
		const body = {
			message: 'Upload photo.',
			content: b64EncodeUnicode(imageDataUrl),
		}
		console.info(`Upload photo to ${apiUrl}...`)
		const res = await fetch(`${apiUrl}/`, { method, headers, body })
		if (!res.ok) { throw new Error(`Failed to upload photo: ${apiUrl} (${res.status} ${res.statusText}`) }

		console.info(`Upload photo to ${apiUrl}...OK`)
		return res.json()
	}

	public async getSettingsAsync(force = false): Promise<Settings> {
		const settings = await this._settingsCache.getValueAsync(force)
		return settings || defaultSettings
	}

	public async saveSettingsAsync(settings: Settings): Promise<void> {
		const token = this.githubApiToken
		if (!token || token.length === 0) { throw new Error('No GitHub token is configured.') }

		const apiUrl = this._getFileApiUrl('settings.json')
		if (!apiUrl) { throw new Error('No API URL is configured. Make sure the settings.json GitHub repo URL is set.') }

		const headers = getDefaultHeaders(token)
		const body = JSON.stringify({
			files: {
				'settings.json': {
					content: JSON.stringify(settings, null, 2),
				},
			},
		}, null, 2)

		const saveRes = await fetch(apiUrl, { method: 'PATCH', headers, body })
		if (!saveRes.ok) {
			throw new Error(`Failed to save settings: ${saveRes.status} ${saveRes.statusText} ${await saveRes.text()}`)
		}

		this._settingsCache.setValue(settings)
	}

	private _getFileApiUrl(remoteFilePath: string): string | undefined {
		const repoUrl = this.githubRepoUrl
		if (!repoUrl) return undefined

		// From: https://github.com/myuser/myrepo
		// To:   https://api.github.com/repos/myuser/myrepo/contents/settings.json
		const matches = repoUrl.match(/github\.com\/(\w+)\/([\w-]+)/)
		if (!matches) { throw new Error('Did not recognize GitHub repo URL: ' + repoUrl) }

		const [, username, repo] = matches
		return `https://api.github.com/repos/${username}/${repo}/contents/${remoteFilePath}`
	}

	private async _fetchSettingsAsync(): Promise<Settings | undefined> {
		const apiUrl = this._getFileApiUrl('settings.json')
		if (!apiUrl) {
			console.warn('No API url.')
			return undefined
		}
		const token = this.githubApiToken
		if (!token) {
			console.warn('No API token.')
			return
		}

		console.debug('Fetching settings from: ' + apiUrl)

		const headers = getDefaultHeaders(token)

		const res = await fetch(apiUrl, { headers })
		if (!res.ok) {
			console.warn('Failed to get settings.json.', res)
			return defaultSettings
		}

		const body = await res.json()
		if (body.encoding !== 'base64') { throw new Error('Unknown encoding in settings.json: ' + body.encoding) }

		// Content is base64 encoded JSON
		const settings: Settings = JSON.parse(b64DecodeUnicode(body.content))

		// TODO Validate more in depth
		if (!settings || !settings.persons || settings.persons.constructor !== Array) {
			console.error('Invalid settings stored.', settings)
			return defaultSettings
		}

		console.info('Loaded settings.', settings)
		return settings
	}
}

/** Singleton instance of settings store. */
export const settingsStore = new SettingsStore()

export default SettingsStore
