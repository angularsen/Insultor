import {} from 'jasmine'
// import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
// import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
// import Person from '../../docs/FaceAPI/Person'
import { Commentator, State } from './Commentator'

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires

describe('Commentator', () => {
	it('Defaults to Idle state.', () => {
			expect(new Commentator({}).state).toBe(State.Idle)
	})

	it('When Idle, `start` should start streaming video and detecting presence', () => {
		const mockedPresenceDetector = jasmine.createSpyObj('presenceDetector', {start: 0 })
		const mockedVideoService = jasmine.createSpyObj('videoStreamer', {start: 0 })
		const sm = new Commentator({
			init: 'Idle',
			presenceDetector: mockedPresenceDetector,
			videoService: mockedVideoService,
		})
		sm.start()
		expect(sm.state).toBe(State.DetectPresence)
		expect(mockedPresenceDetector.start).toHaveBeenCalled()
		expect(mockedVideoService.start).toHaveBeenCalled()
	})

	it('When not Idle, `start` should do nothing', () => {
		const mockedPresenceDetector = jasmine.createSpyObj('presenceDetector', {start: 0 })

		const startStates: State[] = ['DetectFaces', 'DetectPresence', 'IdentifyFaces', 'DeliverComments']
		for (const init of startStates) {
			const sm = new Commentator({
				init,
				presenceDetector: mockedPresenceDetector,
			})

			sm.onTransition = (lifecycle) => {
				fail('Did not expect any transition: ' + lifecycle.transition)
			}

			sm.start()
		}
	})

	it('When in `Idle`, action `Start` transitions to `DetectPresence`', () => {
		const mockedPresenceDetector = jasmine.createSpyObj('presenceDetector', {start: 0 })
		const sm = new Commentator({
			init: 'Idle',
			presenceDetector: mockedPresenceDetector,
		})
		sm.start()
		expect(sm.state).toBe(State.DetectPresence)
		expect(mockedPresenceDetector.start).toHaveBeenCalled()
	})
})
