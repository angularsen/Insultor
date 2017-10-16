import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
import Person from '../../docs/FaceAPI/Person'

function timeout(ms: number) { return new Promise<void>((res) => setTimeout(res, ms)) }

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
	'Idle',
	'DetectPresence',
	'DetectFaces',
	'IdentifyFaces',
	'DeliverComments',
])
export type State = keyof typeof State

type MyStateMachineEvent = (...args: any[]) => void

interface MyStateMachine {
	state: State
	start?: MyStateMachineEvent
	stop?: MyStateMachineEvent
	presenceDetected?: MyStateMachineEvent
	noPresenceDetected?: MyStateMachineEvent
	facesDetected?: (detectFacesResult: DetectFacesResponse) => void
	facesIdentified?: (identifyFacesResult: IdentifyFacesResponse) => void
	commentsDelivered?: MyStateMachineEvent
	onTransition: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
	onStart: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
	onStop: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
	onIdle: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
	onDetectPresence: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
	onDetectFaces: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
	onLeaveDetectFaces: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
	onIdentifyFaces: (lifecycle: Lifecycle, from: State, to: State, detectFacesResult: DetectFacesResponse) => void
	onDeliverComments: (lifecycle: Lifecycle, from: State, to: State, ...args: any[]) => void
}

interface MyConfig {
	init?: State | { state: State, event: Action, defer: boolean }
	transitions?: MyStateMachineEventDef[]
	callbacks?: {
		[s: string]: (event?: Action, from?: State, to?: State, ...args: any[]) => any;
	}
}

interface MyStateMachineEventDef {
	name: Action
	from: '*' | State | State[]
	to: State
}

interface IPresenceDetector {
	onDetectedChanged?: (detected: boolean) => void
	addMotionScore(motionScore: number, receivedOnDate: Date): void
	start(): void
	stop(): void
}

class FakePresenceDetector implements IPresenceDetector {
	public onDetectedChanged: (detected: boolean) => void
	public start(): void {
		console.log('FakePresenceDetector: Start.')
	}
	public stop(): void {
		console.log('FakePresenceDetector: Stop.')
	}
	public addMotionScore(motionScore: number, receivedOnDate: Date): void {
		console.log('FakePresenceDetector: Added motion score ' + motionScore)
	}
}

interface ISpeechOpts {
	voiceURI?: string
	lang?: string
	rate?: number
	pitch?: number
}

interface ISpeech {
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
interface IVideoService {
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
		console.log('FakeVideoService: start video')
	}
	public stop(): void {
		console.log('FakeVideoService: stop video')
	}
}

interface IMicrosoftFaceApi {
	detectFacesAsync(imageDataUrl: string): DetectFacesResponse
	getPersonAsync(personGroupId: AAGUID, personId: AAGUID): Person
	identifyFacesAsync(faceIds: AAGUID[], personGroupId: AAGUID): IdentifyFacesResponse
}

class FakeMicrosoftFaceApi implements IMicrosoftFaceApi {
	public getPersonAsync(personGroupId: AAGUID, personId: AAGUID): Person {
		return {
			name: 'Fake person name',
			persistedFaceIds: ['face face id'],
			personId: 'fake person id',
			userData: 'fake person userdata',
		}
	}

	public detectFacesAsync(imageDataUrl: string): DetectFacesResponse {
		return [
			{
				faceAttributes: {
					age: 35,
					gender: 'male',
				},
				faceId: 'fake face id',
			} as any,
		]
	}

	public identifyFacesAsync(faceIds: string[], personGroupId: string): IdentifyFacesResponse {
		return faceIds.map((faceId, i) => {
			return {
				candidates: [
					{
						confidence: 0.8,
						personId: 'fake person id for face ' + faceId,
					},
				],
				faceId,
			}
		})
	}
}

interface ICommentProvider {
	getComments(identifyFacesResponse: IdentifyFacesResponse): string[]
}

class FakeCommentProvider implements ICommentProvider {
	public getComments(identifyFacesResponse: IdentifyFacesResponse): string[] {
		return identifyFacesResponse.map((x, i) => 'Fake joke #' + i)
	}
}

interface Lifecycle {
	transition: string
	from: State
	to: State
}

interface CommentatorOptions {
	init?: State
	videoService?: IVideoService
	presenceDetector?: IPresenceDetector
	speech?: ISpeech
	faceApi?: IMicrosoftFaceApi
	commentProvider?: ICommentProvider
	personGroupId?: AAGUID
}

export class Commentator {
	set onTransition(callback: (lifecycle: Lifecycle, ...args: any[]) => void) {
		this._fsm.onTransition = callback;
	}

	private _fsm: MyStateMachine

	constructor({
		commentProvider = new FakeCommentProvider(),
		faceApi = new FakeMicrosoftFaceApi(),
		init = 'Idle',
		presenceDetector = new FakePresenceDetector(),
		speech = new FakeSpeech(),
		videoService = new FakeVideoService(),
		personGroupId,
	}: CommentatorOptions = {}) {

		const config: MyConfig = {
			init,
			transitions: [
				{ from: '*', name              : 'stop', to              : 'Idle' },
				{ from: 'Idle', name           : 'start', to             : 'DetectPresence' },
				{ from: 'DetectPresence', name : 'presenceDetected', to  : 'DetectFaces' },
				{ from: 'DetectFaces', name    : 'facesDetected', to     : 'IdentifyFaces' },
				{ from: 'DetectFaces', name    : 'noPresenceDetected', to: 'DetectPresence' },
				{ from: 'IdentifyFaces', name  : 'facesIdentified', to   : 'DeliverComments' },
				{ from: 'IdentifyFaces', name  : 'noPresenceDetected', to: 'DetectPresence' },
				{ from: 'DeliverComments', name: 'commentsDelivered', to : 'DetectFaces' },
				{ from: 'DeliverComments', name: 'noPresenceDetected', to: 'DetectPresence' },
			],
		}

		const fsm = new StateMachine(config) as MyStateMachine
		this._fsm = fsm

		presenceDetector.onDetectedChanged = (detected: boolean) => {
			if (detected) {
				fsm.presenceDetected()
			} else {
				fsm.noPresenceDetected()
			}
		}

		fsm.onTransition = (lifecycle: Lifecycle, ...args: any[]) => {
			console.log(`onTransition: ${lifecycle.transition} from ${lifecycle.from} to ${lifecycle.to}`)
		}

		fsm.onIdle = () => {
			presenceDetector.stop()
			videoService.stop()
		}

		fsm.onDetectPresence = () => {
			videoService.start()
			presenceDetector.start()
		}

		const detectFacesFromCurrentVideoImageAsync = async (): Promise<any> => {
			console.debug('detectFacesFromCurrentVideoImageAsync')
			const imageDataUrl = videoService.getCurrentImageDataUrl()
			const detectFacesResult = await faceApi.detectFacesAsync(imageDataUrl)
			if (detectFacesResult.length) {
				fsm.facesDetected(detectFacesResult)
			}
		}

		fsm.onDetectFaces = async (): Promise<any> => {
			while (fsm.state === 'DetectFaces') {
				await detectFacesFromCurrentVideoImageAsync()
				await timeout(4000)
			}
		}

		fsm.onIdentifyFaces = async (
			lifecycle: Lifecycle, 
			from: State, 
			to: State,
			detectFacesResult: DetectFacesResponse): Promise<any> => {

			const faceIds = detectFacesResult.map((x) => x.faceId)
			const identifyFacesResult = await faceApi.identifyFacesAsync(faceIds, personGroupId)
			const MIN_CONFIDENCE = 0.5

			const identifiedPersons = await Promise.all(identifyFacesResult
				.filter(face => face.candidates.filter(x => x.confidence >= MIN_CONFIDENCE).length > 0)
				.map(face => faceApi.getPersonAsync(personGroupId, face.candidates[0].personId)))

			const unrecognizedFaces = identifyFacesResult
				.filter(face => face.candidates.filter(x => x.confidence >= MIN_CONFIDENCE).length === 0)

			if (identifiedPersons.length) {
				console.log(`Identified ${identifiedPersons.length} persons.`)
				console.warn('TODO Add unrecognized face to person group. Skipping for now...')
			}
		}

		fsm.onDeliverComments = (
			lifecycle: Lifecycle, from: State, to: State,
			identifyFacesResult: IdentifyFacesResponse) => {

			const comments = identifyFacesResult.map((x, i) => 'TODO comment #' + i)
			for (const comment of comments) {
				speech.speak(comment)
			}
		}
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

	// Transition handlers
}

export default Commentator
