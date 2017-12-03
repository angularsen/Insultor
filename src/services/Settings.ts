import { getOrSetAsync } from './Cache'
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

export class SettingsStore {
	public githubApiToken?: string
	public githubRepoUrl?: string

	public getSettingsAsync(): Promise<Settings> {
		return getOrSetAsync<Settings>(localStorageKeys.settings, cacheAge1Hr, async () => {
			const apiUrl = this._getSettingsApiUrl()
			if (!apiUrl) {
				console.warn('No API url, returning default settings.')
				return defaultSettings
			}

			console.debug('Fetching settings from: ' + apiUrl)
			const res = await fetch(apiUrl)
			if (!res.ok) {
				console.warn('Failed to get settings.json.', res)
				return defaultSettings
			}

			const body = await res.json()
			if (body.encoding !== 'base64') { throw new Error('Unknown encoding in settings.json: ' + body.encoding) }

			// Content is base64 encoded JSON
			const settings: Settings = JSON.parse(atob(body.content))

			// TODO Validate more in depth
			if (!settings || !settings.persons || settings.persons.constructor !== Array) {
				console.error('Invalid settings stored.', settings)
				return defaultSettings
			}

			console.info('Loaded settings.', settings)
			return settings
		})
	}

	public async saveSettingsAsync(settings: Settings): Promise<void> {
		const token = this.githubApiToken
		if (!token || token.length === 0) { throw new Error('No GitHub token is configured.') }

		const apiUrl = this._getSettingsApiUrl()
		if (!apiUrl) { throw new Error('No API URL is configured. Make sure the settings.json GitHub repo URL is set.') }

		const headers = new Headers()
		headers.append('Authorization', `Bearer ${token}`)
		headers.append('Accept', 'application/json')
		headers.append('Content-Type', 'application/json')

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

	}

	private _getSettingsApiUrl(): string | undefined {
		const repoUrl = this.githubRepoUrl
		if (!repoUrl) return undefined

		// From: https://github.com/myuser/myrepo
		// To:   https://api.github.com/repos/myuser/myrepo/contents/settings.json
		const matches = repoUrl.match(/github\.com\/(\w+)\/([\w-]+)/)
		if (!matches) { throw new Error('Did not recognize GitHub repo URL: ' + repoUrl) }

		const [, username, repo] = matches
		return `https://api.github.com/repos/${username}/${repo}/contents/settings.json`
	}

}

export default SettingsStore
