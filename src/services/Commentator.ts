import * as moment from 'moment'
type Moment = moment.Moment

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
import { IMicrosoftFaceApi } from './MicrosoftFaceApi'
import { DetectedFaceWithImageData, IPeriodicFaceDetector, PeriodicFaceDetector } from './PeriodicFaceDetector'
import { IPresenceDetector } from './PresenceDetector'
import { ISpeech, SpeakData } from './Speech'
import { EventDispatcher, IEvent } from './utils/Events'
import { error } from './utils/format'
import { isDefined, strEnum } from './utils/index'
import { IVideoService } from './VideoService'

function timeout(ms: number) { return new Promise<void>((res) => setTimeout(res, ms)) }

function contains(arr: any[], predicate: (item: any, idx: number) => boolean) {
		return arr.findIndex(predicate) >= 0
}

function last(arr: any[]) {
	const [lastItem] = arr.slice(-1)
	return lastItem
}

// tslint:disable:max-classes-per-file
// tslint:disable-next-line:variable-name
const StateMachine = require('javascript-state-machine')
// tslint:disable:no-submodule-imports
// tslint:disable-next-line:variable-name
const StateMachineHistory = require('javascript-state-machine/lib/history')

// tslint:disable-next-line:variable-name
const Action = strEnum([
	'start',
	'stop',
	'presenceDetected',
	'noPresenceDetected',
	'facesDetected',
	'facesIdentified',
	'commentsDelivered',
])
type Action = keyof typeof Action

// tslint:disable-next-line:variable-name
export const State = strEnum([
	'idle',
	'detectPresence',
	'detectFaces',
	'identifyFaces',
	'deliverComments',
])
export type State = keyof typeof State

type MyEventCaller = (...args: any[]) => void

interface MyStateMachine {
	// Transitions
	commentsDelivered: MyEventCaller
	start: MyEventCaller
	stop: MyEventCaller
	presenceDetected: MyEventCaller
	noPresenceDetected: MyEventCaller
	facesDetected: () => void
	facesIdentified: (input: FacesIdentifiedPayload) => void

	// Props
	history: State[]
	state: State
	onTransition: (lifecycle: Lifecycle, ...args: any[]) => void

	// Methods
	can: (transition: Action) => boolean
	observe: {
		(event: string, callback: (lifecycle: Lifecycle, ...args: any[]) => void): void,
		(events: object): void,
	}
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
	init?: State | { state: State, event: Action, defer: boolean }
	plugins: any[]
	// callbacks?: {
	// 	[s: string]: (event?: Action, from?: State, to?: State, ...args: any[]) => any,
	// }
	methods?: {
		onInvalidTransition: (transition: string, from: State, to: State) => void,
		onPendingTransition: (transition: string, from: State, to: State) => void,
		// 	onIdle?: (lifecycle: Lifecycle, ...args: any[]) => void,
		// 	onStart?: (lifecycle: Lifecycle, ...args: any[]) => void,
		// 	onStop?: (lifecycle: Lifecycle, ...args: any[]) => void,
		// 	onDetectPresence?: (lifecycle: Lifecycle, ...args: any[]) => void,
		// 	onDetectFaces?: (lifecycle: Lifecycle, ...args: any[]) => void,
		// 	onLeaveDetectFaces?: (lifecycle: Lifecycle, ...args: any[]) => void,
		// 	onIdentifyFaces?: (lifecycle: Lifecycle, input: IdentifyFacesInput) => void,
		// 	onDeliverComments?: (lifecycle: Lifecycle, input: DeliverCommentsInput) => void,
	}
	transitions?: MyTransition[]
}

interface MyTransition {
	name: Action
	from: '*' | State | State[]
	to: State | '' // empty for ignore
}

export interface Lifecycle {
	transition: string
	from: State
	to: State
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
	private readonly _commentCooldownPerPerson = moment.duration(10, 'seconds')

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
			detectFacesIntervalMs : 4000,
			init : 'idle',
			speech : new FakeSpeech(),
		}
		const opts: CommentatorOptions = { ...{}, ...defaultOpts, ...inputOpts }

		// Bind methods
		this._onDeliverComments = this._onDeliverComments.bind(this)
		this._onDetectFaces = this._onDetectFaces.bind(this)
		this._onDetectPresence = this._onDetectPresence.bind(this)
		this._onIdentifyFaces = this._onIdentifyFaces.bind(this)
		this._onIdle = this._onIdle.bind(this)
		this._onPeriodicDetectFacesAsync = this._onPeriodicDetectFacesAsync.bind(this)
		this._setStatus = this._setStatus.bind(this)

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
				{ from: 'detectPresence', name : 'presenceDetected', to  : 'detectFaces' },

				{ from: 'detectFaces', name    : 'facesDetected', to     : 'identifyFaces' },
				{ from: 'detectFaces', name    : 'noPresenceDetected', to: 'detectPresence' },
				{ from: 'detectFaces', name    : 'presenceDetected',   to: '' },

				{ from: 'identifyFaces', name  : 'facesIdentified', to   : 'deliverComments' },
				{ from: 'identifyFaces', name  : 'presenceDetected',   to: '' },
				{ from: 'identifyFaces', name  : 'noPresenceDetected', to: '' },

				{ from: 'deliverComments', name: 'commentsDelivered', to : 'detectFaces' },
				{ from: 'deliverComments', name: 'presenceDetected',   to: '' },
				{ from: 'deliverComments', name: 'noPresenceDetected', to: '' },
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

		this._faceDetector.facesDetected.subscribe((result: DetectedFaceWithImageData[]) => {
			try {
				this.facesDetected({ detectedFaces: result })
			} catch (err) {
				console.error('Failed to handle detected faces.', error(err))
			}
		})

		fsm.observe({
			// States
			onDeliverComments: this._onDeliverComments,
			onDetectFaces: this._onDetectFaces,
			onDetectPresence: this._onDetectPresence,
			onIdentifyFaces: this._onIdentifyFaces,
			onIdle: this._onIdle,
			onTransition: (lifecycle: Lifecycle, ...args: any[]) => {
				console.info(`transition [${lifecycle.transition}]: ${lifecycle.from} => ${lifecycle.to}`)
				this._onTransitionDispacher.dispatch(lifecycle)
			},
		})
	}

	get state(): State { return this._fsm.state }
	get history(): State[] { return this._fsm.history }

	// Proxy methods for strongly typed args
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

	public facesDetected(payload: FacesDetectedPayload) {
		const newFacesToIdentify: DetectedFaceWithImageData[] = payload.detectedFaces

		this._facesToIdentify.push(...newFacesToIdentify)
		if (this._fsm.can('facesDetected')) {
			this._fsm.facesDetected()
		}
	}

	public facesIdentified(payload: FacesIdentifiedPayload) { this._fsm.facesIdentified(payload) }
	public commentsDelivered() { this._fsm.commentsDelivered() }

	/**
	 * Returns a promise that resolves when it enters the given state, however
	 * it may have continued entering other states by the time the resolve
	 * handler is invoked.
	 */
	public waitForState(state: State, timeoutMs?: number): Promise<void> {
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
	private _onDeliverComments(lifecycle: Lifecycle, input: FacesIdentifiedPayload) {
		console.info('onDeliverComments')
		this._setStatus('Hør nå her', '😎')
		// Do not await here to not block state transition
		this._deliverCommentsAsync(input)
	}

	private async _deliverCommentsAsync(input: FacesIdentifiedPayload): Promise<void> {
		try {
			const CONFIDENT = 0.5

			const identifiedFaces = input.identifiedFaces
				.filter(x => x.candidates.filter(c => c.confidence >= CONFIDENT).length > 0)

			const unidentifiedFaces = input.detectedFaces
				.filter(detectedFace => !identifiedFaces.map(x => x.faceId).includes(detectedFace.faceId))

			console.info(`Identified ${identifiedFaces.length}/${input.detectedFaces.length} faces.`)

			if (identifiedFaces.length > 0) {
				this._hasIdentifiedFacesInCurrentPresence = true
			}

			const anonymousPersons: IdentifiedPerson[] = await Promise.all(
				unidentifiedFaces.map(async (faceWithImageData) => {
					const anonymousPerson = await this._faceApi.createAnonymousPersonWithFacesAsync([faceWithImageData.imageDataUrl])
					return {
						confidence: 1,
						detectedFace: faceWithImageData,
						person: anonymousPerson,
						personId: anonymousPerson.personId,
					}
				}))

			console.info(`Created ${anonymousPersons.length} anonymous persons.`)

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
			console.error('Failed to deliver comments')
	}

		this.commentsDelivered()
	}

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

		const waitTimeText = this._commentCooldownPerPerson.subtract(timeSinceLast).humanize()
		console.info(`Too early to comment on person ${commentInput.name}, need to wait at least ${waitTimeText}.`)
		return false
	}

	private _onDetectFaces(lifecycle: Lifecycle) {
		console.info('_onDetectFaces')

		if (!this._presenceDetector.isDetected) {
			console.info('User is no longer present, proceeding to not present state.')
			// Can't transition while in transition
			setTimeout(() => this.noPresenceDetected(), 0)
			return
		}

		switch (lifecycle.from) {
			case 'detectPresence': {
				this._faceDetector.start()
				this._setStatus('Kom litt nærmere så jeg får tatt en god titt på deg', '😁')
				break
			}
			case 'deliverComments': {
				this._setStatus('Du er her fortsatt ja...', '😑')
			}
			default: {
				if (this._facesToIdentify.length > 0) {
					console.info(`${this._facesToIdentify.length} faces were detected in the meantime, identifying...`)

					// Can't transition while in transition
					setTimeout(() => this._fsm.facesDetected(), 0)
					return
				}
				break
			}
		}
	}

	private _onIdentifyFaces(lifecycle: Lifecycle) {
		// Create a copy then clear buffer
		const facesToIdentify = this._facesToIdentify.slice()
		this._facesToIdentify = []
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
			console.error('Failed to identify faces.', error(err))
		}
	}

	private _onDetectPresence(lifecycle: Lifecycle) {
		console.info('_onDetectPresence')
		if (lifecycle.from === 'idle') {
			this._setStatus('Hei.. er det noen her?', '🙂')
			this._videoService.start()
			this._presenceDetector.start(200)
			this._facesToIdentify = [] // clear buffer
		} else {
			this._setStatus('Forlatt og alene igjen...', '😟')
			this._faceDetector.stop()
		}

		this._hasIdentifiedFacesInCurrentPresence = false
	}

	private _onIdle(lifecycle: Lifecycle) {
		console.info('_onIdle')

		this._setStatus('Zzzz...', '😴')
		this._presenceDetector.stop()
		this._videoService.stop()
		this._faceDetector.stop()
	}

	private async _onPeriodicDetectFacesAsync(): Promise<DetectedFaceWithImageData[]> {
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
	}

	private _setStatus(text: string, emoji: string) {
		this._status = { state: this.state, text, emoji }
		this._onStatusChangedDispatcher.dispatch(this._status)
	}
}

export default Commentator
