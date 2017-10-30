import { DetectFaceResult, DetectFacesResponse } from '../../../docs/FaceAPI/DetectFacesResponse'
import { IPeriodicFaceDetector } from '../PeriodicFaceDetector'
import { EventDispatcher, IEvent } from '../utils/Events'

export class FakePeriodicFaceDetector implements IPeriodicFaceDetector {
	public readonly facesDetectedDispatcher = new EventDispatcher<DetectFacesResponse>()

	public get facesDetected(): IEvent<DetectFacesResponse> { return this.facesDetectedDispatcher }

	public start(): void {
		console.log('FakePeriodicFaceDetector: start()')
	}
	public stop(): void {
		console.log('FakePeriodicFaceDetector: stop()')
	}
}
