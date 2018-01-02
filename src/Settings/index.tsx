import * as React from 'react'
// import { Option } from 'src/services/utils/TsOption'
import { debounce } from 'underscore'

import Selfie from '../components/Selfie'
import { DataStore } from '../services/DataStore'
import { PersonSettings, Settings, SettingsStore } from '../services/Settings'
import { b64DecodeUnicode, flatten } from '../services/utils'

import PersonList from './PersonList'

interface State {
	settings: Settings
	canAddPerson: boolean
	commentTimeoutSecondsInput: string
}

interface Props {
	dataStore: DataStore
	/** URL search text */
	urlSearch: string
}

class Component extends React.Component<Props, State> {
	private _lastAutoFilledNickname: string = ''
	private _selfie: Selfie | null
	private _addFullName: HTMLInputElement | null // Option<HTMLInputElement>
	private _addNickname: HTMLInputElement | null // Option<HTMLInputElement>

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
			const parsedSettings = JSON.parse(b64DecodeUnicode(loadSettingsParam)) as Partial<{repoUrl: string, apiToken: string}>
			console.debug('Parsed load_settings: ', parsedSettings)
			if (parsedSettings.apiToken && parsedSettings.repoUrl) {
				props.dataStore.settingsStore.githubApiToken = parsedSettings.apiToken
				props.dataStore.settingsStore.githubRepoUrl = parsedSettings.repoUrl
			}
		}

		const { settingsStore } = props.dataStore
		const initialSettings = settingsStore.currentSettingsOrDefault
		this.settingsStore = settingsStore

		settingsStore.onSettingsChanged.subscribe((settings) => {
			this.setState({
				settings,
				commentTimeoutSecondsInput: this._formatCommentCooldownSeconds(settings.commentCooldownPerPersonMs),
			})
		})

		this.state = {
			settings: initialSettings,
			canAddPerson: false,
			commentTimeoutSecondsInput: this._formatCommentCooldownSeconds(initialSettings.commentCooldownPerPersonMs),
		}

		this._onGitHubApiTokenChange = this._onGitHubApiTokenChange.bind(this)
		this._onGitHubRepoUrlChange = this._onGitHubRepoUrlChange.bind(this)
		this._loadSettingsAsync = this._loadSettingsAsync.bind(this)
	}

	public componentDidMount() {
		// Can't await here
		this._loadSettingsAsync()
	}

	public render() {
		const { settings } = this.state
		const persons = settings && settings.persons

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
									type='url'
									className='form-control'
									defaultValue={this.settingsStore.githubRepoUrl}
									placeholder='Eks: https://gist.github.com/{username}/{id}'
									onChange={ev => this._onGitHubRepoUrlChange(ev.currentTarget.value)} />
							</div>

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
						</form>

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

					</div>
				</div>
			</div>
		)
	}

	private async _loadSettingsAsync(force = false): Promise<void> {
		try {
			console.info(`Loading settings (force: ${force})...`)
			const settings = await this.settingsStore.getSettingsAsync(force)
			this.setState({
				settings,
				commentTimeoutSecondsInput: this._formatCommentCooldownSeconds(settings.commentCooldownPerPersonMs),
			})
			console.info(`Loading settings (force: ${force})...OK`, settings)
		} catch (err) {
			console.error('Failed to load settings.', err)
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
}

export default Component
