import { format } from 'date-fns'
import * as React from 'react'
import { debounce, min } from 'underscore'
import Selfie from '../components/Selfie'
import { faceApiConfig } from '../services/constants'
import FaceApi from '../services/MicrosoftFaceApi'
import { defaultSettings, Settings, settingsStore } from '../services/Settings'
import { flatten } from '../services/utils'
import PersonList from './PersonList'

/** localStorage key names */
const storageKeys = {
	githubToken: 'GITHUB_GISTS_TOKEN',
	githubRepoUrl: 'GIST_URL',
}

class Component extends React.Component<{}, { settings: Settings }> {
	private _selfie: Selfie | null
	private _addFirstName: HTMLInputElement | null
	private _addLastName: HTMLInputElement | null
	private _addNickname: HTMLInputElement | null

	private readonly _faceApi = new FaceApi(faceApiConfig.myPersonalSubscriptionKey, faceApiConfig.endpoint, faceApiConfig.webstepPersonGroupId)

	private readonly _onGitHubApiTokenChange = debounce((value: string) => {
		console.info('Saved github API token to localstorage.')
		localStorage.setItem(storageKeys.githubToken, value)
		settingsStore.githubApiToken = value
		this._loadSettingsAsync()
	}, 1000)

	private readonly _onGitHubRepoUrlChange = debounce((value: string) => {
		console.info('Saved GitHub repo URL to localstorage.')
		localStorage.setItem(storageKeys.githubRepoUrl, value)
		settingsStore.githubRepoUrl = value
		this._loadSettingsAsync()
	}, 1000)

	constructor(props: {}) {
		super(props)

		this.state = {
			settings: defaultSettings,
		}

		settingsStore.githubApiToken = localStorage.getItem(storageKeys.githubToken) || undefined
		settingsStore.githubRepoUrl = localStorage.getItem(storageKeys.githubRepoUrl) || undefined
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

							<button className='btn btn-default' onClick={() => this._loadSettingsAsync(true)}>Last på nytt</button>
							<button className='btn btn-default' onClick={() => this._addPersonFacesForPhotosWithNoFace()}>Last opp manglende fjes</button>
						</form>

						<h2>Personer</h2>
						<form>
							<Selfie ref={ref => this._selfie = ref} desiredWidth={1920} desiredHeight={1080} />
							<div className='form-group'>
								<label htmlFor='addFirstName'>Fornavn</label>
								<input id='addFirstName' type='text' className='form-control' placeholder='Eks: Ola'
									onChange={ev => this._onFirstNameChange(ev.target.value)} ref={(x) => this._addFirstName = x} />
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

						<PersonList persons={persons} />

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
				{ url: uploadedImageFile.content.download_url, height: photoHeight, width: photoWidth },
			],
		})
		await settingsStore.saveSettingsAsync(settings)
		this.setState({ settings })

		await this._addPersonFacesForPhotosWithNoFace()
		await this._faceApi.trainPersonGroup()

		this._clearAddPersonFields()
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
		if (this._addNickname && this._addNickname.value.trim() === '') {
			// Default to first name, unless user typed something else
			this._addNickname.value = firstName
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
}

export default Component
