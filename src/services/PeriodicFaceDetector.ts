import * as moment from 'moment'
type Moment = moment.Moment

import { DetectFaceResult, DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import {isDefined } from './utils'
import { EventDispatcher, IEvent } from './utils/Events'
import { error } from './utils/format'

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

	private _isRunning: boolean
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

		this._detectFacesAsync = this._detectFacesAsync.bind(this)
		this._onDetectFacesAsync = this._onDetectFacesAsync.bind(this)
	}

	public start(): void {
		if (this._isRunning) { throw new Error('Already running.') }
		this._isRunning = true

		const intervalMs = this._intervalMs
		console.info(`PeriodicFaceDetector: Start detecting every ${intervalMs} ms.`)
		this._onDetectFacesAsync(intervalMs)
	}

	public stop(): void {
		if (!this._isRunning) { throw new Error('Already stopped.') }
		this._isRunning = false

		console.info(`PeriodicFaceDetector: Stopping.`)
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

		let timeToWaitMs = 0
		try {
			const detectStart = moment()
			console.info(`PeriodicFaceDetector: Detecting faces...`)
			console.debug(`PeriodicFaceDetector: this._detectFacesAsync: `, this._detectFacesAsync)
			const detectFacesResult = await this._detectFacesAsync()
			if (detectFacesResult === undefined) { throw new Error('No detect faces result, this is likely a bug.') }

			if (!this._isRunning) {
				console.info('PeriodicFaceDetector: Stopped while waiting for detect faces.')
				return
			}

			if (detectFacesResult.length > 0) {
				console.info(`PeriodicFaceDetector: Detected ${detectFacesResult.length} faces.`)
				this._faceDetected.dispatch(detectFacesResult)
			} else {
				console.debug(`PeriodicFaceDetector: No faces detected.`)
			}

			const durationMs = moment().diff(detectStart)
			timeToWaitMs = Math.max(0, intervalMs - durationMs)
			console.debug(`PeriodicFaceDetector: Last request took ${durationMs} ms, waiting ${timeToWaitMs} ms until next time.`)
		} catch (err) {
			console.error('Failed to periodically detect faces. Will keep trying..', error(err))
			return undefined
		} finally {
			console.debug(`PeriodicFaceDetector: Queue next detect faces in ${timeToWaitMs} ms.`)
		}

		return setTimeout(() => this._onDetectFacesAsync(intervalMs), timeToWaitMs)
	}
}
