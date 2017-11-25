import * as React from 'react'
import { debounce } from 'underscore'
import { defaultSettings, Settings } from './services/Settings'

/** localStorage key names */
const storageKeys = {
	githubToken: 'GITHUB_GISTS_TOKEN',
	settingsGistUrl: 'GIST_URL',
}

class Component extends React.Component<{}, { githubToken: string, settingsGistUrl: string, settings: Settings }> {

	private readonly _onTokenChange = debounce((value: string) => {
		console.info('Saved github token to local storage.')
		localStorage.setItem(storageKeys.githubToken, value)
		this._loadSettingsAsync()
	}, 1000)

	private readonly _onSettingsGistUrlChange = debounce((value: string) => {
		console.info('Saved settings gist URL to local storage.')
		localStorage.setItem(storageKeys.settingsGistUrl, value)
		this._loadSettingsAsync()
	}, 1000)

	constructor() {
		super()

		this.state = {
			githubToken: localStorage.getItem(storageKeys.githubToken) || '',
			settingsGistUrl: localStorage.getItem(storageKeys.settingsGistUrl) || '',
			settings: defaultSettings,
		}

		this._onTokenChange = this._onTokenChange.bind(this)
		this._onSettingsGistUrlChange = this._onSettingsGistUrlChange.bind(this)
		this._getSettingsAsync = this._getSettingsAsync.bind(this)
		this._loadSettingsAsync = this._loadSettingsAsync.bind(this)
	}

	public componentDidMount() {
		// Can't await here
		this._loadSettingsAsync()
	}

	public render() {
		const { githubToken, settingsGistUrl } = this.state

		return (
			<div>
				<h1>Innstillinger</h1>
				<label>GitHub Token</label>
				<input type='text' defaultValue={githubToken} onChange={ev => this._onTokenChange(ev.currentTarget.value)} />
				<label>Settings Gist URL</label>
				<input type='text' defaultValue={settingsGistUrl} onChange={ev => this._onSettingsGistUrlChange(ev.currentTarget.value)} />

				<h1>Personer</h1>
				{this.state.settings && this.state.settings.persons
					? (<div>
							{this.state.settings.persons.map(p => (
							<div ref={p.personId}>
								<p>{p.name} ({p.personId})</p>
								<ul>{p.jokes.map((joke, jokeIdx) =>
									(<li ref={jokeIdx.toString()}>{joke}</li>))}
								</ul>
							</div>))}
						</div>)
					: (<div>Ingen personer lastet..</div>)
				}
			</div>
		)
	}

	private async _loadSettingsAsync() {
		try {
			const gistUrl = localStorage.getItem(storageKeys.settingsGistUrl)
			const token = localStorage.getItem(storageKeys.githubToken)
			if (!gistUrl) {
				console.warn('Cannot load settings. Gist URL not set.')
				return
			}
			if (!token) {
				console.warn('Cannot load settings. GitHub token not set.')
				return
			}

			// 'https://rawgit.com/angularsen/08998fe7673b485de800a4c1c1780e62/raw/08473af35b7dd7b8d32ab4ec13ed5670bea60b32/settings.json'
			// Use rawgit.com to read JSON with correct content-type headers

			const settings = await this._getSettingsAsync(gistUrl)
			this.setState({ settings })
		} catch (err) {
			console.error('Failed to load settings.', err)
		}
	}

	private async _getSettingsAsync(gistUrl: string): Promise<Settings> {
		// From: https://gist.github.com/angularsen/08998fe7673b485de800a4c1c1780e62
		// To:   https://api.github.com/gists/08998fe7673b485de800a4c1c1780e62
		const matches = gistUrl.match(/gist.github.com\/(.*?)\/(.*?)\//)
		if (!matches || matches.length <= 1) { return }

		const [, username, gistId] = matches
		const rawGitUrl = gistUrl.replace('gist.github.com', 'rawgit.com')
		const res = await fetch(gistUrl)
		if (!res.ok) {
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
