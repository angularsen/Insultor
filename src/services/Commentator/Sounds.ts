import { randomItem } from '../utils'

const presenceDetectedSounds = [
	new Audio('/audio/presence-detected001.mp3'),
	new Audio('/audio/presence-detected002.mp3'),
	new Audio('/audio/presence-detected003.mp3'),
	new Audio('/audio/presence-detected004.mp3'),
	new Audio('/audio/presence-detected005.mp3'),
]

const aloneAgainSounds = [
	new Audio('/audio/alone-again001.mp3'),
	new Audio('/audio/alone-again002.mp3'),
	new Audio('/audio/alone-again003.mp3'),
]

const identifyingSounds = [
	new Audio('/audio/identifying001.mp3'),
	new Audio('/audio/identifying002.mp3'),
	new Audio('/audio/identifying003.mp3'),
]

const deliverCommentSounds = [
	new Audio('/audio/deliver-comment001.mp3'),
	new Audio('/audio/deliver-comment002.mp3'),
	new Audio('/audio/deliver-comment003.mp3'),
	new Audio('/audio/deliver-comment004.mp3'),
]

export default class Sounds {
	private _isAudioLoaded: boolean

	/** In order to play sounds they must played (or loaded) as a result of an user interaction event, such as button click or touch tap event. */
	public loadSoundsOnUserInteractionEvent(ev: React.MouseEvent<HTMLButtonElement>) {
		if (this._isAudioLoaded) {
			console.debug('Sounds already loaded.')
			return
		}

		try {
			console.debug('Loading audio...')
			const allAudio = presenceDetectedSounds
			for (const audio of allAudio) {
				audio.load()
				console.debug('Loaded audio resource: ' + audio.src, audio)
			}
			this._isAudioLoaded = true
			console.info('Loading audio...OK.')
		} catch (err) {
			console.error('Loading audio...FAILED.', err)
		}
	}

	public playIdentifyingFacesAsync(): Promise<void> {
		return this._playRandomAsync(identifyingSounds)
	}

	public playPresenceDetectedAsync(): Promise<void> {
		return this._playRandomAsync(presenceDetectedSounds)
	}

	public playAloneAgain(): Promise<void> {
		return this._playRandomAsync(aloneAgainSounds)
	}

	public playAboutToCommentOnPersonAsync(): Promise<void> {
		return this._playRandomAsync(deliverCommentSounds)
	}

	private async _playRandomAsync(sounds: HTMLAudioElement[]): Promise<void> {
		if (!this._isAudioLoaded) {
			throw new Error('Audio not yet loaded, make sure to call loadAudioOnUserEvent() from a user touch or click event.')
		}

		const sound = randomItem(sounds)
		console.info(`Playing sound [${sound.src}]...`)

		const promise = new Promise<void>((res, rej) => {
			console.debug(`Playing sound [${sound.src}]...DONE.`)
			sound.onended = () => {
				(sound as any).onended = undefined // TypeScript does not allow to assign undefined
				res()
			}
		})
		sound.play()

		return promise
	}
}
