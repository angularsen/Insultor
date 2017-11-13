import { DetectFaceResult, DetectFacesResponse } from '../../../docs/FaceAPI/DetectFacesResponse'
import { DetectedFaceWithImageData, IPeriodicFaceDetector } from '../PeriodicFaceDetector'
import { EventDispatcher, IEvent } from '../utils/Events'

export class FakePeriodicFaceDetector implements IPeriodicFaceDetector {
	public readonly facesDetectedDispatcher = new EventDispatcher<DetectedFaceWithImageData[]>()

	public get facesDetected(): IEvent<DetectedFaceWithImageData[]> { return this.facesDetectedDispatcher }

	public start(): void {
		console.log('FakePeriodicFaceDetector: start()')
	}
	public stop(): void {
		console.log('FakePeriodicFaceDetector: stop()')
	}
}
