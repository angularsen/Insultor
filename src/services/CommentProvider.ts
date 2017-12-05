import { DetectFaceResult } from '../../docs/FaceAPI/DetectFacesResponse'
import { Person } from '../../docs/FaceAPI/Person'
import { Settings, SettingsStore } from '../services/Settings'
import JokeProvider from './JokeProvider'

function getRandomInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

export interface PersonInfo {
	person: Person
	face: DetectFaceResult
}

export interface ICommentProvider {
	getCommentForPerson(person: PersonInfo): string
}

export class CommentProvider implements ICommentProvider {
	private readonly _jokes = new JokeProvider()
	private _settings?: Settings

	constructor(private readonly _settingsStore: SettingsStore) {
		this._reloadSettingsAsync()
		_settingsStore.onSettingsChanged.subscribe(settings => this._settings = settings)
	}

	public getCommentForPerson(info: PersonInfo): string {
		const settings = this._settings
		if (!settings) {
			console.warn('Settings not loaded yet, returning placeholder joke.')
			return 'Jeg er ikke klar for å vitse enda.'
		}

		const personId = info.person.personId

		const personSettings = settings.persons.find(p => p.personId === personId)
		if (!personSettings || !personSettings.jokes || personSettings.jokes.length === 0) {
			console.warn('Settings not found for person: ' + personId)
			return this.getCommentOnFace(info.face)
		}

		console.debug('Returning random joke for person: ' + personId)
		return personSettings.jokes[getRandomInt(0, personSettings.jokes.length - 1)]
	}

	public getCommentOnFace(face: DetectFaceResult): string {
		return this._jokes.getJoke(face)
	}

	private async _reloadSettingsAsync() {
		try {
			this._settings = await this._settingsStore.getSettingsAsync()
		} catch (err) {
			console.error('Failed to load settings.', err)
		}
	}
}

export default CommentProvider
