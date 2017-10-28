import {} from 'jasmine'

import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
const jasmineReporters = require('jasmine-reporters')

import {
	Commentator,
	State,
} from './Commentator'

import { FakeMicrosoftFaceApi } from './fakes/FakeMicrosoftFaceApi'
import { FakePresenceDetector } from './fakes/FakePresenceDetector'
import { IPeriodicFaceDetector } from './PeriodicFaceDetector'
import { IPresenceDetector } from './PresenceDetector'
import { IVideoService } from './VideoService'

jasmine.getEnv().addReporter(new jasmineReporters.TerminalReporter({
	color: true,
	showStack: true,
	verbosity: 3,
}))

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires

const mockPresenceDetector: () => IPresenceDetector = () => jasmine.createSpyObj('presenceDetector', { start: 0, stop: 0 })
const mockVideoService: () => IVideoService = () => jasmine.createSpyObj('videoStreamer', { start: 0, stop: 0 })
const mockPeriodicFaceDetector: () => IPeriodicFaceDetector = () => jasmine.createSpyObj('periodicFaceDetector', { start: 0, stop: 0 })
// const mockFaceApi: () => IMicrosoftFaceApi = () => jasmine.createSpyObj('faceApi', {
// 	detectFacesAsync: Promise<DetectFacesResponse>.resolve({})
// 	getPersonAsync(personGroupId: AAGUID, personId: AAGUID): Promise<Person>
// 	identifyFacesAsync(faceIds: AAGUID[], personGroupId: AAGUID): Promise<IdentifyFacesResponse>

// })

const getMocks = () => ({
	periodicFaceDetectorMock: mockPeriodicFaceDetector(),
	presenceDetectorMock: mockPresenceDetector(),
	videoServiceMock: mockVideoService(),
	// faceApiMock: mockFaceApi()
})

describe('Commentator', () => {
	beforeEach((done) => {
		try {
			done()
		} catch (err) {
			console.log('Whoooah', err)
		}
	})

	it('Defaults to Idle state.', () => {
			expect(new Commentator({}).state).toBe(State.idle)
	})

	it('Start while idle starts streaming video and detecting presence', () => {
		const { videoServiceMock } = getMocks()
		const fakePresenceDetector = new FakePresenceDetector()
		spyOn(fakePresenceDetector, 'start')
		const sm = new Commentator({
			init: 'idle',
			presenceDetector: fakePresenceDetector,
			videoService: videoServiceMock,
		})
		sm.start()
		expect(sm.state).toBe(State.detectPresence)
		expect(fakePresenceDetector.start).toHaveBeenCalled()
		expect(videoServiceMock.start).toHaveBeenCalled()
	})

	it('Start is ignored while not idle', () => {

		const { presenceDetectorMock, videoServiceMock } = getMocks()
		const startStates: State[] = ['detectFaces', 'detectPresence', 'identifyFaces', 'deliverComments']
		const fakePresenceDetector = new FakePresenceDetector()

		for (const startState of startStates) {
			console.log('With start state: ' + startState)
			const sm = new Commentator({
				init: startState,
				presenceDetector: fakePresenceDetector,
			})

			let gotTransition = false
			sm.onTransition = (lifecycle) => {
				gotTransition = true
			}

			expect(() => sm.start()).toThrow()

			expect(sm.state).toEqual(startState, 'State should not change')
			expect(gotTransition).toEqual(false, 'No transition should happen')
		}
	})

	it('Periodically detects faces while presence is detected', () => {
		const clock = jasmine.clock()
		clock.install()
		try {
			// TODO Hang the identify call so state machine doesn't progress automatically detect-identify-comment

			const fakePresenceDetector = new FakePresenceDetector()

			const fakeFaceId = 'fake face ID'
			// Don't detect any faces or the state machine may transition to identifyFaces
			const noFacesDetectedResult:DetectFacesResponse = [] // Promise.resolve<DetectFacesResponse>([])
			const singleFaceDetectedResult: DetectFacesResponse = /*Promise.resolve<DetectFacesResponse>(*/[{faceId: fakeFaceId} as DetectFaceResult]//)

			const fakeFaceApi = new FakeMicrosoftFaceApi(Promise.resolve(noFacesDetectedResult))
			spyOn(fakeFaceApi, 'detectFacesAsync')

			const expectDetectFacesCallCount = (num: number) => {
				expect(fakeFaceApi.detectFacesAsync).toHaveBeenCalledTimes(num)
			}

			const FaceDetectInterval = 4000
			const sm = new Commentator({
				faceApi: fakeFaceApi,
				init: 'idle',
				periodicFaceDetectorIntervalMs: FaceDetectInterval,
				presenceDetector: fakePresenceDetector,
			})

			sm.start()
			expect(sm.state).toEqual(State.detectPresence)

			// No initial calls
			expectDetectFacesCallCount(0)

			// Do not call while no presence
			clock.tick(2 * FaceDetectInterval)
			expectDetectFacesCallCount(0)

			// Immediately call upon presence
			sm.presenceDetected()
			expect(sm.state).toEqual(State.detectFaces)
			expectDetectFacesCallCount(1)

			// Detect faces every interval
			clock.tick(4 * FaceDetectInterval)
			expectDetectFacesCallCount(5)

			// Transition to identify faces
			sm.facesDetected(singleFaceDetectedResult)
			expect(sm.state).toEqual(State.identifyFaces)

			// Keep detecting faces while identifying previous faces
			clock.tick(2 * FaceDetectInterval)
			expectDetectFacesCallCount(7)

			sm.facesIdentified([{ faceId: fakeFaceId, candidates: [{ personId: 'fake person ID', confidence: 0.7 }] }])
			expect(sm.state).toEqual(State.deliverComments)

			// Keep detecting faces while delivering comments
			clock.tick(1 * FaceDetectInterval)
			expectDetectFacesCallCount(8)

			expect(sm.state).toEqual(State.detectPresence)

			// Keep detecting faces while detecting presence
			clock.tick(2 * FaceDetectInterval)
			expectDetectFacesCallCount(9)

		} catch (err) {
			console.error('Error received', err)
			throw err.message || err
		} finally {
			clock.uninstall()
		}
	})

	// it('Stops detecting faces if presence is no longer detected', () => {
	// 	fail('todo')
	// })

	// it('Identifies detected faces while actively detecting faces', () => {
	// 	fail('todo')
	// })

	// it('Identifies any faces detected while identifying or commenting on previous faces when starting to detect faces', () => {
	// 	fail('todo')
	// })

	// it('Delivers personal comments to identified persons', () => {
	// 	fail('todo')
	// })

	// it('Delivers comments based on face attributes to unidentified faces', () => {
	// 	fail('todo')
	// })

	// it('Stores faceId and imageDataUrl for unidentified faces in memory', () => {
	// 	fail('todo')
	// })

})
