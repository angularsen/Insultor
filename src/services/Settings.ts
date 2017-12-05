import { Cached, getOrSetAsync, set } from './Cache'
import { b64DecodeUnicode, b64EncodeUnicode } from 'src/services/utils';

function decodeSettingsContent(settingsObj: GetFileResponse): Settings {
	return JSON.parse(b64DecodeUnicode(settingsObj.content))
}

// TODO Complete this
/** GitHub API v3 - Create File */
interface CreateFileResponse {
	content: {
		download_url: string,
	},
	commit: any,
	message: string,
}

/**
 * GitHub API v3 - Get File (object format)
 * settings.json fetched as object media type, to get both info about file as well as the content itself.
 * Using Accept header: application/vnd.github.VERSION.object
 */
export interface GetFileResponse {
	/** settings.json */
	name: string,
	/** settings.json */
	path: string,
	/** Blob SHA (not commit SHA) */
	sha: string,
	/** 1615 */
	size: number,
	/** https://api.github.com/repos/angularsen/Insultor-DB-Test/contents/settings.json?ref=master */
	url: string,
	/** https://github.com/angularsen/Insultor-DB-Test/blob/master/settings.json */
	html_url: string,
	/** https://api.github.com/repos/angularsen/Insultor-DB-Test/git/blobs/40823ce6b543207e696d4ae96ccfd6d04a2a475 */
	git_url: string,
	/** https://raw.githubusercontent.com/angularsen/Insultor-DB-Test/master/settings.json */
	download_url: string,
	/** 'file' or 'dir' */
	type: 'file' | 'dir',
	/** Content, typically base64 encoded. */
	content: string,
	/** Encoding of content. Typically 'base64'. */
	encoding: string,
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
	settingsObject: 'settingsObject',
}

const cacheAge1Hr = 3600 * 1000

const getDefaultHeaders = (token: string) => {
	const headers = new Headers()
	headers.append('Authorization', `Bearer ${token}`)
	headers.append('Accept', 'application/json')
	headers.append('Content-Type', 'application/json')
	return headers
}

export class SettingsStore {
	private readonly _settingsCache =
		new Cached<GetFileResponse | undefined>(localStorageKeys.settingsObject, cacheAge1Hr, this._fetchSettingsAsync.bind(this))

	constructor(public githubApiToken?: string, public githubRepoUrl?: string) { }

	public async getFilesInFolderAsync(remoteDirPath: string): Promise<GetFileResponse[]> {
		const apiUrl = this._getContentsApiUrl(remoteDirPath)
		const token = this.githubApiToken
		if (!apiUrl) { throw new Error('No API url.') }
		if (!token) { throw new Error('No API token.') }

		console.debug(`Read files from dir: ${apiUrl}...`)
		const headers = getDefaultHeaders(token)

		const res = await fetch(apiUrl, { headers })
		if (!res.ok) {
			console.warn(`Read files from dir: ${apiUrl}...ERROR.`, res)
			throw new Error(`Failed to GET ${apiUrl}: ${res.status} ${res.statusText}`)
		}
		console.info(`Read files from dir: ${apiUrl}...OK.`)

		const resBody: GetFileResponse[] = await res.json()
		return resBody

	}

	public async getSettingsAsync(force = false): Promise<Settings> {
		// Also update commit cache to get SHA
		const settingsObj = await this._settingsCache.getValueAsync(force)
		if (settingsObj && settingsObj.content) {
			if (settingsObj.encoding !== 'base64') { throw new Error('Expected base64 encoding of file.') }
			return decodeSettingsContent(settingsObj)
		}
		return defaultSettings
	}

	public async saveSettingsAsync(settings: Settings): Promise<Settings> {
		// May not exist if creating settings for the first time
		const existingSettingsObj = await this._settingsCache.getValueAsync()

		const existingBlobSha = existingSettingsObj && existingSettingsObj.sha
		const settingsJson = JSON.stringify(settings, null, 2)
		const saveRes = await this._saveFileAsync('settings.json', settingsJson, 'Update settings.', existingBlobSha)

		// Update cache
		const updatedSettingsObj = await this._settingsCache.getValueAsync(true)
		if (!updatedSettingsObj) { throw new Error('Failed to update settings.') }

		return decodeSettingsContent(updatedSettingsObj)
	}

	public async uploadImageByDataUrlAsync(imageDataUrl: string, remoteFilePath: string): Promise<CreateFileResponse> {

		console.info(`Upload photo to ${remoteFilePath}...`)
		// From "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby..."
		// To   "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby..."
		const matches = imageDataUrl.match(/data:image\/(png|jpeg);base64,(.*)/)
		if (!matches) { throw new Error('Did not recognize image data URL: ' + imageDataUrl) }
		const [, imageType, imageDataBase64] = matches

		const result = await this._saveFileAsync(remoteFilePath, imageDataBase64, 'Upload photo.', undefined, false)

		console.info(`Upload photo to ${remoteFilePath}...OK`)
		return result
	}

	private _getContentsApiUrl(remotePath: string): string | undefined {
		const repoUrl = this.githubRepoUrl
		if (!repoUrl) return undefined

		// From: https://github.com/myuser/myrepo
		// To:   https://api.github.com/repos/myuser/myrepo/contents/settings.json
		const matches = repoUrl.match(/github\.com\/(\w+)\/([\w-]+)/)
		if (!matches) { throw new Error('Did not recognize GitHub repo URL: ' + repoUrl) }

		const [, username, repo] = matches
		return `https://api.github.com/repos/${username}/${repo}/contents/${remotePath}`
	}

	private async _fetchSettingsAsync(): Promise<GetFileResponse> {
		const resBody = await this._readFileAsync('settings.json')
		console.debug('Fetched settings object', resBody)
		if (resBody.encoding !== 'base64') { throw new Error('Unknown encoding in settings.json: ' + resBody.encoding) }

		// Content is base64 encoded JSON
		const settings: Settings = decodeSettingsContent(resBody)

		// TODO Validate more in depth
		if (!settings || !settings.persons || settings.persons.constructor !== Array) {
			console.error('Invalid settings stored.', settings)
			throw new Error('Invalid settings stored.')
		}

		console.info('Loaded settings.', settings)
		return resBody
	}

	private async _readFileAsync(remoteFilePath: string): Promise<GetFileResponse> {
		const apiUrl = this._getContentsApiUrl(remoteFilePath)
		const token = this.githubApiToken
		if (!apiUrl) { throw new Error('No API url.') }
		if (!token) { throw new Error('No API token.') }

		console.debug(`Read file: ${apiUrl}...`)
		const headers = getDefaultHeaders(token)

		const res = await fetch(apiUrl, { headers })
		if (!res.ok) {
			console.warn('Failed to get settings.json.', res)
			throw new Error(`Failed to get settings.json: ${res.status} ${res.statusText}`)
		}
		console.info(`Read file: ${apiUrl}...OK.`)

		const resBody: GetFileResponse = await res.json()
		return resBody
	}

	private async _saveFileAsync(remoteFilePath: string, content: any, message: string, existingBlobSha?: string, encodeBase64 = true)
		: Promise<CreateFileResponse> {
		const token = this.githubApiToken
		if (!token || token.length === 0) { throw new Error('No GitHub token is configured.') }

		const apiUrl = this._getContentsApiUrl(remoteFilePath)
		if (!apiUrl) { throw new Error('No API URL is configured. Make sure the settings.json GitHub repo URL is set.') }

		const headers = getDefaultHeaders(token)
		const body = JSON.stringify({
			message,
			sha: existingBlobSha,
			content: encodeBase64 ? b64EncodeUnicode(content) : content,
		})

		const saveRes = await fetch(apiUrl, { method: 'PUT', headers, body })
		if (!saveRes.ok) {
			throw new Error(`Failed to save file ${remoteFilePath}: ${saveRes.status} ${saveRes.statusText} ${await saveRes.text()}`)
		}

		const saveResult: CreateFileResponse = await saveRes.json()
		return saveResult
	}
}

/** Singleton instance of settings store. */
export const settingsStore = new SettingsStore()

export default SettingsStore
