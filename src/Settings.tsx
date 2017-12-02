import * as React from 'react'
import { debounce, min } from 'underscore'
import { faceApiConfig } from './services/constants'
import FaceApi from './services/MicrosoftFaceApi'
import { defaultSettings, Settings } from './services/Settings'

/** localStorage key names */
const storageKeys = {
	githubToken: 'GITHUB_GISTS_TOKEN',
	settingsGistUrl: 'GIST_URL',
}

class Component extends React.Component<{}, { settings: Settings }> {
	private _settingsGistUrl?: string = localStorage.getItem(storageKeys.settingsGistUrl) || undefined
	private _githubToken?: string = localStorage.getItem(storageKeys.githubToken) || undefined
	private _addFirstName: HTMLInputElement | null
	private _addLastName: HTMLInputElement | null
	private _addNickname: HTMLInputElement | null

	private readonly _onTokenChange = debounce((value: string) => {
		console.info('Saved github token to local storage.')
		localStorage.setItem(storageKeys.githubToken, value)
		this._githubToken = value
		this._loadSettingsAsync()
	}, 1000)

	private readonly _onSettingsGistUrlChange = debounce((value: string) => {
		console.info('Saved settings gist URL to local storage.')
		localStorage.setItem(storageKeys.settingsGistUrl, value)
		this._settingsGistUrl = value
		this._loadSettingsAsync()
	}, 1000)

	constructor(props: {}) {
		super(props)

		this.state = {
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
		return (
			<div className='container'>
				<div className='row'>
					<div className='col'>
						<h1 className='display-4'>Instillinger</h1>
						<form>
							<div className='form-group'>
								<label htmlFor='githubToken'>GitHub konto token</label>
								<input id='githubToken' type='url' className='form-control'
									defaultValue={this._githubToken}
									placeholder='Eks: 93fb1ef29fc48abe915f04cd4fc8ca0dfb4f216b'
									onChange={ev => this._onTokenChange(ev.currentTarget.value)} />
							</div>

							<div className='form-group'>
								<label htmlFor='gistUrl'>URL til gist for settings.json</label>
								<input id='gistUrl' type='url' className='form-control'
									defaultValue={this._settingsGistUrl}
									placeholder='Eks: https://gist.github.com/{username}/{id}'
									onChange={ev => this._onSettingsGistUrlChange(ev.currentTarget.value)} />
							</div>
						</form>

						<h2>Personer</h2>
						<form>
							<div className='form-group'>
								<label htmlFor='addFirstName'>Fornavn</label>
								<input id='addFirstName' type='text' className='form-control' placeholder='Eks: Ola' ref={(x) => this._addFirstName = x} />
							</div>
							<div className='form-group'>
								<label htmlFor='addLastName'>Etternavn</label>
								<input id='addLastName' type='text' className='form-control' placeholder='Eks: Nordmann' ref={(x) => this._addLastName = x} />
							</div>
							<div className='form-group'>
								<label htmlFor='addNickname'>Kallenavn</label>
								<input id='addNickname' type='text' className='form-control' placeholder='Eks: Ebola' ref={(x) => this._addNickname = x} />
							</div>
							<button type='submit' className='btn btn-primary' onClick={ev => this._createPersonAsync()}>➕ Opprett</button>
						</form>

						{this.state.settings && this.state.settings.persons
							? (<div>
								{this.state.settings.persons.map(p => (
									<div key={p.personId} className='card' style={{width: '21rem'}}>

										<div style={{ display: 'flex' }}>
											<img className='border' style={{ width: '5em', alignSelf: 'baseline' }}
												src={min(p.photos, photo => photo.width).url} alt='Person photo' />
											<div className='' style={{padding: '.5em'}}>
												<h5 className='card-title'>{p.name}</h5>
												<p className='text-muted'><small style={{fontSize: '50%'}}>{p.personId}</small></p>
											</div>
										</div>

										<div className='card-body' style={{fontSize: '.7em'}}>
											<ul style={{ listStyle: 'none', paddingLeft: 0 }}>{p.jokes.map((joke, jokeIdx) =>
												(<li key={jokeIdx.toString()}>{joke}</li>))}
											</ul>
											<a href='#' className='btn btn-primary'>Endre</a>
										</div>

									</div>))}
							</div>)
							: (<div>Ingen personer lastet..</div>)
						}

					</div>
				</div>
			</div>
		)
	}

	private async _loadSettingsAsync() {
		try {
			const settings = await this._getSettingsAsync()
			this.setState({ settings })
		} catch (err) {
			console.error('Failed to load settings.', err)
		}
	}

	private async _saveSettingsAsync(settings: Settings): Promise<void> {
		const token = this._githubToken
		if (!token || token.length === 0) { throw new Error('No GitHub token is configured.') }

		const apiUrl = this._getSettingsApiUrl()
		if (!apiUrl) { throw new Error('No API URL is configured. Make sure the settings.json gist URL is set.') }

		const headers = new Headers()
		headers.append('Authorization', `Bearer ${this._githubToken}`)
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

	private async _getSettingsAsync(): Promise<Settings> {
		const apiUrl = this._getSettingsApiUrl()
		if (!apiUrl) { return defaultSettings }

		const gistRes = await fetch(apiUrl)
		if (!gistRes.ok) {
			console.warn('Failed to get gist.', gistRes)
			return defaultSettings
		}

		const gistBody = await gistRes.json()
		const settingsRawUrl = gistBody.files['settings.json'].raw_url

		const settingsRes = await fetch(settingsRawUrl)
		const settings: Settings = await settingsRes.json()
		if (!settings || !settings.persons) {
			console.error('Invalid settings stored.', settings)
			return defaultSettings
		}

		console.info('Loaded settings.', settings)
		return settings
	}

	private async _createPersonAsync(): Promise<void> {
		const firstName = this._addFirstName && this._addFirstName.value
		const lastName = this._addLastName && this._addLastName.value
		const nickname = this._addNickname && this._addNickname.value
		if (!firstName || !lastName || !nickname) {
			alert('Fyll inn alle felter først.')
			return
		}

		const name = `${firstName} ${lastName}`
		const faceApi = new FaceApi(faceApiConfig.myPersonalSubscriptionKey, faceApiConfig.endpoint, faceApiConfig.webstepPersonGroupId)
		const createPersonRes = await faceApi.createPersonAsync(name)
		const personId = createPersonRes.personId

		const settings = await this._getSettingsAsync()
		if (settings.persons.find(p => p.personId === personId)) {
			throw new Error('Person with same ID is already added.')
		}

		settings.persons.push({ name, jokes: [], personId, photos: [] })

		await this._saveSettingsAsync(settings)
	}

	private _getSettingsApiUrl(): string | undefined {
		const gistUrl = this._settingsGistUrl
		if (!gistUrl) return undefined

		// From: https://gist.github.com/angularsen/08998fe7673b485de800a4c1c1780e62
		// To:   https://api.github.com/gists/08998fe7673b485de800a4c1c1780e62
		const matches = gistUrl.match(/gist\.github\.com\/(\w+)\/(\w+)/)
		if (!matches) { throw new Error('Did not recognize gist URL: ' + gistUrl) }

		const [, username, gistId] = matches
		const apiUrl = `https://api.github.com/gists/${gistId}`
		return apiUrl
	}

}

export default Component
