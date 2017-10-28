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
import { isDefined, strEnum } from './utils/index'
import { error } from './utils/format'
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
	deliverComments: (input: DeliverCommentsInput) => void
	commentsDelivered: MyEventCaller
	start: MyEventCaller
	stop: MyEventCaller
	presenceDetected: MyEventCaller
	noPresenceDetected: MyEventCaller
	facesDetected: (input: DetectFacesResponse) => void
	facesIdentified: (input: IdentifyFacesResponse) => void

	// Props
	state: State
	onTransition: (lifecycle: Lifecycle, ...args: any[]) => void

	// Methods
	observe: {
		(event: string, callback: (lifecycle: Lifecycle, ...args: any[]) => void): void,
		(events: object): void,
	}
}

interface IdentifyFacesInput {
	detectFacesResult: DetectFacesResponse
}

interface IdentifiedPerson {
	personId: string
	firstName: string
	lastName: string
	confidence: number
	detectFaceResult: DetectFaceResult
}

interface DeliverCommentsInput {
	identifiedPersons: IdentifiedPerson[]
	unidentifiedFaces: DetectFaceResult[]
}

interface MyConfig {
	init?: State | { state: State, event: Action, defer: boolean }
	transitions?: MyTransition[]
	callbacks?: {
		[s: string]: (event?: Action, from?: State, to?: State, ...args: any[]) => any,
	}
	methods?: {
		onIdle?: (lifecycle: Lifecycle, ...args: any[]) => void,
		onStart?: (lifecycle: Lifecycle, ...args: any[]) => void,
		onStop?: (lifecycle: Lifecycle, ...args: any[]) => void,
		onDetectPresence?: (lifecycle: Lifecycle, ...args: any[]) => void,
		onDetectFaces?: (lifecycle: Lifecycle, ...args: any[]) => void,
		onLeaveDetectFaces?: (lifecycle: Lifecycle, ...args: any[]) => void,
		onIdentifyFaces?: (lifecycle: Lifecycle, input: IdentifyFacesInput) => void,
		onDeliverComments?: (lifecycle: Lifecycle, input: DeliverCommentsInput) => void,
	}
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
	periodicFaceDetector?: IPeriodicFaceDetector
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
	if (transition.to == '') {
		// Not sure how we can tell TypeScript that '*' and State[] are not supposed to happen here
		const from = transition.from as State
		return {
			from,
			to: from,
			name: transition.name
		}
	} else {
		return transition
	}
}

export class Commentator {
	public set onTransition(value: (lifecycle: Lifecycle, ...args: any[]) => void) {
		this._fsm.observe('onTransition', value)
	}

	private _faceDetector: IPeriodicFaceDetector
	private _commentProvider: ICommentProvider
	private _faceApi: IMicrosoftFaceApi
	private readonly _fsm: MyStateMachine
	private _personGroupId: AAGUID
	private _presenceDetector: IPresenceDetector
	private _speech: ISpeech
	private _videoService: IVideoService

	constructor({
		commentProvider = new FakeCommentProvider(),
		faceApi = new FakeMicrosoftFaceApi(),
		init = 'idle',
		// tslint:disable-next-line:no-unnecessary-initializer
		periodicFaceDetector = undefined,
		detectFacesIntervalMs = 4000,
		presenceDetector = new FakePresenceDetector(),
		speech = new FakeSpeech(),
		videoService = new FakeVideoService(),
		personGroupId,
	}: CommentatorOptions = {}) {

		this._commentProvider = isDefined(commentProvider, 'commentProvider')
		this._faceApi = isDefined(faceApi, 'faceApi')
		this._presenceDetector = isDefined(presenceDetector, 'presenceDetector')
		this._speech = isDefined(speech, 'speech')
		this._videoService = isDefined(videoService, 'videoService')
		this._personGroupId = personGroupId
		this._faceDetector = periodicFaceDetector || new PeriodicFaceDetector(detectFacesIntervalMs, this._onPeriodicDetectFacesAsync)

		this._doDeliverComments = this._doDeliverComments.bind(this)
		this._doDetectFaces = this._doDetectFaces.bind(this)
		this._doDetectPresence = this._doDetectPresence.bind(this)
		this._doIdentifyFacesAsync = this._doIdentifyFacesAsync.bind(this)
		this._doIdle = this._doIdle.bind(this)

		const config: MyConfig = {
			init,
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
			this.facesDetected(result)
			} catch (err) {
				console.error('Failed to handle detected faces.', error(err))
			}
		})

		fsm.observe({
			// States
			onDeliverComments: this._doDeliverComments,
			onDetectFaces: this._doDetectFaces,
			onDetectPresence: this._doDetectPresence,
			onIdentifyFaces: (lifetime: Lifecycle, input: IdentifyFacesInput) => { 
				// Do not await here to not block transition, will run in background
				this._doIdentifyFacesAsync(input) 
			},
			onIdle: this._doIdle,
			onTransition: (lifecycle: Lifecycle, ...args: any[]) => {
				console.log(`transition [${lifecycle.transition}]: ${lifecycle.from} => ${lifecycle.to}`)
			},
		})

		const detectFacesFromCurrentVideoImageAsync = async (): Promise<any> => {
			console.debug('detectFacesFromCurrentVideoImageAsync')
			const imageDataUrl = videoService.getCurrentImageDataUrl()
			const detectFacesResult = await faceApi.detectFacesAsync(imageDataUrl)
			if (detectFacesResult.length) {
				fsm.facesDetected(detectFacesResult)
			}
		}

		fsm.observe('onDetectFaces', async (): Promise<any> => {
			console.log('onDetectFaces')

			while (fsm.state === 'detectFaces') {
				await detectFacesFromCurrentVideoImageAsync()
				await timeout(4000)
			}
		})

	}

	get state(): State { return this._fsm.state }

	// Proxy methods for strongly typed args
	public start = () => this._fsm.start()
	public stop = () => this._fsm.stop()
	public presenceDetected() { this._fsm.presenceDetected() }
	public noPresenceDetected() { this._fsm.noPresenceDetected() }
	public facesDetected(detectFacesResult: DetectFacesResponse) { this._fsm.facesDetected(detectFacesResult) }
	public facesIdentified(identifyFacesResult: IdentifyFacesResponse) { this._fsm.facesIdentified(identifyFacesResult) }
	public commentsDelivered() { this._fsm.commentsDelivered() }

	// State handlers
	private _doDeliverComments(lifecycle: Lifecycle, input: DeliverCommentsInput) {
			console.log('onDeliverComments')

			// TODO Insert contextual comments here
			const faceComments = input.unidentifiedFaces.map((x, i) => 'Face comment ' + i)
			const personComments = input.identifiedPersons.map((x, i) => 'Person comment ' + i)
			const comments = personComments.concat(faceComments)

			for (const comment of comments) {
				this._speech.speak(comment)
			}
		}

	private _doDetectFaces() {
		console.log('doDetectFaces')
		this._faceDetector.start()
	}

	private async _doIdentifyFacesAsync(input: IdentifyFacesInput) {
		console.log('doIdentifyFacesAsync')
		// const imageDataUrl = this._videoService.getCurrentImageDataUrl()
		try {
			const detectedFaces = input.detectFacesResult
			if (!detectedFaces || detectedFaces.length === 0) { throw new Error('No detected faces were given.') }

			const faceIds = detectedFaces.map(x => x.faceId)

			console.debug(`Identifying ${detectedFaces.length} faces...`)
			const result = await this._faceApi.identifyFacesAsync(faceIds, this._personGroupId)

			const MIN_CONFIDENCE = 0.5
			const identifiedFaces = result.filter(x => x.candidates.filter(c => c.confidence >= MIN_CONFIDENCE).length > 0)
			const unidentifiedFaces = detectedFaces.filter(detectedFace => identifiedFaces.map(x => x.faceId).includes(detectedFace.faceId))

			console.info(`Identified ${identifiedFaces.length}/${result.length} faces.`)

			console.debug(`Get person info ${detectedFaces.length} faces...`)
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
				detectFaceResult: detectedFaces.find(df => df.faceId === x.identifiedFace.faceId)!, // guaranteed to find faceId
				firstName: x.person.name.split(' ')[0],
				lastName: last(x.person.name.split(' ')),
				personId: x.person.personId,
			}))

			this._fsm.deliverComments({
				identifiedPersons,
				unidentifiedFaces,
			})
		} catch (err) {
			console.error('Failed to detect faces.', err)
		}
	}

	private _doDetectPresence(lifecycle: Lifecycle) {
		console.log('doDetectPresence')
		this._videoService.start()
		this._presenceDetector.start()
	}

	private _doIdle(lifecycle: Lifecycle) {
		console.log('doIdle')
		this._presenceDetector.stop()
		this._videoService.stop()
	}

	private _onPeriodicDetectFacesAsync(): Promise<DetectFaceResult[]> {
		const imageDataUrl = this._videoService.getCurrentImageDataUrl()
		return this._faceApi.detectFacesAsync(imageDataUrl)
	}
}

export default Commentator
