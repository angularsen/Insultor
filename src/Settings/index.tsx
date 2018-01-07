import * as React from 'react'
import { debounce } from 'underscore'

import Selfie from '../components/Selfie'
import { DataStore } from '../services/DataStore'
import { PersonSettings, Settings, SettingsStore } from '../services/Settings'
import { b64DecodeUnicode, b64EncodeUnicode, ensureValidUrl, flatten } from '../services/utils'

import { HttpError } from '../services/MicrosoftFaceApi'
import PersonList from './PersonList'

interface LoadSettingsDto {
	repoUrl: string
	apiToken: string
}

interface State {
	settings: Settings
	canAddPerson: boolean
	commentTimeoutSecondsInput: string
	settingsUrlForCopy?: string
}

interface Props {
	dataStore: DataStore
	/** URL search text */
	urlSearch: string
}

class Component extends React.Component<Props, State> {
	private _lastAutoFilledNickname: string = ''
	private _selfie: Selfie | null
	private _settingsUrlForCopy: HTMLInputElement | null
	private _githubApiTokenInput: HTMLInputElement | null
	private _githubRepoUrlInput: HTMLInputElement | null
	private _addFullName: HTMLInputElement | null
	private _addNickname: HTMLInputElement | null

	private readonly settingsStore: SettingsStore

	private readonly _onGitHubApiTokenChange = debounce((value: string) => {
		console.info('Saved github API token.')
		this.settingsStore.githubApiToken = value
		this._loadSettingsAsync(true)
	}, 1000)

	private readonly _onGitHubRepoUrlChange = debounce((value: string) => {
		console.info('Saved GitHub repo URL.')
		this.settingsStore.githubRepoUrl = value
		this._loadSettingsAsync(true)
	}, 1000)

	private readonly _updateSettingsStoreDebounced = debounce(async (updateCallback: (settings: Settings) => void) => {
		await this.settingsStore.updateSettingsAsync(updateCallback)
	}, 1000)

	private readonly _saveCommentCooldownValueIfValidDebounced = debounce((value: string) => {
		const parsedValue = parseFloat(value)
		if (isNaN(parsedValue)) {
			console.error('Comment cooldown is an invalid number.', value)
			return
		}

		const commentCooldownMs = parseFloat(parsedValue.toPrecision(2)) * 1000
		console.log(`Save comment cooldown: parsedValue[${parsedValue}], value to store [${commentCooldownMs}]`)
		this._updateSettings(s => s.commentCooldownPerPersonMs = commentCooldownMs)
	}, 3000)

	constructor(props: Props) {
		super(props)

		console.info('Create settings.tsx', props)

		const searchParams = new URLSearchParams(props.urlSearch)
		console.debug('Search params: ', Array.from(searchParams))

		const loadSettingsParam = searchParams.get('load_settings')
		if (loadSettingsParam) {
			console.info('Loading settings.')
			console.debug('Raw load_settings: ', loadSettingsParam)
			const parsedSettings = JSON.parse(b64DecodeUnicode(loadSettingsParam)) as Partial<LoadSettingsDto>
			console.debug('Parsed load_settings: ', parsedSettings)
			if (parsedSettings.apiToken && parsedSettings.repoUrl) {
				const apiToken = parsedSettings.apiToken.trim()
				const repoUrl = ensureValidUrl(parsedSettings.repoUrl.trim(), 'load_settings.repoUrl not a valid URL', parsedSettings)

				props.dataStore.settingsStore.githubApiToken = apiToken
				props.dataStore.settingsStore.githubRepoUrl = repoUrl
				alert('Lastet innstillinger')
			}
		}

		const { settingsStore } = props.dataStore
		const initialSettings = settingsStore.currentSettingsOrDefault
		this.settingsStore = settingsStore

		this._onGitHubApiTokenChange = this._onGitHubApiTokenChange.bind(this)
		this._onGitHubRepoUrlChange = this._onGitHubRepoUrlChange.bind(this)
		this._loadSettingsAsync = this._loadSettingsAsync.bind(this)
		this._onSettingsChanged = this._onSettingsChanged.bind(this)

		settingsStore.onSettingsChanged.subscribe(this._onSettingsChanged)

		this.state = {
			settings: initialSettings,
			canAddPerson: false,
			commentTimeoutSecondsInput: this._formatCommentCooldownSeconds(initialSettings.commentCooldownPerPersonMs),
		}
	}

	public componentDidMount() {
		// Can't await here
		this._loadSettingsAsync()
	}

	public componentWillUnmount() {
		this.settingsStore.onSettingsChanged.unsubscribe(this._onSettingsChanged)
	}

	public render() {
		const { settings } = this.state
		const persons = settings && settings.persons
		const { githubApiToken, githubRepoUrl } = this.props.dataStore.settingsStore
		const hasSettings = githubApiToken && githubApiToken.length > 0 && githubRepoUrl && githubRepoUrl.length > 0

		return (
			<div className='container'>
				<div className='row'>
					<div className='col'>
						<h1 className='display-4'>Instillinger</h1>
						<form>
							{/* Include a hidden username field to satisfy best practices for password managers etc.
							https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fe-autocomplete-current-password */}
							<div style={{display: 'none'}}>
								<input type='text' autoComplete='username' />
							</div>

							<div className='form-group'>
								<label htmlFor='githubToken'>GitHub API nøkkel</label>
								<input id='githubToken'
									ref={x => this._githubApiTokenInput = x}
									className='form-control'
									type='password'
									autoComplete='current-password'
									defaultValue={this.settingsStore.githubApiToken}
									placeholder='Eks: 93fb1ef29fc48abe915f04cd4fc8ca0dfb4f216b'
									onChange={ev => this._onGitHubApiTokenChange(ev.currentTarget.value)} />
							</div>

							<div className='form-group'>
								<label htmlFor='gistUrl'>GitHub repo</label>
								<input id='gistUrl'
									ref={x => this._githubRepoUrlInput = x}
									type='url'
									className='form-control'
									defaultValue={this.settingsStore.githubRepoUrl}
									placeholder='Eks: https://gist.github.com/{username}/{id}'
									onChange={ev => this._onGitHubRepoUrlChange(ev.currentTarget.value)} />
							</div>

							{hasSettings ? (
								<div>
									<div className='form-group'>
										<label htmlFor='commentCooldownSeconds'>Minimum tid (sekunder) før ny kommentar på samme person</label>
										<input id='commentCooldownSeconds'
											type='number'
											className='form-control'
											value={this.state.commentTimeoutSecondsInput}
											placeholder='Eks: 10'
											onChange={ev => this._onCommentCooldownSecondsChange(ev.currentTarget.value)} />
									</div>

									<div className='form-check'>
										<label className='form-check-label' htmlFor='askToCreatePersonForUnrecognizedFaces'>
											<input id='askToCreatePersonForUnrecognizedFaces'
												type='checkbox'
												className='form-check-input'
												checked={settings.askToCreatePersonForUnrecognizedFaces}
												onChange={ev => this._onChangeAskToCreatePersonForUnrecognizedFaces(ev.currentTarget.checked)} />
											Spør om å opprette nye personer</label>
									</div>

									<button className='btn btn-default' type='button' onClick={() => this._loadSettingsAsync(true)}>Last på nytt</button>
									<button className='btn btn-default' type='button' onClick={() => this._addPersonFacesForPhotosWithNoFace()}>Last opp manglende fjes</button>
									<button className='btn btn-default' type='button' onClick={() => this._exportSettingsUrl()}>Kopier URL med innstillinger</button>

									{/* Input field must be visible for copy to clipboard to work, so let's put it outside the view at least */}
									< input ref={x => this._settingsUrlForCopy = x}
										style={{
											position: 'absolute',
											left: -1000,
											top: -1000,
										}}
										value={this.state.settingsUrlForCopy} />
								</div>
							) : undefined}
						</form>

						{hasSettings ? (
							<div>
								<h2 style={{ marginTop: '1em' }}>Legg til person</h2>
								<form>
									<Selfie ref={ref => this._selfie = ref} desiredWidth={1920} desiredHeight={1080} onPhotoDataUrlChanged={_ => this._updateCanAddPerson()} />
									<div className='form-group'>
										<label htmlFor='addFullName'>Fullt navn</label>
										<input id='addFullName' type='text' className='form-control' placeholder='Eks: Ola'
											onChange={ev => { this._onFullNameChange(ev.target.value); this._updateCanAddPerson() }}
											ref={(x) => { this._addFullName = x/*Option.from(x)*/ }} />
									</div>
									<div className='form-group'>
										<label htmlFor='addNickname'>Kallenavn</label>
										<input id='addNickname' type='text' className='form-control' placeholder='Eks: Ebola'
											onChange={_ => { this._updateCanAddPerson() }}
											ref={(x) => this._addNickname = x/*Option.from(x)*/} />
									</div>
									<button type='button' className='btn btn-primary'
										onClick={_ => this._createPersonAsync()} disabled={!this.state.canAddPerson}>Opprett person</button>
								</form>

								<h2 style={{ marginTop: '1em' }}>Personer</h2>
								<PersonList persons={persons} deletePerson={personId => this._tryDeletePersonAsync(personId)} savePerson={person => this._updatePersonAsync(person)} />

							</div>) : undefined}

					</div>
				</div>
			</div>
		)
	}

	private async _loadSettingsAsync(force = false): Promise<void> {
		try {
			console.info(`Loading settings (force: ${force})...`)

			// State is updated in _onSettingsChanged handler
			const settings = await this.settingsStore.getSettingsAsync(force)

			console.info(`Loading settings (force: ${force})...OK`, settings)
		} catch (err) {
			console.error('Failed to load settings.', err)

			if (err instanceof HttpError) {
				if (err.statusCode === 404) {
					alert('Fant ikke innstillinger, sjekk API token og repo URL:\n\n' + err)
					return
				}
			}

			alert('Klarte ikke å laste innstillinger:\n\n' + err)
			return
		}
	}

	private async _createPersonAsync(): Promise<void> {
		const fullName = this._addFullName && this._addFullName.value
		const nickname = this._addNickname && this._addNickname.value

		if (!this._selfie) {
			alert('Fotoboks er ikke klar enda.')
			return
		}
		if (!fullName || !nickname) {
			alert('Fyll inn alle felter først.')
			return
		}
		const { photoDataUrl, photoWidth, photoHeight } = this._selfie
		if (!photoDataUrl || !photoWidth || !photoHeight) {
			alert('Ta bilde først.')
			return
		}

		await this.props.dataStore.addPersonAsync({
			fullName,
			jokes: ['Hei kjekken!'],
			nickname,
			photoDataUrl,
			photoHeight,
			photoWidth,
		})

		this._clearAddPersonFields()

		const settings = await this.settingsStore.getSettingsAsync()
		this.setState({ settings })
	}

	private async _updateSettings(updateCallback: (settings: Settings) => void) {
		// Update GUI immediately for controlled inputs
		const settingsCopy = { ...{}, ...this.state.settings }
		updateCallback(settingsCopy)
		this.setState({ settings: settingsCopy })

		this._updateSettingsStoreDebounced(updateCallback)
	}

	private async _tryDeletePersonAsync(personId: AAGUID): Promise<void> {
		console.debug(`Delete person [${personId}]...`)
		try {
			const settings = await this.props.dataStore.removePersonAsync(personId)

			// Update UI
			this.setState({ settings })
		} catch (err) {
			console.error(`Delete person [${personId}]...ERROR.`, err)
		}
	}

	/**
	 * This is a cleanup task, adding faces for person in Face API for photos in settings
	 * that are not associated with a face. This typically happens when a person was created
	 * in settings, but an error prevented the face from being created in Face API.
	 * The idea is to retry this later (with this function).
	 */
	private async _addPersonFacesForPhotosWithNoFace(): Promise<void> {
		console.debug(`Add person faces for photos with no face...`)
		const settings = await this.settingsStore.getSettingsAsync()

		// Add person faces for any photos that are not already added
		const photosWithNoFace = flatten(
			settings.persons
				.map(person => person.photos
					.filter(photo => !photo.personFaceId)
					.map(photo => ({
						photo,
						personId: person.personId,
					}))))

		if (photosWithNoFace.length === 0) {
			console.debug('No photos with missing face.')
			return
		}

		console.debug(`Adding ${photosWithNoFace.length} photos as person faces in Face API...`)

		try {
			for  (const p of photosWithNoFace) {
				try {
					const addedFace = await this.props.dataStore.faceApi.addPersonFaceWithUrlAsync(p.personId, p.photo.url)
					p.photo.personFaceId = addedFace.persistedFaceId
					console.debug(`Add new face ID [${p.photo.personFaceId}] to photo [${p.photo.url}] in settings.`)
				} catch (err) {
					console.warn(`Failed to add person face for personId[${p.personId}] with url[${p.photo.url}].`)
				}
			}

			console.debug('Update settings with new face IDs.')
			await this.settingsStore.saveSettingsAsync(settings)
			this.setState({ settings })

			console.info(`Add person faces for photos with no face...OK`)
		} catch (err) {
			console.error(`Add person faces for photos with no face...ERROR`, err)
		}
	}

	private _onFullNameChange(firstName: string): any {
		if  (!this._addNickname) { console.error('No nickname field, bug?');  return }

		const currentNickname = this._addNickname.value.trim()
		if (currentNickname === '' || currentNickname === this._lastAutoFilledNickname) {
			// Default to first name, unless user typed something else
			this._addNickname.value = firstName
			this._lastAutoFilledNickname = firstName
		}
	}

	private _clearAddPersonFields() {
		this._clearInputs(this._addFullName, this._addNickname)
	}

	private _clearInputs(...inputs: Array<HTMLInputElement | null>) {
		for  (const input of inputs) {
			if  (input) { input.value = '' }
		}
	}

	private _updateCanAddPerson() {
		const fullName = this._addFullName && this._addFullName.value
		const nickname = this._addNickname && this._addNickname.value
		const hasPhoto: boolean = (this._selfie && this._selfie.photoDataUrl) ? true : false
		const canAddPerson = (fullName && nickname && hasPhoto) ? true : false
		this.setState({ canAddPerson })
	}

	private async _updatePersonAsync(person: PersonSettings) {
		const settings = await this.settingsStore.getSettingsAsync()
		const personIdx = settings.persons.findIndex(p => p.personId === person.personId)
		if (personIdx < 0) {
			console.error(`Could not find person in settings with id [${person.personId}].`)
			return
		}

		// Don't save empty jokes
		person.jokes = person.jokes.filter(j => j && j.trim() !== '')

		settings.persons[personIdx] = person
		await this.settingsStore.saveSettingsAsync(settings)
		this.setState({ settings })
	}

	private _onChangeAskToCreatePersonForUnrecognizedFaces(checked: boolean) {
		this._updateSettings(s => s.askToCreatePersonForUnrecognizedFaces = checked)
	}

	private _onCommentCooldownSecondsChange(value: string) {
		// Immediately update upon typing
		this.setState({ commentTimeoutSecondsInput: value })

		// When value is no longer changing and if its' valid, store it and update GUI by settings changed event
		this._saveCommentCooldownValueIfValidDebounced(value)
	}

	private _formatCommentCooldownSeconds(valueMs: number) {
		return (valueMs / 1000).toPrecision(2)
	}

	private _exportSettingsUrl(): void {
		if (!this._settingsUrlForCopy) {
			console.warn('No input field settingsUrlForCopy found.')
			return
		}

		const { settingsStore } = this.props.dataStore
		const { githubApiToken, githubRepoUrl } = settingsStore

		if (!githubApiToken || githubApiToken.trim().length === 0 || !githubRepoUrl || githubRepoUrl.trim().length === 0) {
			console.warn('Github API token or repo URL is not configured in settings store, so nothing to export.', { githubApiToken, githubRepoUrl })
			alert('Fyll inn API token og repo URL først.')
			return
		}

		const settingsDto: LoadSettingsDto = {
			apiToken: githubApiToken,
			repoUrl: githubRepoUrl,
		}

		const encodedSettings = b64EncodeUnicode(JSON.stringify(settingsDto))
		const newUrl = window.location.href.split('?')[0] + `?load_settings=${encodedSettings}`

		this._settingsUrlForCopy.value = newUrl
		this._settingsUrlForCopy.select()
		document.execCommand('copy')
		this._settingsUrlForCopy.value = ''
	}

	private _onSettingsChanged(settings: Settings) {
		this.setState({
			settings,
			commentTimeoutSecondsInput: this._formatCommentCooldownSeconds(settings.commentCooldownPerPersonMs),
		})
	}

}

export default Component
