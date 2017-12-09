import { format } from 'date-fns'
import * as React from 'react'
// import { Option } from 'src/services/utils/TsOption'
import { debounce, min } from 'underscore'
import Selfie from '../components/Selfie'
import { faceApiConfig } from '../services/constants'
import FaceApi, { HttpError } from '../services/MicrosoftFaceApi'
import { defaultSettings, PersonSettings, Settings, settingsStore } from '../services/Settings'
import { flatten } from '../services/utils'
import PersonList from './PersonList'

interface State {
	settings: Settings
	canAddPerson: boolean
}

class Component extends React.Component<{}, State> {
	private _lastAutoFilledNickname: string = ''
	private _selfie: Selfie | null
	private _addFirstName: HTMLInputElement | null // Option<HTMLInputElement>
	private _addLastName: HTMLInputElement | null // Option<HTMLInputElement>
	private _addNickname: HTMLInputElement | null // Option<HTMLInputElement>

	private readonly _faceApi = new FaceApi(faceApiConfig.myPersonalSubscriptionKey, faceApiConfig.endpoint, faceApiConfig.webstepPersonGroupId)

	private readonly _onGitHubApiTokenChange = debounce((value: string) => {
		console.info('Saved github API token to localstorage.')
		settingsStore.githubApiToken = value
		this._loadSettingsAsync(true)
	}, 1000)

	private readonly _onGitHubRepoUrlChange = debounce((value: string) => {
		console.info('Saved GitHub repo URL to localstorage.')
		settingsStore.githubRepoUrl = value
		this._loadSettingsAsync(true)
	}, 1000)

	constructor(props: {}) {
		super(props)

		this.state = {
			settings: defaultSettings,
			canAddPerson: false,
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
							<div className='form-group'>
								<label htmlFor='githubToken'>GitHub konto token</label>
								<input id='githubToken' className='form-control'
									defaultValue={settingsStore.githubApiToken}
									placeholder='Eks: 93fb1ef29fc48abe915f04cd4fc8ca0dfb4f216b'
									onChange={ev => this._onGitHubApiTokenChange(ev.currentTarget.value)} />
							</div>

							<div className='form-group'>
								<label htmlFor='gistUrl'>GitHub repo</label>
								<input id='gistUrl' type='url' className='form-control'
									defaultValue={settingsStore.githubRepoUrl}
									placeholder='Eks: https://gist.github.com/{username}/{id}'
									onChange={ev => this._onGitHubRepoUrlChange(ev.currentTarget.value)} />
							</div>

							<button className='btn btn-default' type='button' onClick={() => this._loadSettingsAsync(true)}>Last på nytt</button>
							<button className='btn btn-default' type='button' onClick={() => this._addPersonFacesForPhotosWithNoFace()}>Last opp manglende fjes</button>
						</form>

						<h2>Personer</h2>
						<form>
							<Selfie ref={ref => this._selfie = ref} desiredWidth={1920} desiredHeight={1080} onPhotoDataUrlChanged={photo => this._updateCanAddPerson()} />
							<div className='form-group'>
								<label htmlFor='addFirstName'>Fornavn</label>
								<input id='addFirstName' type='text' className='form-control' placeholder='Eks: Ola'
									onChange={ev => { this._onFirstNameChange(ev.target.value); this._updateCanAddPerson() }}
									ref={(x) => { this._addFirstName = x/*Option.from(x)*/ }} />
							</div>
							<div className='form-group'>
								<label htmlFor='addLastName'>Etternavn</label>
								<input id='addLastName' type='text' className='form-control' placeholder='Eks: Nordmann'
									onChange={ev => { this._updateCanAddPerson() }}
									ref={(x) => this._addLastName = x/*Option.from(x)*/} />
							</div>
							<div className='form-group'>
								<label htmlFor='addNickname'>Kallenavn</label>
								<input id='addNickname' type='text' className='form-control' placeholder='Eks: Ebola'
									onChange={ev => { this._updateCanAddPerson() }}
									ref={(x) => this._addNickname = x/*Option.from(x)*/} />
							</div>
							<button type='button' className='btn btn-primary'
								onClick={ev => this._createPersonAsync()} disabled={!this.state.canAddPerson}>Opprett person</button>
						</form>

						<PersonList persons={persons} deletePerson={personId => this._tryDeletePersonAsync(personId)} savePerson={person => this._updatePersonAsync(person)} />

					</div>
				</div>
			</div>
		)
	}

	private async _loadSettingsAsync(force = false): Promise<void> {
		try {
			console.info(`Loading settings (force: ${force})...`)
			const settings = await settingsStore.getSettingsAsync(force)
			this.setState({ settings })
			console.info(`Loading settings (force: ${force})...OK`)
		} catch (err) {
			console.error('Failed to load settings.', err)
		}
	}

	private async _createPersonAsync(): Promise<void> {
		// this._addFirstName.map(firstName => {
		// 	return firstName
		// })
		// this._addLastName.flatMap(lastName => this._addNickname.map(nickname => {})))
		const firstName = this._addFirstName && this._addFirstName.value
		const lastName = this._addLastName && this._addLastName.value
		const nickname = this._addNickname && this._addNickname.value
		if (!this._selfie) {
			alert('Fotoboks er ikke klar enda.')
			return
		}
		if (!firstName || !lastName || !nickname) {
			alert('Fyll inn alle felter først.')
			return
		}
		const { photoDataUrl, photoWidth, photoHeight } = this._selfie
		if (!photoDataUrl || !photoWidth || !photoHeight) {
			alert('Ta bilde først.')
			return
		}

		const name = `${firstName} ${lastName}`
		const createPersonRes = await this._faceApi.createPersonAsync(name)
		const personId = createPersonRes.personId

		const settings = await settingsStore.getSettingsAsync()
		if (settings.persons.find(p => p.personId === personId)) {
			throw new Error('Person with same ID is already added.')
		}

		// TODO Handle errors uploading image (try again, if not try to roll back face API person)
		// Ex: "Andreas Gullberg Larsen (ab341234-a4542..)/2017-12-05T21-46-32_300x300.jpg"
		const remoteDirPath = `${name} (${personId})`
		const fileName = `${format(new Date(), 'YYYY-MM-DDTHH-mm-ss')}_${photoWidth}-${photoHeight}.jpg`
		const remoteFilePath = `${remoteDirPath}/${fileName}`
		const uploadedImageFile = await settingsStore.uploadImageByDataUrlAsync(photoDataUrl, remoteFilePath)

		// Add person to settings with URL to uploaded image
		settings.persons.push({
			name,
			jokes: ['Hei kjekken!'],
			personId,
			photos: [
				{
					path: remoteFilePath,
					url: uploadedImageFile.content.download_url,
					height: photoHeight,
					width: photoWidth },
			],
		})
		await settingsStore.saveSettingsAsync(settings)
		this.setState({ settings })

		await this._addPersonFacesForPhotosWithNoFace()
		await this._faceApi.trainPersonGroup()

		this._clearAddPersonFields()
	}

	private async _tryDeletePersonAsync(personId: AAGUID): Promise<void> {
		console.debug(`Delete person [${personId}]...`)
		try {
			console.debug(`Removing person [${personId}] from Face API...`)
			try {
				await this._faceApi.deletePersonAsync(personId)
			} catch (err) {
				if (err instanceof HttpError && err.statusCode === 404) {
					console.warn('Person does not exist or was already deleted from Face API.', err)
				} else {
					throw err
				}
			}
			console.debug(`Removing person [${personId}] from Face API...OK.`)

			const settings = await settingsStore.getSettingsAsync()
			const personIdx = settings.persons.findIndex(p => p.personId === personId)
			if (personIdx < 0) {
				console.warn('Person does not exist in settings: ' + personId)
				return
			}

			const person = settings.persons[personIdx]
			const filePaths = person.photos.map(x => x.path)
			await settingsStore.deleteFilesAsync(filePaths)

			// Remove from settings
			console.debug(`Removing person [${personId}] from settings...`)
			settings.persons = settings.persons.filter(p => p.personId !== personId)
			await settingsStore.saveSettingsAsync(settings)
			console.info(`Removing person [${personId}] from settings...OK.`)

			// Update UI
			this.setState({ settings })

			console.info(`Delete person [${personId}]...OK.`)
		} catch (err) {
			console.error(`Delete person [${personId}]...ERROR.`, err)
		}
	}

	private async _addPersonFacesForPhotosWithNoFace(): Promise<void> {
		console.debug(`Add person faces for photos with no face...`)
		const settings = await settingsStore.getSettingsAsync()

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
			for (const p of photosWithNoFace) {
				try {
					const addedFace = await this._faceApi.addPersonFaceWithUrlAsync(p.personId, p.photo.url)
					p.photo.personFaceId = addedFace.persistedFaceId
					console.debug(`Add new face ID [${p.photo.personFaceId}] to photo [${p.photo.url}] in settings.`)
				} catch (err) {
					console.warn(`Failed to add person face for personId[${p.personId}] with url[${p.photo.url}].`)
				}
			}

			console.debug('Update settings with new face IDs.')
			await settingsStore.saveSettingsAsync(settings)
			this.setState({ settings })

			console.info(`Add person faces for photos with no face...OK`)
		} catch (err) {
			console.error(`Add person faces for photos with no face...ERROR`, err)
		}
	}

	private _onFirstNameChange(firstName: string): any {
		if (!this._addNickname) { console.error('No nickname field, bug?'); return }

		const currentNickname = this._addNickname.value.trim()
		if (currentNickname === '' || currentNickname === this._lastAutoFilledNickname) {
			// Default to first name, unless user typed something else
			this._addNickname.value = firstName
			this._lastAutoFilledNickname = firstName
		}
	}

	private _clearAddPersonFields() {
		this._clearInputs(this._addFirstName, this._addLastName, this._addNickname)
	}

	private _clearInputs(...inputs: Array<HTMLInputElement | null>) {
		for (const input of inputs) {
			if (input) { input.value = '' }
		}
	}

	private _updateCanAddPerson() {
		const firstName = this._addFirstName && this._addFirstName.value
		const lastName = this._addLastName && this._addLastName.value
		const nickname = this._addNickname && this._addNickname.value
		const hasPhoto: boolean = (this._selfie && this._selfie.photoDataUrl) ? true : false
		const canAddPerson = (firstName && lastName && nickname && hasPhoto) ? true : false
		this.setState({ canAddPerson })
	}

	private async _updatePersonAsync(person: PersonSettings) {
		const settings = await settingsStore.getSettingsAsync()
		const personIdx = settings.persons.findIndex(p => p.personId === person.personId)
		if (personIdx < 0) {
			console.error(`Could not find person in settings with id [${person.personId}].`)
			return
		}

		// Don't save empty jokes
		person.jokes = person.jokes.filter(j => j && j.trim() !== '')

		settings.persons[personIdx] = person
		await settingsStore.saveSettingsAsync(settings)
		this.setState({ settings })
	}
}

export default Component
