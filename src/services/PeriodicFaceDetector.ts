import * as moment from 'moment'
type Moment = moment.Moment

import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFaceResult, IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
import {isDefined } from './utils'
import { EventDispatcher, IEvent } from './utils/Events'
import { error } from './utils/format';

export interface IPeriodicFaceDetector {
	readonly facesDetected: IEvent<DetectFacesResponse>
	/**
	 * Start periodic face detection.
	 * @param intervalMs Minimum interval between each face detection request,
	 * but will not run until the previous request has completed to avoid concurrently queueing up requests.
	 * @param getCurrentImageDataUrl Callback method to provide the data URL encoded image for the current video image.
	 */
	start(): void
	stop(): void
}

export class PeriodicFaceDetector implements IPeriodicFaceDetector {
	public get facesDetected(): IEvent<DetectFacesResponse> { return this._faceDetected }

	private _isRunning: boolean;
	private _faceDetected = new EventDispatcher<DetectFacesResponse>()
	private _timeoutHandle?: NodeJS.Timer


	constructor(
		private _intervalMs: number,
		private _detectFacesAsync: () => Promise<DetectFacesResponse>,
	) {
		isDefined(_intervalMs, '_intervalMs')
		isDefined(_detectFacesAsync, '_detectFacesAsync')

		if (_intervalMs < 0) {
			throw new Error('Interval must be a positive number, was: ' + _intervalMs)
		}
	}

	public start(): void {
		if (this._isRunning) { throw new Error('Already running.') }
		this._isRunning = true

		const intervalMs = this._intervalMs
		console.info(`FakePeriodicFaceDetector: Start detecting every ${intervalMs} ms.`)
		this._onDetectFacesAsync(intervalMs)
	}

	public stop(): void {
		if (!this._isRunning) { throw new Error('Already stopped.') }
		this._isRunning = false

		console.info(`FakePeriodicFaceDetector: Stopping.`)
		if (this._timeoutHandle) {
			clearTimeout(this._timeoutHandle)
			this._timeoutHandle = undefined
		}
	}

	private async _onDetectFacesAsync(intervalMs: number): Promise<any> {
		if (!this._isRunning) { 
			console.info('PeriodicFaceDetector: Already stopped, returning early.')
			return 
		}

		try {
			const detectStart = moment()
			console.info(`FakePeriodicFaceDetector: Detecting faces...`)
			const detectFacesResult = await this._detectFacesAsync()

			if (!this._isRunning) {
				console.info('PeriodicFaceDetector: Stopped while waiting for detect faces.')
				return
			}

			if (detectFacesResult.length > 0) {
				console.info(`FakePeriodicFaceDetector: Detected ${detectFacesResult.length} faces.`)
				this._faceDetected.dispatch(detectFacesResult)

				// const identifyFacesResult = await this._identifyFacesAsync(detectFacesResult)
				// if (!this._isRunning) {
				// 	console.info('PeriodicFaceDetector: Stopped while waiting for identify faces.')
				// 	return
				// }
				// this._facesIdentified.dispatch(identifyFacesResult)

			} else {
				console.debug(`FakePeriodicFaceDetector: No faces detected.`)
			}

			const durationMs = moment().diff(detectStart)
			const timeToWaitMs = Math.max(0, intervalMs - durationMs)
			console.debug(`FakePeriodicFaceDetector: Last request took ${durationMs} ms, waiting ${timeToWaitMs} ms until next time.`)

			return setTimeout(() => this._onDetectFacesAsync(intervalMs), timeToWaitMs)
		} catch (err) {
			console.error('Failed to periodically detect faces. Will keep trying..', error(err))
			return undefined
		}
	}
}
