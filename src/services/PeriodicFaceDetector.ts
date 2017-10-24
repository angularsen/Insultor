import * as moment from 'moment'
type Moment = moment.Moment

import { DetectFaceResult } from '../../docs/FaceAPI/DetectFacesResponse'
import { EventDispatcher, IEvent } from './utils/Events'

export interface IPeriodicFaceDetector {
	readonly faceDetected: IEvent<DetectFaceResult[]>
	/**
	 * Start periodic face detection.
	 * @param minIntervalMs Minimum interval between each face detection request,
	 * but will not run until the previous request has completed to avoid concurrently queueing up requests.
	 * @param getCurrentImageDataUrl Callback method to provide the data URL encoded image for the current video image.
	 */
	start(minIntervalMs: number, getCurrentImageDataUrl: () => string): void
	stop(): void
}

export class PeriodicFaceDetector implements IPeriodicFaceDetector {
	private _faceDetected = new EventDispatcher<DetectFaceResult[]>()
	private _intervalHandle: NodeJS.Timer

	public get faceDetected(): IEvent<DetectFaceResult[]> { return this._faceDetected }

	constructor(private _intervalMs: number, private _detectFacesAsync: () => Promise<DetectFaceResult[]>) {
		if (_intervalMs === undefined || _intervalMs <= 0) {
			throw new Error('intervalMs must be a positive number, was: ' + _intervalMs)
		}
		if (!_detectFacesAsync) {
			throw new Error('_detectFacesAsync must be a function, was: ' + _detectFacesAsync)
		}
	}

	public start(intervalMs: number): void {
		console.info(`FakePeriodicFaceDetector: Start detecting every ${intervalMs} ms.`)
		this._onPeriodicDetectAsync()
	}

	public stop(): void {
		console.info(`FakePeriodicFaceDetector: Stopping.`)
		clearInterval(this._intervalHandle)
	}

	private async _onPeriodicDetectAsync() {
		const detectStart = moment()
		console.info(`FakePeriodicFaceDetector: Detecting faces...`)
		const detectFacesResult = await this._detectFacesAsync()

		if (detectFacesResult.length > 0) {
			console.info(`FakePeriodicFaceDetectorDetected ${detectFacesResult.length} faces.`)
			this._faceDetected.dispatch(detectFacesResult)
		} else {
			console.debug(`FakePeriodicFaceDetectorNo faces detected.`)
		}

		const durationMs =  moment().diff(detectStart)
		const timeToWaitMs = Math.max(0, this._intervalMs - durationMs)
		console.debug(`FakePeriodicFaceDetectorLast request took ${durationMs} ms, waiting ${timeToWaitMs} ms until next time.`)

		this._intervalHandle = setTimeout(this._onPeriodicDetectAsync, timeToWaitMs)
	}
}
