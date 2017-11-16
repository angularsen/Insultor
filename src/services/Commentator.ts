import * as moment from 'moment'
type Moment = moment.Moment

import { setInterval, setTimeout } from 'timers' // Workaround for webpack --watch: https://github.com/TypeStrong/ts-loader/issues/348
import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
import Person, { UserData } from '../../docs/FaceAPI/Person'
import Cache from './Cache'
import { ICommentProvider } from './CommentProvider'
import { FakeCommentProvider } from './fakes/FakeCommentProvider'
import { FakeMicrosoftFaceApi } from './fakes/FakeMicrosoftFaceApi'
import { FakePresenceDetector } from './fakes/FakePresenceDetector'
import { FakeSpeech } from './fakes/FakeSpeech'
import { FakeVideoService } from './fakes/FakeVideoService'
import { HttpError, IMicrosoftFaceApi, ThrottledHttpError } from './MicrosoftFaceApi'
import { DetectedFaceWithImageData, IPeriodicFaceDetector, PeriodicFaceDetector } from './PeriodicFaceDetector'
import { IPresenceDetector } from './PresenceDetector'
import { ISpeech, SpeakData } from './Speech'
import { EventDispatcher, IEvent } from './utils/Events'
import { error } from './utils/format'
import { isDefined, strEnum } from './utils/index'
import { IVideoService } from './VideoService'

// tslint:disable:variable-name
const StateMachine = require('javascript-state-machine')
// tslint:disable-next-line:no-submodule-imports
const StateMachineHistory = require('javascript-state-machine/lib/history')
// tslint:restore:variable-name

//#region Helper functions
declare global {
  interface Array<T> {
		/**
		 * Returns the array with distinct/unique elements, optionally based on some property value.
		 */
    distinct<U>(map?: (el: T) => U): Array<T>
  }
}

if (!Array.prototype.distinct) {
  Array.prototype.distinct = function<T,U>(map?: (el: T) => U): T[] {
		if (map) {
		return this.filter((elem: T, pos: number, arr: T[]) => arr.map(map).indexOf(map(elem)) === pos)
		} else {
			return this.filter((elem: T, pos: number, arr: T[]) => arr.indexOf(elem) === pos)
		}
  }
}

function timeout(ms: number) { return new Promise<void>((res) => setTimeout(res, ms)) }

function contains(arr: any[], predicate: (item: any, idx: number) => boolean) {
		return arr.findIndex(predicate) >= 0
}

function last(arr: any[]) {
	const [lastItem] = arr.slice(-1)
	return lastItem
}
//#endregion Helper functions

//#region Internal types

// tslint:disable-next-line:variable-name
const Transition = strEnum([
	'start',
	'stop',
	'presenceDetected',
	'noPresenceDetected',
	'facesDetected',
	'facesIdentified',
	'noFacesToIdentify',
	'commentsDelivered',
	'detectFacesFailedByThrottling',
	'identifyFacesFailedByThrottling',
	'waitForThrottlingCompleted'
])
type Transition = keyof typeof Transition

type MyEventCaller = (...args: any[]) => void

interface MyStateMachine {
	// Props
	history: State[]
	state: State
	onTransition: (lifecycle: Lifecycle, ...args: any[]) => void

	// Method with multiple signatures
	observe: {
		(event: string, callback: (lifecycle: Lifecycle, ...args: any[]) => void): void,
		(events: object): void,
	}

	// Transitions
	start(): void
	stop(): void
	presenceDetected(): void
	noPresenceDetected(): void
	facesDetected(): void
	noFacesToIdentify(): void
	facesIdentified(input: FacesIdentifiedPayload): void
	commentsDelivered(): void
	detectFacesFailedByThrottling(): void
	identifyFacesFailedByThrottling(): void
	waitForThrottlingCompleted(): void

	// Methods
	can(transition: Transition): boolean
	fire(transition: Transition, ...args: any[]): void
}

interface FacesDetectedPayload {
	detectedFaces: DetectedFaceWithImageData[]
}

interface IdentifiedPerson {
	personId: string
	person: Person
	confidence: number
	detectedFace: DetectedFaceWithImageData
}

interface FacesIdentifiedPayload {
	detectedFaces: DetectedFaceWithImageData[]
	identifiedFaces: IdentifyFacesResponse
}

interface MyConfig {
	init?: State | { state: State, event: Transition, defer: boolean }
	plugins: any[]
	methods?: {
		onInvalidTransition: (transition: string, from: State, to: State) => void,
		onPendingTransition: (transition: string, from: State, to: State) => void,
	}
	transitions?: MyTransition[]
}

interface MyTransition {
	name: Transition
	from: '*' | State | State[]
	to: State | '' // empty for ignore
}

// To avoid filling out entire object for the sake of a test
// tslint:disable-next-line:no-object-literal-type-assertion
const fakeFace = {
	faceAttributes: { gender: 'male', age: 40 },
	faceId: 'fake face id',
} as DetectFaceResult

function withReentryToStateIfEmpty(transition: MyTransition): MyTransition {
	if (transition.to === '') {
		// Not sure how we can tell TypeScript that '*' and State[] are not supposed to happen here
		const from = transition.from as State
		return {
			from,
			name: transition.name,
			to: from,
		}
	} else {
		return transition
	}
}

interface DefaultOpts {
	commentProvider: ICommentProvider
	detectFacesIntervalMs: number
	init: State
	speech: ISpeech
}

interface InputOpts {
	// Required
	faceApi: IMicrosoftFaceApi
	presenceDetector: IPresenceDetector
	videoService: IVideoService

	// Optional
	commentProvider?: ICommentProvider
	detectFacesIntervalMs?: number
	faceDetector?: IPeriodicFaceDetector
	init?: State
	speech?: ISpeech
}

interface CommentatorOptions {
	commentProvider: ICommentProvider
	detectFacesIntervalMs: number
	faceApi: IMicrosoftFaceApi
	faceDetector?: IPeriodicFaceDetector
	init: State
	presenceDetector: IPresenceDetector
	speech: ISpeech
	videoService: IVideoService
}

interface DeliverCommentInput {
	/** The comment text to deliver */
	comment: string
	/** The detected face ID */
	faceId: string
	/** URL encoded data of image that detected the face  */
	imageDataUrl: string
	/** The name of the person */
	name: string
	/** Info about person. */
	person: Person
}

//#endregion Internal types

//#region Exported types

// tslint:disable-next-line:variable-name
export const State = strEnum([
	'idle',
	'detectPresence',
	'detectFaces',
	'identifyFaces',
	'deliverComments',
	'waitForThrottling'
])
export type State = keyof typeof State

export interface Lifecycle {
	transition: string
	from: State
	to: State
}

export interface StatusInfo {
	emoji: string
	state: State
	text: string
}

export interface DeliverCommentData {
	/** The detected face ID */
	imageDataUrl: string
	/** The name of the person if identified */
	name: string
	/** ID of person if identified. */
	personId: string
	/** The speech data for the comment being delivered */
	speech: SpeakData
	/** When comment was delivered, in order to throttle and avoid spam of certain persons. */
	when: Date
}
//#endregion Exported types

export class Commentator {
	public get onSpeakCompleted(): IEvent<void> { return this._onSpeakCompletedDispatcher }
	public get onSpeak(): IEvent<DeliverCommentData> { return this._onSpeakDispatcher }
	public get onStatusChanged(): IEvent<StatusInfo> { return this._onStatusChangedDispatcher }
	public get onTransition(): IEvent<Lifecycle> { return this._onTransitionDispacher }
	public get status(): StatusInfo { return this._status }

	private readonly _onStatusChangedDispatcher = new EventDispatcher<StatusInfo>()
	private readonly _onSpeakCompletedDispatcher = new EventDispatcher<void>()
	private readonly _onSpeakDispatcher = new EventDispatcher<DeliverCommentData>()
	private readonly _onTransitionDispacher = new EventDispatcher<Lifecycle>()
	private readonly _faceDetector: IPeriodicFaceDetector
	private readonly _commentProvider: ICommentProvider
	private readonly _faceApi: IMicrosoftFaceApi
	private readonly _fsm: MyStateMachine
	private readonly _presenceDetector: IPresenceDetector
	private readonly _speech: ISpeech
	private readonly _videoService: IVideoService
	private readonly _commentCooldownPerPerson = moment.duration(60, 'seconds')

	/**
	 * Key is personId. History of delivered comments, in order to avoid spamming comments
	 * to the same persons.
	 */
	private readonly _commentHistory: Map<string, DeliverCommentData> = new Map<string, DeliverCommentData>()

	/**
	 * Buffer of detected faces, which is drained whenever in detectFaces state.
	 * When in any other state, it is buffered in order to queue up while identifying/commenting
	 * on a previous faces, which can take several seconds.
	 */
	private _facesToIdentify: DetectedFaceWithImageData[] = []

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
			commentProvider : new FakeCommentProvider(),
			detectFacesIntervalMs : 6000,
			init : 'idle',
			speech : new FakeSpeech(),
		}
		const opts: CommentatorOptions = { ...{}, ...defaultOpts, ...inputOpts }

		// Bind methods
		this.start = this.start.bind(this)
		this.stop = this.stop.bind(this)
		this.presenceDetected = this.presenceDetected.bind(this)
		this.noPresenceDetected = this.noPresenceDetected.bind(this)
		this.facesDetected = this.facesDetected.bind(this)
		this.facesIdentified = this.facesIdentified.bind(this)
		this.noFacesToIdentify = this.noFacesToIdentify.bind(this)
		this.commentsDelivered = this.commentsDelivered.bind(this)

		this._enqueue = this._enqueue.bind(this)
		this._enqueueAction = this._enqueueAction.bind(this)
		this._onEnterDeliverComments = this._onEnterDeliverComments.bind(this)
		this._onEnterDetectFaces = this._onEnterDetectFaces.bind(this)
		this._onEnterDetectPresence = this._onEnterDetectPresence.bind(this)
		this._onEnterIdentifyFaces = this._onEnterIdentifyFaces.bind(this)
		this._onEnterIdle = this._onEnterIdle.bind(this)
		this._onPeriodicDetectFacesAsync = this._onPeriodicDetectFacesAsync.bind(this)
		this._onEnterWaitForThrottling = this._onEnterWaitForThrottling.bind(this)

		this._commentProvider = opts.commentProvider
		this._faceApi = opts.faceApi
		this._presenceDetector = opts.presenceDetector
		this._speech = opts.speech
		this._videoService = opts.videoService
		this._faceDetector = opts.faceDetector || new PeriodicFaceDetector(opts.detectFacesIntervalMs, this._onPeriodicDetectFacesAsync)

		const config: MyConfig = {
			init: opts.init,
			methods: {
				onInvalidTransition(transition: string, from: State, to: State) {
					throw new Error(`Transition [${transition}] not allowed from [${from}]`)
				},
				onPendingTransition(transition: string, from: State, to: State) {
					throw new Error(`Transition [${transition}] not allowed from [${from} => ${to}], a transition already pending.`)
				},
			},
			plugins: [
				new StateMachineHistory(),
			],
			transitions: [
				{ from: '*', name              : 'stop', to              : 'idle' },
				{ from: 'idle', name           : 'start', to             : 'detectPresence' },
				{ from: 'idle', name           : 'presenceDetected', to  : '' }, // Ignore late events after stopping
				{ from: 'idle', name           : 'noPresenceDetected', to: '' },
				{ from: 'idle', name           : 'facesDetected', to: '' },
				{ from: 'idle', name           : 'facesIdentified', to: '' },
				{ from: 'idle', name           : 'noFacesToIdentify', to: '' },
				{ from: 'idle', name           : 'commentsDelivered', to: '' },
				{ from: 'idle', name           : 'detectFacesFailedByThrottling', to: '' },
				{ from: 'idle', name           : 'identifyFacesFailedByThrottling', to: '' },
				{ from: 'idle', name           : 'waitForThrottlingCompleted', to: '' },

				{ from: 'detectPresence', name : 'presenceDetected', to  : 'detectFaces' },

				{ from: 'detectFaces', name    : 'facesDetected', to     : 'identifyFaces' },
				{ from: 'detectFaces', name    : 'noPresenceDetected', to: 'detectPresence' },
				{ from: 'detectFaces', name    : 'presenceDetected',   to: '' },
				{ from: 'detectFaces', name    : 'detectFacesFailedByThrottling', to: 'waitForThrottling' },
				{ from: 'detectFaces', name    : 'identifyFacesFailedByThrottling', to: 'waitForThrottling' },
				{ from: 'detectFaces', name    : 'waitForThrottlingCompleted', to: '' },

				{ from: 'identifyFaces', name  : 'facesIdentified', to   : 'deliverComments' },
				{ from: 'identifyFaces', name  : 'noFacesToIdentify',  to: 'detectFaces' },
				{ from: 'identifyFaces', name  : 'identifyFacesFailedByThrottling', to: 'waitForThrottling' },
				{ from: 'identifyFaces', name  : 'presenceDetected',   to: '' },
				{ from: 'identifyFaces', name  : 'noPresenceDetected', to: '' },
				{ from: 'identifyFaces', name  : 'detectFacesFailedByThrottling', to: '' },
				{ from: 'identifyFaces', name  : 'waitForThrottlingCompleted', to: '' },

				{ from: 'deliverComments', name: 'commentsDelivered', to : 'detectFaces' },
				{ from: 'deliverComments', name: 'presenceDetected',   to: '' },
				{ from: 'deliverComments', name: 'noPresenceDetected', to: '' },
				{ from: 'deliverComments', name: 'detectFacesFailedByThrottling', to: '' },
				{ from: 'deliverComments', name: 'identifyFacesFailedByThrottling', to: '' },
				{ from: 'deliverComments', name: 'waitForThrottlingCompleted', to: '' },

				// Ignore all but waitForThrottlingCompleted and stop (declared by wildcard above)
				{ from: 'waitForThrottling', name  : 'waitForThrottlingCompleted', to: 'detectFaces' },
				{ from: 'waitForThrottling', name  : 'presenceDetected', to: '' },
				{ from: 'waitForThrottling', name  : 'noPresenceDetected', to: '' },
				{ from: 'waitForThrottling', name  : 'facesDetected', to: '' },
				{ from: 'waitForThrottling', name  : 'noFacesToIdentify', to: '' },
				{ from: 'waitForThrottling', name  : 'detectFacesFailedByThrottling', to: '' },
				{ from: 'waitForThrottling', name  : 'facesIdentified', to: '' },
				{ from: 'waitForThrottling', name  : 'identifyFacesFailedByThrottling', to: '' },
				{ from: 'waitForThrottling', name  : 'commentsDelivered', to: '' },
			],
		}

		// Set up reentry transitions for empty 'to' states
		config.transitions = config.transitions && config.transitions.map(withReentryToStateIfEmpty)

		const fsm: MyStateMachine = (new StateMachine(config))!
		this._fsm = fsm

		this._presenceDetector.onIsDetectedChanged.subscribe((isPresenceDetected: boolean) => {
			try {
			isPresenceDetected ? this.presenceDetected() : this.noPresenceDetected()
			} catch (err) {
				console.error('Failed to handle presence detected.', error(err))
			}
		})

		this._faceDetector.facesDetected.subscribe((detectedFaces: DetectedFaceWithImageData[]) => {
			try {
				this._facesToIdentify.push(...detectedFaces)
				this.facesDetected()
			} catch (err) {
				console.error('Failed to handle detected faces.', error(err))
			}
		})

		fsm.observe({
			// States
			onIdle: this._onEnterIdle,
			onDetectPresence: this._onEnterDetectPresence,
			onDetectFaces: this._onEnterDetectFaces,
			onIdentifyFaces: this._onEnterIdentifyFaces,
			onDeliverComments: this._onEnterDeliverComments,
			onWaitForThrottling: this._onEnterWaitForThrottling,
			onTransition: (lifecycle: Lifecycle, ...args: any[]) => {
				console.info(`transition [${lifecycle.transition}]: ${lifecycle.from} => ${lifecycle.to}`)
				this._onTransitionDispacher.dispatch(lifecycle)
			},
		})
	}

	get state(): State { return this._fsm.state }
	get history(): State[] { return this._fsm.history }

	// Proxy methods for strongly typed args
	public error(): void { this._fsm.detectFacesFailedByThrottling() }
	public presenceDetected() { this._fsm.presenceDetected() }
	public noPresenceDetected() { this._fsm.noPresenceDetected() }
	public start = () => this._fsm.start()
	public stop = () => this._fsm.stop()

	public toggleStartStop() {
		if (this._fsm.can('start')) {
			this.start()
		} else if (this._fsm.can('stop')) {
			this.stop()
		} else {
			console.error(`Can\`t toggle start/stop in state ${this.state}. This is a bug, should always be possible to start/stop.`)
		}
	}

	public facesDetected() {
		if (!this._fsm.can('facesDetected')) {
			console.warn('facesDetected: Cannot detect faces in current state: ' + this.state)
		} else if (this._facesToIdentify.length === 0) {
			console.error('facesDetected: No faces detected, this should normally not happen.')
		} else {
			this._fsm.facesDetected()
		}
	}

	public facesIdentified(payload: FacesIdentifiedPayload) { this._fsm.facesIdentified(payload) }
	public noFacesToIdentify() { this._fsm.noFacesToIdentify() }
	public commentsDelivered() { this._fsm.commentsDelivered() }

	/**
	 * Returns a promise that resolves when it enters the given state, however
	 * it may have continued entering other states by the time the resolve
	 * handler is invoked.
	 */
	public waitForState(state: State, timeoutMs: number = 1000): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeoutHandle = setTimeout(() => reject(new Error('Timed out waiting for state: ' + state)), timeoutMs)
			this._fsm.observe('onTransition', (lifeCycle, args) => {
				if (lifeCycle.to === state) {
					resolve()
					clearTimeout(timeoutHandle)
				}
			})
		})
	}

	// State handlers
	private _onEnterIdle(lifecycle: Lifecycle) {
		console.info('_onIdle')

		this._setStatus('Zzzz...', '😴')
		this._presenceDetector.stop()
		this._videoService.stop()
		this._faceDetector.stop()
	}

	private _onEnterDetectPresence(lifecycle: Lifecycle) {
		console.info('_onDetectPresence')
		if (lifecycle.from === 'idle') {
			this._setStatus('Hei.. er det noen her?', '🙂')
			this._videoService.start()
			this._presenceDetector.start(200)
		} else {
			this._setStatus('Forlatt og alene igjen...', '😟')
			this._faceDetector.stop()
		}

		this._facesToIdentify = [] // clear buffer
		this._hasIdentifiedFacesInCurrentPresence = false
	}

	private _onEnterDetectFaces(lifecycle: Lifecycle) {
		console.info('_onDetectFaces')

		if (!this._presenceDetector.isDetected) {
			console.info('User is no longer present, proceeding to not present state.')
			this._enqueue('noPresenceDetected')
			return
		}

		switch (lifecycle.from) {
			case 'detectPresence': {
				console.info('Presence was just detected, proceeding to attempt to detect faces.')
				this._setStatus('Kom litt nærmere så jeg får tatt en god titt på deg', '😁')
				this._faceDetector.start()
				break
			}
			default: {
				if (this._facesToIdentify.length > 0) {
					console.info(`${this._facesToIdentify.length} faces were detected in the meantime, immediately start identifying them.`)
					this._enqueue('facesDetected')
				} else {
					console.info('User is still present, continue to detect faces in the background.')
					this._setStatus('Du er her fortsatt ja...', '😑')
				}
				break
			}
		}
	}

	private _onEnterIdentifyFaces(lifecycle: Lifecycle) {
		// Create a copy then clear buffer
		const facesToIdentify = this._facesToIdentify.slice()
		this._facesToIdentify = []
		console.info('Cleared faces detected buffer.')

		if (facesToIdentify.length === 0) {
			console.warn('No faces to identify, this should normally not happen.')
			this._enqueue('noFacesToIdentify')
			return
		}

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

	private _onEnterDeliverComments(lifecycle: Lifecycle, input: FacesIdentifiedPayload) {
		console.info('onDeliverComments')
		// Do not await here to not block state transition
		this._commentOnFacesAndPersonsAsync(input)
	}

	private _onEnterWaitForThrottling(lifecycle: Lifecycle) {
		console.info('Wait 5 seconds for throttling...')
		this._setStatus('Oops.. har brukt opp gratiskvoten, må vente litt!', '🙄')
		setTimeout(() => {
			console.info('Wait 5 seconds for throttling...DONE.')
			this._fsm.waitForThrottlingCompleted()
		}, 5000)
	}

	//#region Actions
	private async _commentOnFacesAndPersonsAsync(input: FacesIdentifiedPayload): Promise<void> {
		try {
			const CONFIDENT = 0.5

			const identifiedFaces = input.identifiedFaces
				.filter(x => x.candidates.filter(c => c.confidence >= CONFIDENT).length > 0) // At least one good match
				.distinct(x => x.candidates[0].personId) // Do not return multiple of same person

			const unidentifiedFaces = input.detectedFaces
				.filter(detectedFace => !identifiedFaces.map(x => x.faceId).includes(detectedFace.faceId))

			console.info(`Identified ${identifiedFaces.length}/${input.detectedFaces.length} faces.`)

			if (identifiedFaces.length > 0) {
				this._hasIdentifiedFacesInCurrentPresence = true
			}

			const anonymousPersons: IdentifiedPerson[] = await Promise.all(
				unidentifiedFaces.map(async (faceWithImageData) => {
					console.info(`Create anonymous person for face [${faceWithImageData.faceId}].`)
					const anonymousPerson = await this._faceApi.createAnonymousPersonWithFacesAsync([faceWithImageData.imageDataUrl])
					return {
						confidence: 1,
						detectedFace: faceWithImageData,
						person: anonymousPerson,
						personId: anonymousPerson.personId,
					}
				}))

			console.debug(`Get person info for ${input.detectedFaces.length} faces...`)

			const identifiedPersons: IdentifiedPerson[] = await Promise.all(identifiedFaces.map(async identifiedFace => {
				const personId = identifiedFace.candidates[0].personId
				const cacheKey = `MS_FACEAPI_GET_PERSON:person[${personId}]`
				const person: Person = await Cache.getOrSetAsync(cacheKey, Cache.MAX_AGE_1DAY, () => this._faceApi.getPersonAsync(personId))

				const detectedFace = input.detectedFaces.find(df => df.faceId === identifiedFace.faceId)
				if (!detectedFace) { throw new Error('Detected face not found. This is a bug.') }

				return {
					confidence: identifiedFace.candidates[0].confidence,
					detectedFace,
					person,
					personId: person.personId,
				}
			}))

			const faceComments = anonymousPersons.map((person, i): DeliverCommentInput => {
				const faceId = person.detectedFace.faceId
				const imageData = input.detectedFaces.find(df => df.faceId === faceId)
				if (!imageData) { throw new Error('Could not find image data for face ID: ' + faceId) }

				const comment = this._commentProvider.getCommentForPerson({
					face: person.detectedFace.result,
					person: person.person,
				})

				const result: DeliverCommentInput = {
					comment,
					faceId,
					imageDataUrl: imageData.imageDataUrl,
					name: person.person.name,
					person: person.person,
				}
				return result
			})

			const personComments = identifiedPersons.map((idPerson, i): DeliverCommentInput => {
				const faceId = idPerson.detectedFace.faceId
				const imageData = input.detectedFaces.find(img => img.faceId === faceId)
				if (!imageData) { throw new Error('Could not find image data for face ID: ' + faceId) }

				const comment = this._commentProvider.getCommentForPerson({
					face: idPerson.detectedFace.result,
					person: idPerson.person,
				})

				const result: DeliverCommentInput = {
					comment,
					faceId,
					imageDataUrl: imageData && imageData.imageDataUrl,
					name: idPerson.person.name,
					person: idPerson.person,
				}
				return result
			})

			const commentInputs = personComments.concat(faceComments)

			if (commentInputs.length > 0) {
				this._setStatus('Hør nå her', '😎')
			}

			for (const commentInput of commentInputs) {
				if (!this._canCommentOnPerson(commentInput)) {
					console.warn('Skip comment on person.', commentInput.person)
					continue
				}

				const logText = `Commenting on ${commentInput.name ? `person ${commentInput.name}` : `face ${commentInput.faceId}`}`
				console.info(`${logText}...`)
				const speech = this._speech.speak(commentInput.comment)
				const userData = JSON.parse(commentInput.person.userData) as UserData

				const commentData: DeliverCommentData = {
					imageDataUrl: commentInput.imageDataUrl,
					name: userData.firstName,
					personId: commentInput.person.personId,
					speech,
					when: new Date(),
				}

				this._commentHistory.set(commentInput.person.personId, commentData)
				this._onSpeakDispatcher.dispatch(commentData)
				await speech.completion
				console.info(`${logText}...DONE`)
			}

			this._onSpeakCompletedDispatcher.dispatch(undefined)
		} catch (err) {
			if (err instanceof ThrottledHttpError) {
				console.warn(`Identification was throttled, adding back ${input.detectedFaces.length} faces to retry later.`)
				this._facesToIdentify.push(...input.detectedFaces)
				this._fsm.identifyFacesFailedByThrottling()
			}
			console.error('Failed to deliver comments')
	}

		this.commentsDelivered()
	}

	private async _identifyFacesAsync(facesToIdentify: DetectedFaceWithImageData[]): Promise<void> {
		console.info('_onIdentifyFacesAsync')
		try {
			if (!facesToIdentify || facesToIdentify.length === 0) {
				throw new Error('No detected faces were given.')
			}

			const faceIds = facesToIdentify.map(x => x.faceId)

			console.debug(`Identifying ${facesToIdentify.length} faces...`)
			const identifyFacesResponse: IdentifyFacesResponse = await this._faceApi.identifyFacesAsync(faceIds)
			console.debug(`Identifying ${facesToIdentify.length} faces...Complete.`)

			// Identified faces (or not, commenting will handle anonymous faces)
			this.facesIdentified({
				detectedFaces: facesToIdentify,
				identifiedFaces: identifyFacesResponse,
			})
		} catch (err) {
			if (err instanceof ThrottledHttpError) {
				console.warn('Identify faces was throttled, adding back faces for retry later.')
				this._facesToIdentify.push(...facesToIdentify)
				this._fsm.identifyFacesFailedByThrottling()
			}
			console.error('Failed to identify faces.', error(err))
			this.error()
		}
	}

	private async _onPeriodicDetectFacesAsync(): Promise<DetectedFaceWithImageData[]> {
		try {
			console.debug(`On periodically detect faces...`)
			const imageDataUrl = this._videoService.getCurrentImageDataUrl()
			console.debug(`Got image data url, detecting faces...`)
			const result = await this._faceApi.detectFacesAsync(imageDataUrl)
			console.debug(`detect faces result`, result)

			return result.map(detectedFace => ({
				faceId: detectedFace.faceId,
				imageDataUrl,
				result: detectedFace,
			}))
		} catch (err) {
			if (err instanceof ThrottledHttpError) {
				this._fsm.detectFacesFailedByThrottling()
			}

			// Let periodic face detector deal with error
			throw err
		}
	}

	private _enqueue(transition: Transition): void {
		switch (transition) {
			case 'start': this._enqueueAction(this.start); break
			case 'stop': this._enqueueAction(this.stop); break
			case 'presenceDetected': this._enqueueAction(this.presenceDetected); break
			case 'noPresenceDetected': this._enqueueAction(this.noPresenceDetected); break
			case 'facesDetected': this._enqueueAction(this.facesDetected); break
			// case 'facesIdentified': this._enqueueAction(this.facesIdentified); break   arguments not supported, should refactor to argument-less
			case 'noFacesToIdentify': this._enqueueAction(this.noFacesToIdentify); break
			case 'commentsDelivered': this._enqueueAction(this.commentsDelivered); break
			default: throw new Error('Transition not implemented: ' + transition)
		}
	}

	private _enqueueAction(action: () => void): void {
		setTimeout(action, 0)
	}

	private _setStatus(text: string, emoji: string) {
		console.info('Status changed', text, emoji, this.state)
		this._status = { state: this.state, text, emoji }
		this._onStatusChangedDispatcher.dispatch(this._status)
	}
	//#endregion Actions

	//#region Helpers
	private _canCommentOnPerson(commentInput: DeliverCommentInput): boolean {
		const prevComment = this._commentHistory.get(commentInput.person.personId)
		if (!prevComment) {
			console.debug('OK, no previous comment.')
			return true
		}

		const timeSinceLast = moment.duration(moment().diff(prevComment.when))
		if (timeSinceLast > this._commentCooldownPerPerson) {
			console.debug('OK, long enough since previous comment.', timeSinceLast)
			return true
		}

		const waitTimeText = moment.duration(this._commentCooldownPerPerson).subtract(timeSinceLast).humanize()
		console.info(`Too early to comment on person ${commentInput.name}, need to wait at least ${waitTimeText}.`)
		return false
	}

	//#endregion
}

export default Commentator
