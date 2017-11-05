import {} from 'jasmine'

import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
const jasmineReporters = require('jasmine-reporters')

import {
	Commentator,
	Lifecycle,
	State,
} from './Commentator'

import { FakeMicrosoftFaceApi } from './fakes/FakeMicrosoftFaceApi'
import { FakePeriodicFaceDetector } from './fakes/FakePeriodicFaceDetector'
import { FakePresenceDetector } from './fakes/FakePresenceDetector'
import { FakeVideoService } from './fakes/FakeVideoService'
import { IPeriodicFaceDetector } from './PeriodicFaceDetector'
import { IPresenceDetector } from './PresenceDetector'
import { IVideoService } from './VideoService'

jasmine.getEnv().addReporter(new jasmineReporters.TerminalReporter({
	color: true,
	showStack: true,
	verbosity: 3,
}))

function delayAsync(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function waitForCondition(name: string, checkCondition: () => boolean, intervalMs: number, timeoutMs: number): Promise<void> {
	let intervalHandle: NodeJS.Timer

	return new Promise((resolve, reject) => {
		const timeoutHandle = setTimeout(() => {
			reject(new Error('Timed out: ' + name))
			clearInterval(intervalHandle)
		}, timeoutMs)

		intervalHandle = setInterval(() => {
			if (checkCondition()) {
				resolve()
				clearTimeout(timeoutHandle)
			}
		}, intervalMs)
	})
}

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires

const mockPresenceDetector: () => IPresenceDetector = () => jasmine.createSpyObj('presenceDetector', { start: 0, stop: 0 })
const mockVideoService: () => IVideoService = () => jasmine.createSpyObj('videoStreamer', { start: 0, stop: 0 })
const mockFaceDetector: () => IPeriodicFaceDetector = () => jasmine.createSpyObj('faceDetector', { start: 0, stop: 0 })

const getMocks = () => ({
	presenceDetectorMock: mockPresenceDetector(),
	videoServiceMock: mockVideoService(),
})

const fakeFaceId = 'fake face ID'
const singleFaceDetectedResult: DetectFacesResponse = [{ faceId: fakeFaceId }] as DetectFacesResponse
const fakeOpts = () => ({
	faceApi: new FakeMicrosoftFaceApi(),
	presenceDetector: new FakePresenceDetector(),
	videoService: new FakeVideoService(),
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
			expect(new Commentator(fakeOpts()).state).toBe(State.idle)
	})

	it('Start while idle starts streaming video and detecting presence', () => {
		const { videoServiceMock } = getMocks()
		const fakePresenceDetector = new FakePresenceDetector()
		spyOn(fakePresenceDetector, 'start')
		const sm = new Commentator({
			...fakeOpts(),
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

		for (const startState of startStates) {
			console.log('With start state: ' + startState)
			const sm = new Commentator({
				...fakeOpts(),
				init: startState,
			})

			let gotTransition = false
			sm.onTransition.subscribe((lifecycle) => {
				gotTransition = true
			})

			expect(() => sm.start()).toThrow()

			expect(sm.state).toEqual(startState, 'State should not change')
			expect(gotTransition).toEqual(false, 'No transition should happen')
		}
	})

	it('Starts periodic face detector on presence detected', () => {
		try {
			const fakePresenceDetector = new FakePresenceDetector()
			const fakePeriodicFaceDetector = new FakePeriodicFaceDetector()
			spyOn(fakePeriodicFaceDetector, 'start')

			const comm = new Commentator({
				...fakeOpts(),
				faceDetector: fakePeriodicFaceDetector,
				presenceDetector: fakePresenceDetector,
				videoService: mockVideoService(),
			})

			console.log('TEST: Signal start..')
			comm.start()
			expect(comm.state).toEqual(State.detectPresence)

			console.log('TEST: Signal presence detected..')
			comm.presenceDetected()
			expect(comm.state).toEqual(State.detectFaces)

			expect(fakePeriodicFaceDetector.start).toHaveBeenCalledTimes(1)
		} catch (err) {
			console.error('Error received', err.stack)
			throw err
		}
	})

	it('Stops periodic face detector on presence not detected', () => {
		try {
			const fakePresenceDetector = new FakePresenceDetector()
			fakePresenceDetector.isDetected = true

			const fakePeriodicFaceDetector = new FakePeriodicFaceDetector()
			spyOn(fakePeriodicFaceDetector, 'stop')

			const comm = new Commentator({
				...fakeOpts(),
				faceDetector: fakePeriodicFaceDetector,
				init: 'detectFaces',
				presenceDetector: fakePresenceDetector,
				videoService: mockVideoService(),
			})

			expect(fakePeriodicFaceDetector.stop).toHaveBeenCalledTimes(0)
			fakePresenceDetector.isDetected = false
			expect(comm.state).toEqual(State.detectPresence)
			expect(fakePeriodicFaceDetector.stop).toHaveBeenCalledTimes(1)
		} catch (err) {
			console.error('Error received', err.stack)
			throw err
		}
	})

	it('Completes a full state cycle from idle to deliver comments and back to idle', async (done) => {
		try {
			const fakePresenceDetector = new FakePresenceDetector()
			const fakeFaceDetector = new FakePeriodicFaceDetector()

			const comm = new Commentator({
				faceApi: new FakeMicrosoftFaceApi(),
				faceDetector: fakeFaceDetector,
				init: 'idle',
				presenceDetector: fakePresenceDetector,
				videoService: mockVideoService(),
			})

			fakePresenceDetector.isDetected = false
			comm.start()
			fakePresenceDetector.isDetected = true

			const waitForDetectFaces: Promise<void> = comm.waitForState('detectFaces', 1000)
			fakeFaceDetector.facesDetectedDispatcher.dispatch(singleFaceDetectedResult)

			await waitForDetectFaces
			fakePresenceDetector.isDetected = false

			comm.stop()

			expect(comm.history).toEqual(
				['idle', 'detectPresence', 'detectFaces', 'identifyFaces', 'deliverComments', 'detectFaces', 'detectPresence', 'idle'])
		} catch (err) {
			console.error('Error received', err.stack || err)
			fail(err)
		} finally {
			done()
		}
	})

	it('Identifies any faces detected while identifying or commenting on previous faces when starting to detect faces', async (done) => {
		try {
			const fakePresenceDetector = new FakePresenceDetector()
			const fakeFaceDetector = new FakePeriodicFaceDetector()
			const fakeFaceApi = new FakeMicrosoftFaceApi()
			spyOn(fakeFaceApi, 'identifyFacesAsync').and.callThrough()

			const comm = new Commentator({
				faceApi: fakeFaceApi,
				faceDetector: fakeFaceDetector,
				init: 'idle',
				presenceDetector: fakePresenceDetector,
				videoService: mockVideoService(),
			})

			// Insert detected faces while in identiyFaces and deliverComments states
			const getDetectFaceResult = (faceId: string): DetectFaceResult => {
				// Intentionally only populate part of it
				// tslint:disable-next-line:no-object-literal-type-assertion
				return {
					faceId,
				} as DetectFaceResult
			}

			const [face1, face2, face3, face4] = [1, 2, 3, 4].map(id => getDetectFaceResult('fake face id ' + id))
			let deliverCommentsCount = 0
			const handleOnTransition = (lifecycle: Lifecycle) => {
				switch (lifecycle.from) {
					case 'identifyFaces': {
						if (deliverCommentsCount === 0) {
							// Add face just after identifying face1, but only during first cycle to avoid infinite loop
							console.log('TEST: Dispatch faces detected: #2 and #3')
							fakeFaceDetector.facesDetectedDispatcher.dispatch([face2, face3])
						}
						break
					}
					case 'deliverComments': {
						if (deliverCommentsCount === 0) {
							// Add face just after commenting on face1, but only during first cycle to avoid infinite loop
							console.log('TEST: Dispatch faces detected: #4')
							fakeFaceDetector.facesDetectedDispatcher.dispatch([face4])
						}
						deliverCommentsCount++
						break
					}
				}
			}
			comm.onTransition.subscribe(handleOnTransition)

			comm.start()
			fakePresenceDetector.isDetected = true

			const waitForDetectFaces: Promise<void> = comm.waitForState('detectFaces', 1000)

			// Raise face 1 detected
			fakeFaceDetector.facesDetectedDispatcher.dispatch([face1])

			await waitForCondition('deliverCommentsCount >== 2', () => deliverCommentsCount >= 2, 50, 1000)

			// Two full cycles should occur due to additional faces detected while identifying/commenting
			expect(comm.history).toEqual(
				['idle', 'detectPresence',
				'detectFaces', 'identifyFaces', 'deliverComments',
				'detectFaces', 'identifyFaces', 'deliverComments',
				'detectFaces'])
		} catch (err) {
			console.error('Error received', err.stack || err)
			fail(err)
		} finally {
			done()
		}
	})

	// it('Delivers personal comments to identified persons', () => {
	// 	fail('todo')
	// })

	// it('Delivers comments based on face attributes to unidentified faces', () => {
	// 	fail('todo')
	// })

	// it('Delivers only one comment per face', () => {
	// 	fail('todo')
	// })

	// it('Stores faceId and imageDataUrl for unidentified faces in memory', () => {
	// 	fail('todo')
	// })

})
