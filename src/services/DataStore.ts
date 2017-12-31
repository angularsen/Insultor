import { format } from 'date-fns'
import { HttpError, IMicrosoftFaceApi } from './MicrosoftFaceApi'
import { PersonSettings, Settings, SettingsStore } from './Settings'

export interface AddPersonParams {
	fullName: string
	nickname: string
	jokes: string[]
	photoDataUrl: string
	photoWidth: number
	photoHeight: number
}

export class DataStore {
	constructor(
		public readonly faceApi: IMicrosoftFaceApi,
		public readonly settingsStore: SettingsStore) {
	}

	public async addPersonAsync(p: AddPersonParams): Promise<PersonSettings> {
		console.debug(`Add person...`, p)
		const name = p.fullName
		const createPersonRes = await this.faceApi.createPersonAsync(name)
		const personId = createPersonRes.personId

		const settings = await this.settingsStore.getSettingsAsync()
		if (settings.persons.find(x => x.personId === personId)) {
			throw new Error('Person with same ID is already added.')
		}

		// TODO Handle errors uploading image (try again, if not try to roll back face API person)
		// Ex: "Andreas Gullberg Larsen (ab341234-a4542..)/2017-12-05T21-46-32_300x300.jpg"
		const remoteDirPath = `${name} (${personId})`
		const fileName = `${format(new Date(), 'YYYY-MM-DDTHH-mm-ss')}_${p.photoWidth}-${p.photoHeight}.jpg`
		const remoteFilePath = `${remoteDirPath}/${fileName}`
		const uploadedImageFile = await this.settingsStore.uploadImageByDataUrlAsync(p.photoDataUrl, remoteFilePath)
		const uploadedPhotoUrl = uploadedImageFile.content.download_url

		const personFace = await this.faceApi.addPersonFaceWithUrlAsync(personId, uploadedPhotoUrl)
		await this.faceApi.trainPersonGroupAsync()
		const trainingStatus = await this.faceApi.getPersonGroupTrainingStatusAsync()
		console.info('Re-trained the person group, new status: ', trainingStatus)

		// Add person to settings with URL to uploaded image
		const personSettings: PersonSettings = {
			name,
			nickname: p.nickname,
			jokes: ['Hei kjekken!'],
			personId,
			photos: [{
				path: remoteFilePath,
				url: uploadedPhotoUrl,
				height: p.photoHeight,
				width: p.photoWidth,
				personFaceId: personFace.persistedFaceId,
			}],
		}

		settings.persons.push(personSettings)
		await this.settingsStore.saveSettingsAsync(settings)

		console.info(`Add person...OK.`, p)
		return personSettings
	}

	public async getPersonSettingsAsync(personId: AAGUID): Promise<PersonSettings> {
		const settings = await this.settingsStore.getSettingsAsync()
		const person = settings.persons.find(p => p.personId === personId)
		if (!person) { throw new Error(`Person not found: id[${personId}]`) }
		return person
	}

	public async removePersonAsync(personId: AAGUID): Promise<Settings> {
		console.debug(`Removing person [${personId}] from Face API...`)
		try {
			await this.faceApi.removePersonAsync(personId)
			await this.faceApi.trainPersonGroupAsync()
			const trainingStatus = await this.faceApi.getPersonGroupTrainingStatusAsync()
			console.info('Re-trained the person group, new status: ', trainingStatus)
		} catch (err) {
			if (err instanceof HttpError && err.statusCode === 404) {
				console.warn('Person does not exist or was already deleted from Face API.', err)
			} else {
				throw err
			}
		}
		console.info(`Removing person [${personId}] from Face API...OK.`)

		const settings = await this.settingsStore.getSettingsAsync()
		const personIdx = settings.persons.findIndex(p => p.personId === personId)
		if (personIdx < 0) {
			console.warn('Person does not exist in settings: ' + personId)
			return settings
		}

		const person = settings.persons[personIdx]
		const filePaths = person.photos.map(x => x.path)
		await this.settingsStore.deleteFilesAsync(filePaths)

		// Remove from settings
		console.debug(`Removing person [${personId}] from settings...`)
		settings.persons = settings.persons.filter(p => p.personId !== personId)
		await this.settingsStore.saveSettingsAsync(settings)
		console.info(`Removing person [${personId}] from settings...OK.`)

		console.info(`Delete person [${personId}]...OK.`)
		return settings
	}
}
