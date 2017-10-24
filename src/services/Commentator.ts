import * as moment from 'moment'
type Moment = moment.Moment

import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
import Person from '../../docs/FaceAPI/Person'
import Cache from './Cache'
import { IPeriodicFaceDetector, PeriodicFaceDetector } from './PeriodicFaceDetector'
import { EventDispatcher, IEvent } from './utils/Events'

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

/** Utility function to create a K:V from a list of strings */
function strEnum<T extends string>(o: T[]): {[K in T]: K} {
	return o.reduce((res, key) => {
		res[key] = key
		return res
	}, Object.create(null))
}

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
	to: State
}

export interface IPresenceDetector {
	isDetected: boolean
	readonly onIsDetectedChanged: IEvent<boolean>
	addMotionScore(motionScore: number, receivedOnDate: Date): void
	start(): void
	stop(): void
}

export class FakePresenceDetector implements IPresenceDetector {
	private _isDetected: boolean = false
	private _onIsDetectedChanged = new EventDispatcher<boolean>()

	public get onIsDetectedChanged(): IEvent<boolean> { return this._onIsDetectedChanged }

	public start(): void {
		console.log('FakePresenceDetector: Start detecting presence.')
	}
	public stop(): void {
		console.log('FakePresenceDetector: Stop detecting presence.')
	}
	public addMotionScore(motionScore: number, receivedOnDate: Date): void {
		console.log('FakePresenceDetector: Added motion score ' + motionScore)
	}
	public get isDetected() {
		return this._isDetected
	}
	public set isDetected(isDetected: boolean) {
		if (isDetected === this._isDetected) { return }
		this._isDetected = isDetected
		this._onIsDetectedChanged.dispatch(isDetected)
	}
}

export interface ISpeechOpts {
	voiceURI?: string
	lang?: string
	rate?: number
	pitch?: number
}

export interface ISpeech {
	speak(text: string, opts?: ISpeechOpts): void
}

class FakeSpeech implements ISpeech {
	public speak(text: string, opts?: ISpeechOpts) {
		console.log('FakeSpeech: speaking: ' + text)
	}
}

/**
 * Handles configuring video source to stream to a <video> HTML element
 * and has actions for starting/stopping video stream.
 */
export interface IVideoService {
	/**
	 * Gets an URL encoded string of the current image data.
	 */
	getCurrentImageDataUrl(): string
	/**
	 * Start streaming video.
	 */
	start(): void

	/**
	 * Stop streaming video. Will release the camera resource (webcam LED should no longer be lit).
	 */
	stop(): void
}

class FakeVideoService implements IVideoService {
	public getCurrentImageDataUrl() {
		return 'Fake image data URL'
	}
	public start(): void {
		console.log('FakeVideoService: Start video.')
	}
	public stop(): void {
		console.log('FakeVideoService: Stop video.')
	}
}

export interface IMicrosoftFaceApi {
	detectFacesAsync(imageDataUrl: string): Promise<DetectFacesResponse>
	getPersonAsync(personGroupId: AAGUID, personId: AAGUID): Promise<Person>
	identifyFacesAsync(faceIds: AAGUID[], personGroupId: AAGUID): Promise<IdentifyFacesResponse>
}

export class FakeMicrosoftFaceApi implements IMicrosoftFaceApi {
	constructor(
		public detectFacesAsyncResult: Promise<DetectFacesResponse> = FakeMicrosoftFaceApi.defaultDetectFacesAsyncResult) {
	}

	public getPersonAsync(personGroupId: AAGUID, personId: AAGUID): Promise<Person> {
		const result: Person = {
			name: 'Fake person name',
			persistedFaceIds: ['face face id'],
			personId: 'fake person id',
			userData: 'fake person userdata',
		}
		return Promise.resolve(result)
	}

	public detectFacesAsync(imageDataUrl: string): Promise<DetectFacesResponse> {
		return this.detectFacesAsyncResult
	}

	public identifyFacesAsync(faceIds: string[], personGroupId: string): Promise<IdentifyFacesResponse> {
		const result: IdentifyFacesResponse = faceIds.map((faceId, i) => ({
			candidates: [
				{
					confidence: 0.8,
					personId: 'fake person id for face ' + faceId,
				},
			],
			faceId,
		}))
		return Promise.resolve(result)
	}

	private static get defaultDetectFacesAsyncResult(): Promise<DetectFacesResponse> {
		const result: DetectFacesResponse = [
			{
				faceAttributes: {
					age: 35,
					gender: 'male',
				},
				faceId: 'fake face id',
			} as any,
		]
		return Promise.resolve(result)
	}

}

export interface ICommentProvider {
	getComments(identifyFacesResponse: IdentifyFacesResponse): string[]
}

class FakeCommentProvider implements ICommentProvider {
	public getComments(identifyFacesResponse: IdentifyFacesResponse): string[] {
		return identifyFacesResponse.map((x, i) => 'Fake joke #' + i)
	}
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
	periodicFaceDetectorIntervalMs?: number
	presenceDetector?: IPresenceDetector
	speech?: ISpeech
	faceApi?: IMicrosoftFaceApi
	commentProvider?: ICommentProvider
	personGroupId?: AAGUID
}

function isDefined<T>(myParam: T, msg: string): T {
	if (myParam === undefined) {
		throw new Error(`Parameter ${myParam} was undefined.`)
	}
	return myParam
}

// To avoid filling out entire object for the sake of a test
// tslint:disable-next-line:no-object-literal-type-assertion
const fakeFace = {
	faceAttributes: { gender: 'male', age: 40 },
	faceId: 'fake face id',
} as DetectFaceResult

export class Commentator {
	public set onTransition(value: (lifecycle: Lifecycle, ...args: any[]) => void) {
		this._fsm.observe('onTransition', value)
	}

	private _periodicFaceDetectorIntervalMs: number
	private _periodicFaceDetector: IPeriodicFaceDetector
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
		periodicFaceDetectorIntervalMs = 4000,
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

		this._periodicFaceDetector = periodicFaceDetector ||
			new PeriodicFaceDetector(periodicFaceDetectorIntervalMs, () => Promise.resolve([fakeFace]))

		this._periodicFaceDetectorIntervalMs = periodicFaceDetectorIntervalMs

		this._doDeliverComments = this._doDeliverComments.bind(this)
		this._doDetectFacesAsync = this._doDetectFacesAsync.bind(this)
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
				{ from: 'detectFaces', name    : 'presenceDetected',   to: 'detectFaces' },
				{ from: 'identifyFaces', name  : 'facesIdentified', to   : 'deliverComments' },
				{ from: 'identifyFaces', name  : 'presenceDetected',   to: 'identifyFaces' },
				{ from: 'identifyFaces', name  : 'noPresenceDetected', to: 'detectPresence' },
				{ from: 'deliverComments', name: 'commentsDelivered', to : 'detectFaces' },
				{ from: 'deliverComments', name: 'presenceDetected',   to: 'detectPresence' },
				{ from: 'deliverComments', name: 'noPresenceDetected', to: 'detectPresence' },
			],
		}

		const fsm: MyStateMachine = (new StateMachine(config))!
		this._fsm = fsm

		presenceDetector.onIsDetectedChanged.subscribe((detected: boolean) => {
			if (detected) {
				fsm.presenceDetected()
			} else {
				fsm.noPresenceDetected()
			}
		})

		fsm.observe({
			// States
			onDeliverComments: this._doDeliverComments,
			onDetectFaces: this._doDetectFacesAsync,
			onDetectPresence: this._doDetectPresence,
			onIdentifyFaces: this._doIdentifyFacesAsync,
			onIdle: this._doIdle,
			// onEnterdetectPresence: () => console.log('!onDetectPresence!!'), // (lifecycle: Lifecycle) => this._doDetectPresence(lifecycle),
			// onEnterState: (lifecycle: Lifecycle) => { console.log('OnEnterState: ' + lifecycle.transition)},
			// onAfterTransition: () => console.log('AFTER TRANSITION'),
			onTransition: (lifecycle: Lifecycle, ...args: any[]) => {
				console.log(`onTransition: ${lifecycle.transition} from ${lifecycle.from} to ${lifecycle.to}`)
			},
		})

		// fsm.observe('onIdle', this._doIdle)
		// fsm.observe('onDetectPresence', this._doDetectPresence)
		// fsm.observe('onDetectFaces', this._doDetectFacesAsync)
		// fsm.observe('onIdentifyFaces', this._doIdentifyFacesAsync)
		// fsm.observe('onDeliverComments', this._doDeliverComments)

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

	private async _doDetectFacesAsync(lifecycle: Lifecycle) {
		console.log('doDetectFaces')
		const imageDataUrl = this._videoService.getCurrentImageDataUrl()
		try {
			const result = await this._faceApi.detectFacesAsync(imageDataUrl)
			if (result && result.length > 0) {
				console.info(`Detected ${result.length} faces.`)
				this._fsm.facesDetected(result)
			} else {
				console.debug('Did not detect any faces.')
			}
		} catch (err) {
			console.error('Failed to detect faces.', err)
		}
		this._periodicFaceDetector.start(this._periodicFaceDetectorIntervalMs, () => {
			return this._videoService.getCurrentImageDataUrl()
		})
	}

	private async _doIdentifyFacesAsync(lifecycle: Lifecycle, input: IdentifyFacesInput) {
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

}

export default Commentator
