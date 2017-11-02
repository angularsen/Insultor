import * as moment from 'moment'
type Moment = moment.Moment

import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
import Person from '../../docs/FaceAPI/Person'
import Cache from './Cache'
import { ICommentProvider } from './CommentProvider'
import { FakeCommentProvider } from './fakes/FakeCommentProvider'
import { FakeMicrosoftFaceApi } from './fakes/FakeMicrosoftFaceApi'
import { FakePresenceDetector } from './fakes/FakePresenceDetector'
import { FakeSpeech } from './fakes/FakeSpeech'
import { FakeVideoService } from './fakes/FakeVideoService'
import { IMicrosoftFaceApi } from './MicrosoftFaceApi'
import { IPeriodicFaceDetector, PeriodicFaceDetector } from './PeriodicFaceDetector'
import { IPresenceDetector } from './PresenceDetector'
import { ISpeech } from './Speech'
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
	detectFacesResult: DetectFaceResult[]
}

interface IdentifiedPerson {
	personId: string
	firstName: string
	lastName: string
	confidence: number
	detectFaceResult: DetectFaceResult
}

interface FacesIdentifiedPayload {
	detectFacesResult: DetectFacesResponse
	identifyFacesResult: IdentifyFacesResponse
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

export interface CommentatorOptions {
	onTransition?: (lifecycle: Lifecycle, ...args: any[]) => void
	init?: State
	videoService?: IVideoService
	faceDetector?: IPeriodicFaceDetector
	detectFacesIntervalMs?: number
	presenceDetector?: IPresenceDetector
	speech?: ISpeech
	faceApi?: IMicrosoftFaceApi
	commentProvider?: ICommentProvider
	personGroupId?: AAGUID
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

export class Commentator {
	public get onTransition(): IEvent<Lifecycle> { return this._onTransitionDispacher }

	private readonly _onTransitionDispacher = new EventDispatcher<Lifecycle>()
	private readonly _faceDetector: IPeriodicFaceDetector
	private readonly _commentProvider: ICommentProvider
	private readonly _faceApi: IMicrosoftFaceApi
	private readonly _fsm: MyStateMachine
	private readonly _personGroupId: AAGUID
	private readonly _presenceDetector: IPresenceDetector
	private readonly _speech: ISpeech
	private readonly _videoService: IVideoService

	/**
	 * Buffer of detected faces, which is drained whenever in detectFaces state.
	 * When in any other state, it is buffered in order to queue up while identifying/commenting
	 * on a previous faces, which can take several seconds.
	 */
	private _facesDetectedBuffer: DetectFaceResult[] = []

	constructor({
		commentProvider = new FakeCommentProvider(),
		faceApi = new FakeMicrosoftFaceApi(),
		init = 'idle',
		// tslint:disable-next-line:no-unnecessary-initializer
		faceDetector = undefined,
		detectFacesIntervalMs = 4000,
		presenceDetector = new FakePresenceDetector(),
		speech = new FakeSpeech(),
		videoService = new FakeVideoService(),
		personGroupId,
	}: CommentatorOptions = {}) {

		this._onDeliverComments = this._onDeliverComments.bind(this)
		this._onDetectFaces = this._onDetectFaces.bind(this)
		this._onDetectPresence = this._onDetectPresence.bind(this)
		this._onIdentifyFaces = this._onIdentifyFaces.bind(this)
		this._onIdle = this._onIdle.bind(this)
		this._onPeriodicDetectFacesAsync = this._onPeriodicDetectFacesAsync.bind(this)

		this._commentProvider = isDefined(commentProvider, 'commentProvider')
		this._faceApi = isDefined(faceApi, 'faceApi')
		this._presenceDetector = isDefined(presenceDetector, 'presenceDetector')
		this._speech = isDefined(speech, 'speech')
		this._videoService = isDefined(videoService, 'videoService')
		this._personGroupId = personGroupId
		this._faceDetector = faceDetector || new PeriodicFaceDetector(detectFacesIntervalMs, this._onPeriodicDetectFacesAsync)

		const config: MyConfig = {
			init,
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

		this._faceDetector.facesDetected.subscribe((result: DetectFacesResponse) => {
			try {
				this.facesDetected({ detectFacesResult: result })
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
				console.log(`transition [${lifecycle.transition}]: ${lifecycle.from} => ${lifecycle.to}`)
				this._onTransitionDispacher.dispatch(lifecycle)
			},
		})
	}

	get state(): State { return this._fsm.state }
	get history(): State[] { return this._fsm.history }

	// Proxy methods for strongly typed args
	public start = () => this._fsm.start()
	public stop = () => this._fsm.stop()
	public presenceDetected() { this._fsm.presenceDetected() }
	public noPresenceDetected() { this._fsm.noPresenceDetected() }

	public facesDetected(payload: FacesDetectedPayload) {
		this._facesDetectedBuffer.push(...payload.detectFacesResult)
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
		console.log('onDeliverComments')
		// Do not await here to not block state transition
		this._deliverCommentsAsync(input)
	}

	private async _deliverCommentsAsync(input: FacesIdentifiedPayload): Promise<void> {
		const MIN_CONFIDENCE = 0.5

		const identifiedFaces = input.identifyFacesResult
			.filter(x => x.candidates.filter(c => c.confidence >= MIN_CONFIDENCE).length > 0)

		const unidentifiedFaces = input.detectFacesResult
			.filter(detectedFace => !identifiedFaces.map(x => x.faceId).includes(detectedFace.faceId))

		console.info(`Identified ${identifiedFaces.length}/${input.detectFacesResult.length} faces.`)

		console.debug(`Get person info for ${input.detectFacesResult.length} faces...`)
		const groupId = this._personGroupId

		const identifiedFacesAndPersons = await Promise.all(identifiedFaces.map(async identifiedFace => {
			const personId = identifiedFace.candidates[0].personId
			const cacheKey = `MS_FACEAPI_GET_PERSON:group[${groupId}]:person[${personId}]`
			const person: Person = await Cache.getOrSetAsync(cacheKey, Cache.MAX_AGE_1DAY, () => this._faceApi.getPersonAsync(groupId, personId))

			return {
				identifiedFace,
				person,
			}
		}))

		const identifiedPersons: IdentifiedPerson[] = identifiedFacesAndPersons.map(x => ({
			confidence: x.identifiedFace.candidates[0].confidence,
			detectFaceResult: input.detectFacesResult.find(df => df.faceId === x.identifiedFace.faceId)!, // guaranteed to find faceId
			firstName: x.person.name.split(' ')[0],
			lastName: last(x.person.name.split(' ')),
			personId: x.person.personId,
		}))

		// TODO Insert contextual comments here
		const faceComments = unidentifiedFaces.map((x, i) => `Comment #${i} on face [${x.faceId}]`)
		const personComments = identifiedPersons.map((x, i) => `Comment #${i} on person [${x.personId}]`)
		const comments = personComments.concat(faceComments)

		for (const comment of comments) {
			this._speech.speak(comment)
		}

		this.commentsDelivered()
	}

	private _onDetectFaces(lifecycle: Lifecycle) {
		console.log('_onDetectFaces')

		switch (lifecycle.from) {
			case 'detectPresence': {
				this._faceDetector.start()
				break
			}
			default: {
				if (this._facesDetectedBuffer.length > 0) {
					console.log(`${this._facesDetectedBuffer.length} faces were detected in the meantime, identifying...`)

					// Can't transition while in transition
					setTimeout(() => this._fsm.facesDetected(), 0)
				}
				break
			}
		}
	}

	private _onIdentifyFaces(lifecycle: Lifecycle) {
		// Create a copy then clear buffer
		const detectFacesResult = this._facesDetectedBuffer.slice()
		this._facesDetectedBuffer = []
		console.log('Cleared faces detecetd buffer.')

		// Do not await here to not block transition, will run in background
		this._identifyFacesAsync({ detectFacesResult })
	}

	private async _identifyFacesAsync(payload: FacesDetectedPayload): Promise<void> {
		console.log('_onIdentifyFacesAsync')
		try {
			const detectFacesResponse = payload.detectFacesResult
			if (!detectFacesResponse || detectFacesResponse.length === 0) {
				console.debug('payload', payload)
				throw new Error('No detected faces were given.')
			}

			const faceIds = detectFacesResponse.map(x => x.faceId)

			console.debug(`Identifying ${detectFacesResponse.length} faces...`)
			const identifyFacesResponse: IdentifyFacesResponse = await this._faceApi.identifyFacesAsync(faceIds, this._personGroupId)
			console.debug(`Identifying ${detectFacesResponse.length} faces...Complete.`)

			// Identified faces (or not, commenting will handle anonymous faces)
			this.facesIdentified({
				detectFacesResult: detectFacesResponse,
				identifyFacesResult: identifyFacesResponse,
			})
		} catch (err) {
			console.error('Failed to identify faces.', error(err))
		}
	}

	private _onDetectPresence(lifecycle: Lifecycle) {
		console.log('_onDetectPresence')
		if (lifecycle.from === 'idle') {
			this._videoService.start()
			this._presenceDetector.start()
			this._facesDetectedBuffer = [] // clear buffer
		} else {
			this._faceDetector.stop()
		}
	}

	private _onIdle(lifecycle: Lifecycle) {
		console.log('_onIdle')
		this._presenceDetector.stop()
		this._videoService.stop()
		this._faceDetector.stop()
	}

	private async _onPeriodicDetectFacesAsync(): Promise<DetectFaceResult[]> {
		console.debug('Commentator: On periodically detect faces...')
		const imageDataUrl = this._videoService.getCurrentImageDataUrl()
		console.debug('Commentator: Got image data url, detecting faces...', this._faceApi, this._faceApi.detectFacesAsync)
		const result = await this._faceApi.detectFacesAsync(imageDataUrl)
		console.debug('Commentator: detect faces result', result)
		return result
	}
}

export default Commentator
