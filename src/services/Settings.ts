import { Cached } from './Cache'
import { HttpError } from './MicrosoftFaceApi'
import { b64DecodeUnicode, b64EncodeUnicode } from './utils'
import { EventDispatcher, IEvent } from './utils/Events'

function decodeSettingsContent(settingsObj: GetFileResponse): Settings {
	return JSON.parse(b64DecodeUnicode(settingsObj.content))
}

/** localStorage key names */
const storageKeys = {
	githubToken: 'GITHUB_GISTS_TOKEN',
	githubRepoUrl: 'GIST_URL',
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
	/** Microsoft Face API - person ID */
	personId: AAGUID
	name: string
	nickname: string
	jokes: string[]
	photos: Photo[]
	overrides?: {
		commentCooldownMs?: number,
	}
}

export interface Photo {
	path: string
	url: string
	width: number
	height: number
	/**
	 * Microsoft Face API - a persisted face ID obtained by uploading this photo as a person face
	 */
	personFaceId?: AAGUID
}

export function getDefaultSettings(): Settings {
	return {
		persons: [],
	}
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
	public get onSettingsChanged(): IEvent<Settings> { return this.onSettingsChangedDispatcher }

	/**
	 * Last loaded settings or default settings if not yet loaded or no settings stored.
	 * Use this to synchronously read the settings instead of the async getSettings() function.
	 */
	public get currentSettingsOrDefault(): Settings {
		return this._currentSettings || getDefaultSettings()
	}

	private _currentSettings?: Settings
	private readonly _settingsCache =
		new Cached<GetFileResponse | undefined>(localStorageKeys.settingsObject, cacheAge1Hr, this._fetchSettingsAsync.bind(this))

	private readonly onSettingsChangedDispatcher = new EventDispatcher<Settings>()

	constructor(githubApiToken?: string, githubRepoUrl?: string) {
		if (githubApiToken) { this.githubApiToken = githubApiToken }
		if (githubRepoUrl) { this.githubRepoUrl = githubRepoUrl }
	}

	public get githubRepoUrl(): string | undefined { return localStorage.getItem(storageKeys.githubRepoUrl) || undefined }
	public set githubRepoUrl(value: string | undefined) {
		const key = storageKeys.githubRepoUrl
		if (value) {
			localStorage.setItem(key, value)
		} else {
			localStorage.removeItem(key) }
	}

	public get githubApiToken(): string | undefined { return localStorage.getItem(storageKeys.githubToken) || undefined }
	public set githubApiToken(value: string | undefined) {
		const key = storageKeys.githubToken
		if (value) {
			localStorage.setItem(key, value)
		} else {
			localStorage.removeItem(key)
		}
	}

	public async deletePersonAsync(personId: AAGUID) {
		console.debug(`Delete person ${personId}...`)

		const settings = await this.getSettingsAsync()
		const person = settings.persons.find(p => p.personId === personId)
		if (!person) {
			console.warn(`Person already deleted. Id: ${personId}`)
			return
		}

		console.debug('Delete person files...')
		await this.deleteFilesAsync(person.photos.map(photo => photo.path))
		console.info('Delete person files...OK.')

		settings.persons = settings.persons.filter(p => p.personId !== personId)
		this.saveSettingsAsync(settings)
	}

	public async deleteFileAsync(path: string): Promise<void> {
		console.debug(`Delete file ${path}...`)
		const token = this.githubApiToken
		const fileApiUrl = this._getContentsApiUrl(path)
		if (!fileApiUrl) { throw new Error('No API url.') }
		if (!token) { throw new Error('No API token.') }

		let file: GetFileResponse
		try {
			file = await this.getFileAsync(path)
		} catch (err) {
			if (err instanceof HttpError && err.response.status === 404) {
				console.warn(`Delete file ${path}...OK. Already deleted.`)
				return
			}
			throw err
		}

		const headers = getDefaultHeaders(token)
		const body = JSON.stringify({
			message: 'Delete file ' + path,
			sha: file.sha,
		})

		const res = await fetch(fileApiUrl, { method: 'DELETE', headers, body })
		if (res.status === 404) {
			console.warn(`Delete file ${path}...OK. Already deleted.`)
		} else if (!res.ok) {
			throw new HttpError(`Failed to delete file [${path}}: ${res.status} ${res.statusText}`, res)
		} else {
			console.info(`Delete file ${path}...OK.`)
		}
	}

	public async deleteFilesAsync(paths: string[]): Promise<void> {
		console.debug(`Delete files [${paths.join(', ')}]...`)

		await Promise.all(paths.map(path => this.deleteFileAsync(path)))
		console.info(`Delete files [${paths.join(', ')}]...OK`)
	}

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

			const settings =  decodeSettingsContent(settingsObj)
			this._currentSettings = settings
			return settings
		}
		return getDefaultSettings()
	}

	public async saveSettingsAsync(settings: Settings): Promise<Settings> {
		// May not exist if creating settings for the first time
		const existingSettingsObj = await this._settingsCache.getValueAsync()

		const existingBlobSha = existingSettingsObj && existingSettingsObj.sha
		const settingsJson = JSON.stringify(settings, null, 2)
		const saveRes = await this._saveFileAsync('settings.json', settingsJson, 'Update settings.', existingBlobSha)
		console.debug('Saved settings.', saveRes)

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
		const [/*entire match*/, /*imageType*/, imageDataBase64] = matches

		const result = await this._saveFileAsync(remoteFilePath, imageDataBase64, 'Upload photo.', undefined, false)

		console.info(`Upload photo to ${remoteFilePath}...OK`)
		return result
	}

	public async getFileAsync(remoteFilePath: string): Promise<GetFileResponse> {
		const fileApiUrl = this._getContentsApiUrl(remoteFilePath)
		const token = this.githubApiToken
		if (!fileApiUrl) { throw new Error('No API url.') }
		if (!token) { throw new Error('No API token.') }

		console.debug(`Read file: ${fileApiUrl}...`)
		const headers = getDefaultHeaders(token)

		const res = await fetch(fileApiUrl, { headers })
		if (!res.ok) {
			console.warn(`Read file: ${fileApiUrl}...FAILED.`, res)
			throw new HttpError(`Failed to get ${fileApiUrl}: ${res.status} ${res.statusText}`, res)
		}
		console.info(`Read file: ${fileApiUrl}...OK.`)

		const resBody: GetFileResponse = await res.json()
		return resBody
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
		const resBody = await this.getFileAsync('settings.json')
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
		this.onSettingsChangedDispatcher.dispatch(settings)
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

// /** Singleton instance of settings store. */
// export const settingsStore = new SettingsStore()
export default SettingsStore
