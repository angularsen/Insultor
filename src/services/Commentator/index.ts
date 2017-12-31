import { differenceInMilliseconds } from 'date-fns'
// Workaround for webpack --watch: https://github.com/TypeStrong/ts-loader/issues/348
import { setTimeout } from 'timers'

import { IdentifyFacesResponse } from '../../../docs/FaceAPI/IdentifyFacesResponse'

import { ICommentProvider } from '../CommentProvider'
import { DataStore } from '../DataStore'
import { IMicrosoftFaceApi, ThrottledHttpError } from '../MicrosoftFaceApi'
import { DetectedFaceWithImageData, IPeriodicFaceDetector, PeriodicFaceDetector } from '../PeriodicFaceDetector'
import { IPresenceDetector } from '../PresenceDetector'
import { PersonSettings, Settings, SettingsStore } from '../Settings'
import { ISpeech } from '../Speech'
import { Lifecycle, TypedStateMachine } from '../TypedStateMachine'
import { checkDefined, delayAsync, joinGrammatically, strEnum } from '../utils'
import { EventDispatcher, IEvent } from '../utils/Events'
import { error } from '../utils/format'
import { IVideoService } from '../VideoService'

import DetectIdentifyCommentCycleData from './DetectIdentifyCommentCycleData'
import Sounds from './Sounds'
import { IdentifiedPerson, PersonToCommentOn, PersonToCreate } from './types'

export { default as Sounds } from './Sounds'

//#region Internal types

interface DefaultOpts {
	detectFacesIntervalMs: number
	init: State
}

interface InputOpts {
	// Required
	dataStore: DataStore
	presenceDetector: IPresenceDetector
	videoService: IVideoService
	commentProvider: ICommentProvider
	speech: ISpeech
	sounds: Sounds

	// Optional
	detectFacesIntervalMs?: number
	faceDetector?: IPeriodicFaceDetector
	init?: State
}

interface CommentatorOptions {
	commentProvider: ICommentProvider
	detectFacesIntervalMs: number
	dataStore: DataStore
	sounds: Sounds
	faceDetector?: IPeriodicFaceDetector
	init: State
	presenceDetector: IPresenceDetector
	speech: ISpeech
	videoService: IVideoService
}

//#endregion Internal types

//#region Exported types

export interface Lifecycle {
	transitionName: string
	from: State
	to: State
}

export interface StatusInfo {
	emoji: string
	state: State
	text: string
}

// tslint:disable-next-line:variable-name
export const State = strEnum([
	'idle',
	'detectPresence',
	'detectFaces',
	'identifyFaces',
	'waitForThrottling',
	'processAnyNewFaces',
	'askToCreatePerson',
	'createPerson',
	'commentOnNextPerson',
])
export type State = keyof typeof State

interface Transition {
	start(): void
	stop(): void
	presenceDetected(): void
	noPresenceDetected(): void
	detectedFaces(detectedFaces: ReadonlyArray<DetectedFaceWithImageData>): void
	detectFacesThrottled(): void
	identifyFaces_Completed(identifiedPersons: IdentifiedPerson[]): void
	identifyFaces_Throttled(): void // Drop faces on throttling, since person is likely no longer in front of camera after waiting
	waitForThrottling_Completed(): void
	processAnyNewFaces_Next(): void
	processAnyNewFaces_Completed(): void
	createPerson_Ok(person: IdentifiedPerson): void
	createPerson_Canceled(): void
	askToCreatePerson_Accepted(faceId: string): void
	askToCreatePerson_Declined(faceId: string): void
	askToCreatePerson_Timeout(faceId: string): void
	commentOnNextPerson_Delivered(): void
	commentOnNextPerson_TooEarly(): void
	commentOnNextPerson_NoMoreComments(): void
}
type TransitionName = keyof Transition

export type CommentatorTransition = Lifecycle<State, TransitionName>

//#endregion Exported types

// tslint:disable-next-line:max-classes-per-file
export class Commentator implements Transition {
	private static getPersonsToCommentOn(identifiedPersons: ReadonlyArray<IdentifiedPerson>, commentProvider: ICommentProvider) {
		const personsToCommentOn = identifiedPersons.map(p => {

			const comment = commentProvider.getCommentForPerson({
				face: p.detectedFace.result,
				personId: p.personId,
			})

			const personToCommentOn: PersonToCommentOn = {
				comment,
				person: p,
				state: 'scheduled',
			}
			return personToCommentOn
		})

		console.debug(`Prepared ${personsToCommentOn.length} persons to comment on.`)
		return personsToCommentOn
	}

	private static getPersonSettingsOrDefault(settings: Settings, personId: string): PersonSettings {
		const personSettings = settings.persons.find(p => p.personId === personId)
		if (personSettings) { return personSettings }

		console.error(`Could not find person settings for person ID: ${personId}`)
		return {
			jokes: ['Fant ingen vitser på deg, gitt.'],
			name: 'Ukjent',
			nickname: 'Ukjent',
			personId,
			photos: [],
		}
	}

	public get onSpeak(): IEvent<PersonToCommentOn> { return this._onSpeakDispatcher }
	public get onAskToCreatePerson(): IEvent<PersonToCreate> { return this._onAskToCreatePersonDispatcher }
	public get onCreatePerson(): IEvent<PersonToCreate> { return this._onCreatePersonDispatcher }
	public get onStatusChanged(): IEvent<StatusInfo> { return this._onStatusChangedDispatcher }
	public get onTransition(): IEvent<CommentatorTransition> { return this._sm.onTransition }
	public get presenceDetector(): IPresenceDetector { return this._presenceDetector }
	public get status(): StatusInfo { return this._status }

	private readonly _sm: TypedStateMachine<State, Transition>
	private readonly _onStatusChangedDispatcher = new EventDispatcher<StatusInfo>()
	private readonly _onSpeakDispatcher = new EventDispatcher<PersonToCommentOn>()
	private readonly _onAskToCreatePersonDispatcher = new EventDispatcher<PersonToCreate>()
	private readonly _onCreatePersonDispatcher = new EventDispatcher<PersonToCreate>()
	private readonly _faceDetector: IPeriodicFaceDetector
	private readonly _commentProvider: ICommentProvider
	private readonly _faceApi: IMicrosoftFaceApi
	private readonly _settingsStore: SettingsStore
	private readonly _presenceDetector: IPresenceDetector
	private readonly _speech: ISpeech
	private readonly _sounds: Sounds
	private readonly _videoService: IVideoService
	private readonly _commentCooldownPerPersonMs = 60 * 1000

	/**
	 * Key is personId. History of delivered comments, in order to avoid spamming comments
	 * to the same persons.
	 */
	private readonly _commentHistory: Map<string, PersonToCommentOn> = new Map<string, PersonToCommentOn>()

	/**
	 * Data for current detect-identify-comment cycle.
	 */
	private _cycleData: DetectIdentifyCommentCycleData = new DetectIdentifyCommentCycleData()

	/** Current status, to present to user.  */
	private _status: StatusInfo = { state: 'idle', text: 'Ikke startet enda', emoji: '😶' }

	/**
	 * Keep track of whether we have identified at least one face in the current presence.
	 * This will be reset when presence is no longer detected.
	 * TODO Refactor this to a separate state in the state machine.
	 */
	private _hasIdentifiedFacesInCurrentPresence = false

	constructor(inputOpts: InputOpts) {
		const defaultOpts: DefaultOpts = {
			detectFacesIntervalMs: 6000,
			init: 'idle',
		}
		const opts: CommentatorOptions = { ...{}, ...defaultOpts, ...inputOpts }

	//#region Bind
		this._onEnterAskToCreatePerson = this._onEnterAskToCreatePerson.bind(this)
		this._onEnterCommentOnNextPerson = this._onEnterCommentOnNextPerson.bind(this)
		this._onEnterCreatePerson = this._onEnterCreatePerson.bind(this)
		this._onEnterProcessAnyNewFaces = this._onEnterProcessAnyNewFaces.bind(this)
		this._onEnterDetectFaces = this._onEnterDetectFaces.bind(this)
		this._onEnterDetectPresence = this._onEnterDetectPresence.bind(this)
		this._onEnterIdentifyFaces = this._onEnterIdentifyFaces.bind(this)
		this._onEnterIdle = this._onEnterIdle.bind(this)
		this._onPeriodicDetectFacesAsync = this._onPeriodicDetectFacesAsync.bind(this)
		this._onEnterWaitForThrottling = this._onEnterWaitForThrottling.bind(this)
	//#endregion Bind

		this._sounds = opts.sounds
		this._commentProvider = opts.commentProvider
		this._faceApi = opts.dataStore.faceApi
		this._settingsStore = opts.dataStore.settingsStore
		this._presenceDetector = opts.presenceDetector
		this._speech = opts.speech
		this._videoService = opts.videoService
		this._faceDetector = opts.faceDetector || new PeriodicFaceDetector(opts.detectFacesIntervalMs, this._onPeriodicDetectFacesAsync)

//#region State machine config
		const sm = new TypedStateMachine<State, Transition>({
			log: (msg, ...args) => console.log(`StateMachine: ${msg}`, args),
			initialState: opts.init,
			onInvalidTransition(from, transitionName) {
				switch (transitionName) {
					case 'presenceDetected':
					case 'noPresenceDetected':
						// These will trigger at any time, so ignore if we are currently in a state where it will not have an effect
						return
					default:
						throw new Error(`Transition [${transitionName}] not allowed from [${from}]`)
				}
			},
			states: {
				any: { allow: { stop: { to: 'idle' } } },
				idle: { allow: { start: { to: 'detectPresence' } }, onEnter: this._onEnterIdle, ignore: ['commentOnNextPerson_Delivered'] },
				detectPresence: { allow: { presenceDetected: { to: 'detectFaces' } }, onEnter: this._onEnterDetectPresence },
				detectFaces: {
					onEnter: this._onEnterDetectFaces,
					allow: {
						detectedFaces: { to: 'identifyFaces'},
						detectFacesThrottled: { to: 'waitForThrottling' },
						noPresenceDetected: { to: 'detectPresence' },
					},
				},
				identifyFaces: {
					onEnter: this._onEnterIdentifyFaces,
					allow: {
						identifyFaces_Completed: { to: 'processAnyNewFaces' },
						identifyFaces_Throttled: { to: 'waitForThrottling' },
					},
				},
				processAnyNewFaces: {
					onEnter: this._onEnterProcessAnyNewFaces,
					allow: {
						processAnyNewFaces_Next: { to: 'askToCreatePerson' },
						processAnyNewFaces_Completed: { to: 'commentOnNextPerson' },
					},
				},
				askToCreatePerson: {
					onEnter: this._onEnterAskToCreatePerson,
					allow: {
						askToCreatePerson_Accepted: { to: 'createPerson' },
						askToCreatePerson_Declined: { to: 'processAnyNewFaces' },
						askToCreatePerson_Timeout: { to: 'processAnyNewFaces' },
					},
				},
				createPerson: {
					onEnter: this._onEnterCreatePerson,
					allow: {
						createPerson_Ok: { to: 'processAnyNewFaces' },
						createPerson_Canceled: { to: 'processAnyNewFaces' },
					},
				},
				commentOnNextPerson: {
					onEnter: this._onEnterCommentOnNextPerson,
					allow: {
						commentOnNextPerson_TooEarly: { to: 'commentOnNextPerson' },
						commentOnNextPerson_Delivered: { to: 'commentOnNextPerson' },
						commentOnNextPerson_NoMoreComments: { to: 'detectFaces' },
					},
				},
				waitForThrottling: {
					onEnter: this._onEnterWaitForThrottling,
					allow: {
						waitForThrottling_Completed: { to: 'detectFaces' },
					},
				},
			},
		})
//#endregion State machine config

		this._sm = sm

		this._presenceDetector.onIsDetectedChanged.subscribe((isPresenceDetected: boolean) => {
			try {
				isPresenceDetected ? this.presenceDetected() : this.noPresenceDetected()
			} catch (err) {
				console.error('Failed to handle presence detected.', error(err))
			}
		})

		this._faceDetector.facesDetected.subscribe((detectedFaces: DetectedFaceWithImageData[]) => {
			try {
				this.detectedFaces(detectedFaces)
			} catch (err) {
				console.error('Failed to handle detected faces.', error(err))
			}
		})
	}

	//#region Public
	public can(transition: keyof Transition) { return this._sm.can(transition) }
	public get state(): State { return this._sm.state }
	public get history(): State[] { return this._sm.history }

	// Proxy methods for strongly typed args
	public presenceDetected() {
		this._sm.trigger('presenceDetected')
	}

	public noPresenceDetected() { this._sm.trigger('noPresenceDetected') }
	public start() { this._sm.trigger('start') }
	public stop() { this._sm.trigger('stop') }
	public detectFacesThrottled() { this._sm.trigger('detectFacesThrottled') }
	public identifyFaces_Throttled() { this._sm.trigger('identifyFaces_Throttled') }
	public identifyFaces_Completed(identifiedPersons: IdentifiedPerson[]) {
		this._cycleData.didIdentifyPersons(identifiedPersons)
		this._sm.trigger('identifyFaces_Completed')
	}
	public processAnyNewFaces_Next() { this._sm.trigger('processAnyNewFaces_Next') }
	public processAnyNewFaces_Completed() { this._sm.trigger('processAnyNewFaces_Completed') }
	public askToCreatePerson_Accepted() {
		this._sm.trigger('askToCreatePerson_Accepted') }

	public askToCreatePerson_Declined() {
		this._cycleData.didDeclineToCreatePerson()
		this._sm.trigger('askToCreatePerson_Declined') }

	public askToCreatePerson_Timeout() {
		this._cycleData.didTimeoutOnCreatePerson()
		this._sm.trigger('askToCreatePerson_Timeout') }

	public createPerson_Ok(person: IdentifiedPerson) {
		this._cycleData.didCreatePerson(person)
		this._sm.trigger('createPerson_Ok') }

	public createPerson_Canceled() {
		this._cycleData.didDeclineToCreatePerson()
		this._sm.trigger('createPerson_Canceled') }

	public commentOnNextPerson_Delivered() {
		this._cycleData.didCommentOnPerson()
		this._sm.trigger('commentOnNextPerson_Delivered') }

	public commentOnNextPerson_TooEarly() {
		this._cycleData.didSkipCommentForPerson()
		this._sm.trigger('commentOnNextPerson_TooEarly') }

	public commentOnNextPerson_NoMoreComments() { this._sm.trigger('commentOnNextPerson_NoMoreComments') }
	public waitForThrottling_Completed() { this._sm.trigger('waitForThrottling_Completed') }

	public toggleStartStop() {
		if (this._sm.can('start')) {
			this.start()
		} else if (this._sm.can('stop')) {
			this.stop()
		} else {
			console.error(`Can\`t toggle start/stop in state ${this.state}. This is a bug, should always be possible to either start or stop.`)
		}
	}

	public detectedFaces(detectedFaces: ReadonlyArray<DetectedFaceWithImageData>) {
		if (!this._sm.can('detectedFaces')) {
			this._cycleData.didDetectFacesDuringCycle(detectedFaces)

			console.warn('detectedFaces: Cannot detect faces in current state: ' + this.state)
		} else {
			console.debug(`detectedFaces: Add ${detectedFaces.length} faces to identify.`)
			this._cycleData.addFacesToIdentify(detectedFaces)
			this._sm.trigger('detectedFaces')
		}
	}

	// /**
	//  * Returns a promise that resolves when it enters the given state, however
	//  * it may have continued entering other states by the time the resolve
	//  * handler is invoked.
	//  */
	// public waitForState(state: State, timeoutMs: number = 1000): Promise < void > {
	// 	return new Promise((resolve, reject) => {
	// 		const timeoutHandle = setTimeout(() => reject(new Error('Timed out waiting for state: ' + state)), timeoutMs)
	// 		this._sm.onTransition.subscribe((onTransition) => {
	// 			if (onTransition.to === state) {
	// 				resolve()
	// 				clearTimeout(timeoutHandle)
	// 			}
	// 		})
	// 	})
	// }
	//#endregion Public

	//#region _onEnter
	private _onEnterIdle(transition: CommentatorTransition) {
		console.info('_onIdle')

		this._setStatus('Zzzz...', '😴')
		this._presenceDetector.stop()
		this._videoService.stop()
		this._faceDetector.stop()

		// Reset history so we can immediately comment on persons again by stop/starting
		this._commentHistory.clear()
	}

	private _onEnterDetectPresence(transition: CommentatorTransition) {
		console.info('_onDetectPresence')
		if (transition.from === 'idle') {
			this._setStatus('Hei.. er det noen her?', '🙂')
			this._videoService.start()
			this._presenceDetector.start(200)
		} else {
			this._setStatus('Forlatt og alene igjen...', '😟')
			this._sounds.playAloneAgain()
			this._faceDetector.stop()
		}

		this._hasIdentifiedFacesInCurrentPresence = false
	}

	private _onEnterDetectFaces(transition: CommentatorTransition) {
		// Reset the cycle data on detect faces, which is where we enter back to after commenting on persons, and we have the chance to start a new cycle if
		// faces were detected during the last cycle
		const prevCycleData = this._cycleData
		this._cycleData = new DetectIdentifyCommentCycleData()

		if (!this._presenceDetector.isDetected) {
			console.info('User is no longer present, proceeding to not present state.')
			this.noPresenceDetected()
			return
		}

		// Faces detected during cycle will not have had its face identified, so do another cycle with these faces
		const facesDetectedDuringCycle = prevCycleData.facesDetectedDuringCycle
		if (facesDetectedDuringCycle.length > 0) {
			console.info(`${facesDetectedDuringCycle.length} faces were detected in the meantime, immediately start identifying them.`)

			// Trigger a new cycle
			this.detectedFaces(facesDetectedDuringCycle)
		} else {
			console.info('User is still present, will keep trying to detect faces in the background.')
			this._setStatus(`Er det noen andre her...?`, '😑')
		}

		// Ensure it is started, could have been stopped if last cycle went through askToCreatePerson state
		this._faceDetector.start()

		if (transition.transitionName === 'presenceDetected') {
				this._sounds.playPresenceDetectedAsync()
				console.info('Presence was just detected, proceeding to attempt to detect faces.')
				this._setStatus('Kom litt nærmere så jeg får tatt en god titt på deg', '😁')
		} else {
			const personsCommentedOn = prevCycleData.personsToCommentOn

			if (personsCommentedOn.length > 0 && personsCommentedOn.every(p => p.state === 'skipped')) {
				const nicknames = personsCommentedOn.map(p => p.person.settings.nickname)
				const nicknamesText = joinGrammatically(nicknames, ' og ')
				const youText = personsCommentedOn.length > 1 ? 'Dere' : 'Du'

				// Avoid nagging on the same persons
				this._setStatus(`${youText} er her fortsatt ja ${nicknamesText}...`, '😑')
			} else if (prevCycleData.personsToCreate.length > 0) {
				// There were new faces, but no comments delivered, which means they declined to join (or auto-declined)
				this._setStatus(`Helt greit om du ikke vil bli med, men jeg spør igjen neste gang!`, '😏')
			} else {
				// Comments were delivered
				this._setStatus(`Er det noen andre her..?`, '😏')
			}
		}
	}

	private _onEnterIdentifyFaces(transition: CommentatorTransition) {
		const { facesToIdentify } = this._cycleData
		if (facesToIdentify.length === 0) {
			throw new Error('No faces to identify, this should normally not happen.')
		}

		console.info('Cleared faces detected buffer.')

		if (this._hasIdentifiedFacesInCurrentPresence) {
			// Let's not spam status for the same person since this will
			// typically happen a lot while the person is standing there,
			// but we still want to detect any new faces that may have arrived
		} else {
			this._setStatus('Det er noe kjent med deg, la meg sjekke opp litt!', '🤗')
		}

		// Do not await here to not block transition, will run in background
		this._identifyFacesAsync(facesToIdentify)
	}

	private _onEnterWaitForThrottling(transition: CommentatorTransition) {
		console.info('Wait 5 seconds for throttling...')
		this._setStatus('Oops.. har brukt opp gratiskvoten, må vente litt!', '🙄')
		setTimeout(() => {
			console.info('Wait 5 seconds for throttling...DONE.')
			this._sm.trigger('waitForThrottling_Completed')
		}, 5000)
	}

	private _onEnterProcessAnyNewFaces(transition: CommentatorTransition) {
		const remainingPersonsToCreate = this._cycleData.getRemainingPersonsToCreate()
		if (remainingPersonsToCreate.length > 0) {
			this.processAnyNewFaces_Next()
		} else {
			const personsToCommentOn = Commentator.getPersonsToCommentOn(this._cycleData.identifiedPersons, this._commentProvider)
			this._cycleData.addPersonsToCommentOn(personsToCommentOn)
			this.processAnyNewFaces_Completed()
		}
	}

	private _onEnterAskToCreatePerson(transition: CommentatorTransition) {
		// Upon seeing a new face, stop face detector and clear any faces already detected to avoid spam asking to create person for same face many times
		// Face detector will be started when entering back in detectFaces state
		this._faceDetector.stop()
		if (this._cycleData.facesDetectedDuringCycle.length > 0) {
			console.debug(`Cleared ${this._cycleData.facesDetectedDuringCycle.length} faces detected during cycle upon asking to create person for new face.`)
			this._cycleData.facesDetectedDuringCycle = []
		}

		const nextPersonToCreate = this._cycleData.getNextPersonToCreate()
		if (!nextPersonToCreate) { throw new Error('No next face to create person from. Bug.') }

		console.debug('Dispatching onAskToCreatePerson event', nextPersonToCreate)
		this._onAskToCreatePersonDispatcher.dispatch(nextPersonToCreate)
	}

	private _onEnterCreatePerson(transition: CommentatorTransition) {
		const nextPersonToCreate = this._cycleData.getNextPersonToCreate()
		if (!nextPersonToCreate) { throw new Error('No next face to create person from. Bug.') }

		console.debug('Dispatching onAskToCreatePerson event', nextPersonToCreate)
		this._onCreatePersonDispatcher.dispatch(nextPersonToCreate)
	}

	private async _onEnterCommentOnNextPerson(transition: CommentatorTransition) {
		const { nextPerson, idx, count } = this._cycleData.getNextPersonToCommentOn()
		if (!nextPerson) {
			this.commentOnNextPerson_NoMoreComments()
			return
		}

		if (!this._canCommentOnPerson(nextPerson.person)) {
			this.commentOnNextPerson_TooEarly()
			return
		}

		this._commentOnPersonAsync(nextPerson, idx, count)
	}
	//#endregion _onEnter

	//#region Actions
	private async _commentOnPersonAsync(personToCommentOn: PersonToCommentOn, idx: number, count: number): Promise<void> {
		const { comment, person } = personToCommentOn
		const { personId } = person
		const faceId = person.detectedFace.faceId

		const nickname = personToCommentOn.person.settings.nickname
		const logText = `Commenting on ${nickname ? `person ${nickname}` : `face ${faceId}`}`
		console.info(`${logText}...`)

		personToCommentOn.spokenOn = new Date()
		this._commentHistory.set(personId, personToCommentOn)

		// Trigger UI to show visual for comment
		this._onSpeakDispatcher.dispatch(personToCommentOn)

		await this._sounds.playAboutToCommentOnPersonAsync() // Heads up to user that a comment is about to be spoken
		await this._speech.speakAsync(comment) // Speak
		await delayAsync(4000) // Wait a bit to give user time to read/see the comment visuals

		console.info(`${logText}...DONE`)
		this.commentOnNextPerson_Delivered()
	}

	private async _identifyFacesAsync(detectedFaces: ReadonlyArray<DetectedFaceWithImageData>): Promise<void> {
		console.info('_onIdentifyFacesAsync')
		try {
			if (!detectedFaces || detectedFaces.length === 0) {
				throw new Error('No detected faces were given.')
			}

			const faceIds = detectedFaces.map(x => x.faceId)
			const MIN_CONFIDENCE = 0.5

			console.debug(`Identifying ${detectedFaces.length} faces...`)
			const identifyFacesResponse: IdentifyFacesResponse = await this._faceApi.identifyFacesAsync(faceIds)
			console.debug(`Identifying ${detectedFaces.length} faces...Complete.`)

			const settings = await this._settingsStore.getSettingsAsync()

			const identifiedPersons: IdentifiedPerson[] = identifyFacesResponse
				.filter(res =>
					res.candidates &&
					res.candidates.length > 0 &&
					res.candidates[0].confidence >= MIN_CONFIDENCE) // Require a certain level of confidence
				.distinct(res => res.candidates[0].personId) // Do not return multiple of same person
				.map(res => {
					const candidate = res.candidates[0]
					const detectedFace = checkDefined(
						detectedFaces.find(df => res.faceId === df.faceId),
						'Could not find matching detected face for identify face result, this is a bug.')

					const personSettings = Commentator.getPersonSettingsOrDefault(settings, candidate.personId)

					return {
						confidence: candidate.confidence,
						detectedFace,
						personId: candidate.personId,
						settings: personSettings,
					}
				})

			this.identifyFaces_Completed(identifiedPersons)
		} catch (err) {
			if (err instanceof ThrottledHttpError) {
				console.warn('Identify faces was throttled. Clearing faces.')
				// console.warn('Identify faces was throttled, adding back faces for retry later.')
				// this._facesToIdentify.push(...detectedFaces)
				this._sm.trigger('identifyFaces_Throttled')
			}
			console.error('Failed to identify faces.', error(err))
		}
	}

	private async _onPeriodicDetectFacesAsync(): Promise<DetectedFaceWithImageData[]> {
		try {
			const imageDataUrl = this._videoService.getCurrentImageDataUrl()
			console.debug(`Detect faces in photo...`)
			const result = await this._faceApi.detectFacesAsync(imageDataUrl)
			console.info(`Detect faces in photo...DONE.`, result)

			return result.map(detectedFace => ({
				faceId: detectedFace.faceId,
				imageDataUrl,
				result: detectedFace,
			}))
		} catch (err) {
			if (err instanceof ThrottledHttpError) {
				this._sm.trigger('detectFacesThrottled')
			}

			// Let periodic face detector deal with error
			throw err
		}
	}

	private _setStatus(text: string, emoji: string) {
		console.info('Status changed', text, emoji, this.state)
		this._status = { state: this.state, text, emoji }
		this._onStatusChangedDispatcher.dispatch(this._status)
	}
	//#endregion Actions

	//#region Helpers
	private _canCommentOnPerson(person: IdentifiedPerson): boolean {
		const prevComment = this._commentHistory.get(person.personId)
		if (!prevComment) {
			console.debug('OK, no previous comment.')
			return true
		}

		const timeSinceLastMs = prevComment.spokenOn ? differenceInMilliseconds(prevComment.spokenOn, new Date()) : undefined
		if (timeSinceLastMs === undefined || timeSinceLastMs > this._commentCooldownPerPersonMs) {
			console.debug('OK, long enough since previous comment.', timeSinceLastMs)
			return true
		}

		const waitTimeText = `${Math.round((this._commentCooldownPerPersonMs - timeSinceLastMs) / 1000)} seconds`
		console.info(`Too early to comment on person ${person.settings.name}, need to wait at least ${waitTimeText}.`)
		return false
	}

	//#endregion
}

const defaultExport = {
	Commentator,
	Sounds,
}
export default defaultExport
