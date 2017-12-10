import { differenceInMilliseconds } from 'date-fns'
// Workaround for webpack --watch: https://github.com/TypeStrong/ts-loader/issues/348
import { clearTimeout, setTimeout } from 'timers'
import { DetectFaceResult } from '../../docs/FaceAPI/DetectFacesResponse'
import {checkDefined } from './utils'
import { EventDispatcher, IEvent } from './utils/Events'
import { error } from './utils/format'

export interface DetectedFaceWithImageData {
	faceId: string
	result: DetectFaceResult
	imageDataUrl: string
}

export interface IPeriodicFaceDetector {
	readonly facesDetected: IEvent<DetectedFaceWithImageData[]>
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
	public get facesDetected(): IEvent<DetectedFaceWithImageData[]> { return this._faceDetected }

	private _isRunning: boolean
	private _faceDetected = new EventDispatcher<DetectedFaceWithImageData[]>()
	private _timer?: NodeJS.Timer

	constructor(
		private _intervalMs: number,
		private _detectFacesAsync: () => Promise<DetectedFaceWithImageData[]>,
	) {
		checkDefined(_intervalMs, '_intervalMs')
		checkDefined(_detectFacesAsync, '_detectFacesAsync')

		if (_intervalMs < 0) {
			throw new Error('Interval must be a positive number, was: ' + _intervalMs)
		}

		this._detectFacesAsync = this._detectFacesAsync.bind(this)
		this._onDetectFacesAsync = this._onDetectFacesAsync.bind(this)
	}

	public start(): void {
		if (this._isRunning) { return }
		this._isRunning = true

		const intervalMs = this._intervalMs
		console.info(`PeriodicFaceDetector: Start detecting every ${intervalMs} ms.`)
		this._onDetectFacesAsync(intervalMs)
	}

	public stop(): void {
		if (!this._isRunning) { return }
		this._isRunning = false

		console.info(`PeriodicFaceDetector: Stopping.`)
		if (this._timer) {
			clearTimeout(this._timer)
			this._timer = undefined
		}
	}

	private async _onDetectFacesAsync(intervalMs: number): Promise<any> {
		if (!this._isRunning) {
			console.info('PeriodicFaceDetector: Already stopped, returning early.')
			return
		}

		let timeToWaitMs = 0
		try {
			const detectStart = new Date()
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

			const durationMs = differenceInMilliseconds(new Date(), detectStart)
			timeToWaitMs = Math.max(0, intervalMs - durationMs)
			console.debug(`PeriodicFaceDetector: Last request took ${durationMs} ms, waiting ${timeToWaitMs} ms until next time.`)
		} catch (err) {
			console.error('Failed to periodically detect faces. Will keep trying..', error(err))
			return undefined
		} finally {
			console.debug(`PeriodicFaceDetector: Queue next detect faces in ${timeToWaitMs} ms.`)
		}

		this._timer = setTimeout(() => this._onDetectFacesAsync(intervalMs), timeToWaitMs)
	}
}
