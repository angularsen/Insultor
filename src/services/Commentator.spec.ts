import {} from 'jasmine'
// import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
// import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
// import Person from '../../docs/FaceAPI/Person'
import { Commentator, IPeriodicFaceDetector, IPresenceDetector, IVideoService, State } from './Commentator'
import MyJasmineReporter from './MyJasmineReporter'

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires

jasmine.getEnv().addReporter(MyJasmineReporter.create())

const mockPresenceDetector: () => IPresenceDetector = () => jasmine.createSpyObj('presenceDetector', { start: 0, stop: 0 })
const mockVideoService: () => IVideoService = () => jasmine.createSpyObj('videoStreamer', { start: 0, stop: 0 })
const mockPeriodicFaceDetector: () => IPeriodicFaceDetector = () => jasmine.createSpyObj('periodicFaceDetector', { start: 0, stop: 0 })

const getMocks = () => ({
	periodicFaceDetector: mockPeriodicFaceDetector(),
	presenceDetector: mockPresenceDetector(),
	videoService: mockVideoService(),
})

describe('Commentator', () => {
	it('Defaults to Idle state.', () => {
			expect(new Commentator({}).state).toBe(State.idle)
	})

	it('Start while idle starts streaming video and detecting presence', () => {
		const { presenceDetector, videoService } = getMocks()
		const sm = new Commentator({
			init: 'idle',
			presenceDetector,
			videoService,
		})
		sm.start()
		expect(sm.state).toBe(State.detectPresence)
		expect(presenceDetector.start).toHaveBeenCalled()
		expect(videoService.start).toHaveBeenCalled()
	})

	it('Start is ignored if not idle', () => {

		const { presenceDetector, videoService } = getMocks()
		const startStates: State[] = ['detectFaces', 'detectPresence', 'identifyFaces', 'deliverComments']

		for (const init of startStates) {
			console.log('With start state: ' + init)
			const sm = new Commentator({
				init,
				presenceDetector,
			})

			let gotTransition = false
			sm.onTransition = (lifecycle) => {
				gotTransition = true
			}

			expect(() => sm.start()).toThrow()

			expect(sm.state).toEqual(init, 'State did not change')
			expect(gotTransition).toEqual(false, 'No transition happened')
		}
	})

	it('Periodically detects faces while presence is detected', () => {
		const clock = jasmine.clock()
		clock.install()
		const { periodicFaceDetector } = getMocks()
		const sm = new Commentator({
			init: 'detectFaces',
			periodicFaceDetector,
			periodicFaceDetectorIntervalMs: 4000,
		})

		clock.tick(4000)

		expect(periodicFaceDetector.).cal
		// expect(sm.state).toBe(State.detectPresence)
		// expect(presenceDetector.start).toHaveBeenCalled()
		fail('todo')
		clock.uninstall()
	})

	it('Stops detecting faces if presence is no longer detected', () => {
		fail('todo')
	})

	it('Identifies detected faces while actively detecting faces', () => {
		fail('todo')
	})

	it('Identifies any faces detected while identifying or commenting on previous faces when starting to detect faces', () => {
		fail('todo')
	})

	it('Delivers personal comments to identified persons', () => {
		fail('todo')
	})

	it('Delivers comments based on face attributes to unidentified faces', () => {
		fail('todo')
	})

	it('Stores faceId and imageDataUrl for unidentified faces in memory', () => {
		fail('todo')
	})

})
