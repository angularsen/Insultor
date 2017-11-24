import { clearTimeout, setTimeout } from 'timers'

import * as React from 'react'
import { defaultSettings, Settings } from './services/Settings'

function debounce<T>(func: (arg: T) => void, wait: number, immediate: boolean = false) {
	let timeout: NodeJS.Timer | null = null
	return function() {
		// tslint:disable-next-line:no-this-assignment
		const context = this
		const args = arguments
		const later = () => {
			timeout = null
			if (!immediate) func.apply(context, args)
		}
		const callNow = immediate && !timeout
		clearTimeout(timeout!)
		timeout = setTimeout(later, wait)
		if (callNow) func.apply(context, args)
	}
}

const GITHUB_TOKEN = 'GITHUB_GISTS_TOKEN'
const SETTINGS_GIST_URL = 'GITHUB_GISTS_TOKEN'

class Component extends React.Component<{}, { githubToken: string, settingsGistUrl: string, settings: Settings }> {

	private _onTokenChange = debounce((event: React.FormEvent<HTMLInputElement>) => {
		console.info('Saved github token to local storage.')
		localStorage.setItem(GITHUB_TOKEN, event.currentTarget.value)

		// this.reload()
		// fetch()
	}, 1000)

	private _onSettingsGistUrlChange = debounce((event: React.FormEvent<HTMLInputElement>) => {
		console.info('Saved settings gist URL to local storage.')
		localStorage.setItem(SETTINGS_GIST_URL, event.currentTarget.value)

		// this.reload()
		// fetch()
	}, 1000)

	constructor() {
		super()

		this.state = {
			githubToken: localStorage.getItem(GITHUB_TOKEN) || '',
			settingsGistUrl: localStorage.getItem(SETTINGS_GIST_URL) || '',
			settings: defaultSettings,
		}

		this._onTokenChange = this._onTokenChange.bind(this)
		this._onSettingsGistUrlChange = this._onSettingsGistUrlChange.bind(this)
		this._getSettingsAsync = this._getSettingsAsync.bind(this)
		this._reloadAsync = this._reloadAsync.bind(this)
	}

	public render() {
		const { githubToken, settingsGistUrl } = this.state

		return (
			<div>
				<h1>Innstillinger</h1>
				<label>GitHub Token</label>
				<input type='text' defaultValue={githubToken} onChange={this._onTokenChange} />
				<label>Settings Gist URL</label>
				<input type='text' defaultValue={settingsGistUrl} onChange={this._onSettingsGistUrlChange} />

				<h1>Personer</h1>
			</div>
		)
	}

	private async _reloadAsync() {
		const settings = await this._getSettingsAsync()
		this.setState({ settings })

	}

	private async _getSettingsAsync(): Promise<Settings> {
		const url = 'https://rawgit.com/angularsen/08998fe7673b485de800a4c1c1780e62/raw/08473af35b7dd7b8d32ab4ec13ed5670bea60b32/settings.json'
		const res = await fetch(url)
		const ok = res.status >= 200 && res.status <= 300
		if (!ok) {
			console.warn('Failed to get settings.', res)
			return defaultSettings
		}

		const settings: Settings = await res.json()
		if (!settings || !settings.persons) {
			console.error('Invalid settings stored.', settings)
			return defaultSettings
		}

		console.info('Loaded settings.', settings)
		return settings
	}
}

export default Component
