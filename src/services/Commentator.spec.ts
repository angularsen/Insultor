import {} from 'jasmine'
// import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
// import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
// import Person from '../../docs/FaceAPI/Person'
import { Commentator, IPresenceDetector, IVideoService, State } from './Commentator'
import MyJasmineReporter from './MyJasmineReporter'

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires

jasmine.getEnv().addReporter(MyJasmineReporter.create())

const mockPresenceDetector: () => IPresenceDetector = () => jasmine.createSpyObj('presenceDetector', { start: 0, stop: 0 })
const mockVideoService: () => IVideoService = () => jasmine.createSpyObj('videoStreamer', { start: 0, stop: 0 })

const getMocks = () => ({
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
		// const { presenceDetector, videoService } = getMocks()
		// const sm = new Commentator({
		// 	init: 'idle',
		// 	presenceDetector,
		// })
		// sm.start()
		// expect(sm.state).toBe(State.detectPresence)
		// expect(presenceDetector.start).toHaveBeenCalled()
	})

	it('Stops detecting faces if presence is no longer detected', () => {
		// todo
	})

	it('Identifies detected faces', () => {
		// todo
	})

	it('If presence is already detected when begin detect presence  Ignore if presence is no longer detected while detecting presence, identifying faces or delivering comments', () => {
		// todo
	})

})
