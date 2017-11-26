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

	constructor(props: {}) {
		super(props)

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
				<form>
					<div className='form-group'>
						<label htmlFor='githubToken'>'Token' for din GitHub konto</label>
						<input id='githubToken' type='url' className='form-control'
							defaultValue={githubToken}
							placeholder='Get token from your github account'
							onChange={ev => this._onTokenChange(ev.currentTarget.value)} />
					</div>

					<div className='form-group'>
						<label htmlFor='gistUrl'>URL til gist for settings.json</label>
						<input id='gistUrl' type='url' className='form-control'
							defaultValue={settingsGistUrl}
							placeholder='https://gist.github.com/{username}/{gist ID}'
							onChange={ev => this._onSettingsGistUrlChange(ev.currentTarget.value)} />
					</div>
				</form>

				<h1>Personer</h1>
				{this.state.settings && this.state.settings.persons
					? (<div>
							{this.state.settings.persons.map(p => (
							<div key={p.personId}>
								<p>{p.name} ({p.personId})</p>
								<ul>{p.jokes.map((joke, jokeIdx) =>
									(<li key={jokeIdx.toString()}>{joke}</li>))}
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
		const matches = gistUrl.match(/gist\.github\.com\/(\w+)\/(\w+)/)
		if (!matches) { throw new Error('Did not recognize gist URL: ' + gistUrl) }

		const [, username, gistId] = matches
		const apiUrl = `https://api.github.com/gists/${gistId}`

		const gistRes = await fetch(apiUrl)
		if (!gistRes.ok) {
			console.warn('Failed to get gist.', gistRes)
			return defaultSettings
		}

		const gistBody = await gistRes.json()
		const settingsRawUrl = gistBody.files['settings.json'].raw_url

		// Get a rawgit.com URL that provides the correct Content-Type headers
		// tslint:disable-next-line:max-line-length
		// From: https://gist.githubusercontent.com/angularsen/08998fe7673b485de800a4c1c1780e62/raw/e1c6f835967a0332b615e68b19066fd6b10967d0/settings.json
		// To: https://rawgit.com/angularsen/08998fe7673b485de800a4c1c1780e62/raw/e1c6f835967a0332b615e68b19066fd6b10967d0/settings.json
		// const settingsRawGitUrl = settingsRawUrl.replace('gist.githubusercontent.com', 'rawgit.com')

		const settingsRes = await fetch(settingsRawUrl)
		const settings: Settings = await settingsRes.json()
		if (!settings || !settings.persons) {
			console.error('Invalid settings stored.', settings)
			return defaultSettings
		}

		console.info('Loaded settings.', settings)
		return settings
	}
}

export default Component
