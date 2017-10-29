import {} from 'jasmine'

import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
const jasmineReporters = require('jasmine-reporters')

import {
	Commentator,
	State,
} from './Commentator'

import { FakeMicrosoftFaceApi } from './fakes/FakeMicrosoftFaceApi'
import { FakePeriodicFaceDetector } from './fakes/FakePeriodicFaceDetector'
import { FakePresenceDetector } from './fakes/FakePresenceDetector'
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

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires

const mockPresenceDetector: () => IPresenceDetector = () => jasmine.createSpyObj('presenceDetector', { start: 0, stop: 0 })
const mockVideoService: () => IVideoService = () => jasmine.createSpyObj('videoStreamer', { start: 0, stop: 0 })
const mockFaceDetector: () => IPeriodicFaceDetector = () => jasmine.createSpyObj('faceDetector', { start: 0, stop: 0 })

const getMocks = () => ({
	presenceDetectorMock: mockPresenceDetector(),
	videoServiceMock: mockVideoService(),
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

	it('Starts periodic face detector on presence detected', () => {
		try {
			const fakePresenceDetector = new FakePresenceDetector()

			// const fakeFaceId = 'fake face ID'
			// const singleFaceDetectedResult: DetectFacesResponse = [{ faceId: fakeFaceId }] as DetectFacesResponse
			// const fakeFaceApi = new FakeMicrosoftFaceApi(Promise.resolve(singleFaceDetectedResult))

			const fakePeriodicFaceDetector = new FakePeriodicFaceDetector()
			spyOn(fakePeriodicFaceDetector, 'start')

			const comm = new Commentator({
				// faceApi: fakeFaceApi,
				faceDetector: fakePeriodicFaceDetector,
				init: 'idle',
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
				init: 'detectFaces',
				presenceDetector: fakePresenceDetector,
				faceDetector: fakePeriodicFaceDetector,
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

	it('Completes a full state cycle from idle to deliver comments back to idle', () => {
		try {
			const fakePresenceDetector = new FakePresenceDetector()
			fakePresenceDetector.isDetected = false

			const fakePeriodicFaceDetector = new FakePeriodicFaceDetector()
			spyOn(fakePeriodicFaceDetector, 'stop')

			const comm = new Commentator({
				init: 'idle',
				presenceDetector: fakePresenceDetector,
				faceDetector: fakePeriodicFaceDetector,
				videoService: mockVideoService(),
			})

			comm.start()
			expect(comm.state).toEqual(State.detectPresence)

			fakePresenceDetector.isDetected = true
			expect(comm.state).toEqual(State.detectFaces)

			expect(fakePeriodicFaceDetector.stop).toHaveBeenCalledTimes(0)
			fakePresenceDetector.isDetected = false
			expect(comm.state).toEqual(State.detectPresence)

			throw new Error('TODO Implement full cycle')
		} catch (err) {
			console.error('Error received', err.stack)
			throw err
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
