import * as moment from 'moment'
type Moment = moment.Moment

import { EventDispatcher, IEvent } from './utils/Events'
import { isDefined, strEnum } from './utils/index'
import { IVideoService } from './VideoService'

const motionThreshold = 100	// Motion detected if frame.score value is greater than this
const initialDetectionDurationMs = 500
const maxInitialDetectionGapMs = 500
const maxPresenceDetectionGapMs = 5000 // Once present, be lenient about person standing still for a few seconds

interface DefaultOpts {
	diffHeight: number
	diffWidth: number
	motionScoreThreshold: number
	/**
	 * min for a pixel to be considered significant
	 */
	pixelDiffThreshold: number
}

interface InputOpts {
	// Required
	diffCanvas: HTMLCanvasElement
	video: HTMLVideoElement

	// Optional
	diffHeight?: number
	diffWidth?: number
	motionScoreThreshold?: number
	/** min for a pixel to be considered significant */
	pixelDiffThreshold?: number
}

// type Foo = InputOpts & DefaultOpts
// const foo: Foo

export interface PresenceDetectorOpts  {
	diffCanvas: HTMLCanvasElement
	diffHeight: number
	diffWidth: number
	motionScoreThreshold: number
	/**
	 * min for a pixel to be considered significant
	 */
	pixelDiffThreshold: number
	video: HTMLVideoElement
}

export interface IPresenceDetector {
	isDetected: boolean
	readonly onIsDetectedChanged: IEvent<boolean>
	// addMotionScore(motionScore: number, receivedOnDate: Moment): void
	start(pollIntervalMs?: number): void
	stop(): void
}

interface Size {
	width: number,
	height: number
}

export class PresenceDetector implements IPresenceDetector {
	public isDetected: boolean
	public get onIsDetectedChanged(): IEvent<boolean> { return this._onIsDetectedChangedDispatcher }

	private readonly _onIsDetectedChangedDispatcher = new EventDispatcher<boolean>()
	private _diffContext: CanvasRenderingContext2D
	// private _diffCanvas: HTMLCanvasElement
	private _diffImageSize: Size
	private _intervalTimer?: NodeJS.Timer
	private _isDetected: boolean
	private _motionStart?: Moment
	// private _pixelDiffThreshold: number
	private _lastMotionOn?: Moment
	private readonly _opts: PresenceDetectorOpts

	constructor(opts: InputOpts) {
		const defaultOpts: DefaultOpts = {
			diffHeight: 64,
			diffWidth: 64,
			motionScoreThreshold: 100,
			pixelDiffThreshold: 32,
		}

		this._opts = { ...{}, ...opts, ...defaultOpts }
		this._isDetected = false

		// this._video = isDefined(this._opts.video, 'video')!
		// this._diffCanvas = isDefined(this._opts.diffCanvas, 'motionCanvas')!
		this._diffContext = isDefined(this._opts.diffCanvas.getContext('2d'), 'diffContext')!
		this._diffImageSize = { width: this._opts.diffWidth || 64, height: this._opts.diffHeight || 64 }
		// this._pixelDiffThreshold = isDefined(this._opts.pixelDiffThreshold, 'pixelDiffThreshold')!

		this._checkPresenceInImage = this._checkPresenceInImage.bind(this)
		this._setIsDetected = this._setIsDetected.bind(this)
	}

	public start(pollIntervalMs: number = 100): void {
		if (this._intervalTimer) {
			console.warn('Already started.')
			return
		}

		console.info('Start polling presence.')
		this._intervalTimer = setInterval(this._checkPresenceInImage, pollIntervalMs)
	}

	public stop(): void {
		if (!this._intervalTimer) {
			console.warn('Already stopped.')
			return
		}

		console.info('Stop polling presence.')
		clearInterval(this._intervalTimer)
		this._intervalTimer = undefined
	}

	// Call this method for every frame received from diff-cam-engine, or some other means to calculate motion score
	private addMotionScore(motionScore: number, receivedOnDate: Moment) {
		const wasDetected = this.isDetected
		const isDetectedJustNow = motionScore > this._opts.motionScoreThreshold

		if (!wasDetected) {
			if (isDetectedJustNow) {
				if (this._motionStart === undefined) {
					console.info('Initial detection of person.')
					this._motionStart = moment()
				}
				this._lastMotionOn = moment()
				const motionDurationMs = moment().diff(this._motionStart)
				if (motionDurationMs > initialDetectionDurationMs) {
					console.info('Presence detected.')
					this._setIsDetected(true)
				}
			} else {
				const detectionGapDurationMs = moment().diff(this._lastMotionOn)
				if (detectionGapDurationMs > maxInitialDetectionGapMs) {
					// Reset initial detection timers if detection gap is too long
					console.info('Timed out on gap in initial detection.')
					this._motionStart = undefined
					this._lastMotionOn = undefined
				}
			}
		} else {
			if (isDetectedJustNow) {
				// Presence is sustained
				this._lastMotionOn = moment()
			} else {
				const detectionGapDurationMs = moment().diff(this._lastMotionOn)
				if (detectionGapDurationMs > maxPresenceDetectionGapMs) {
					// Motion no longer detected, demote to not present if person is out of camera view for some time
					console.info('Presence ended.')
					this._motionStart = undefined
					this._lastMotionOn = undefined
					this._setIsDetected(false)
				}
			}
		}
	}

	private _checkPresenceInImage() {
		const diffContext = this._diffContext
		const video = this._opts.video
		const {width, height} = this._diffImageSize

		// diff current capture over previous capture, leftover from last time
		diffContext.globalCompositeOperation = 'difference'
		diffContext.drawImage(video, 0, 0, width, height)

		// Get diff image
		const diffImageData = diffContext.getImageData(0, 0, width, height)

		// draw current capture normally over diff, ready for next time
		diffContext.globalCompositeOperation = 'source-over'
		diffContext.drawImage(video, 0, 0, width, height)
	}

	private _setIsDetected(state: boolean) {
		if (state === this._isDetected) { return }

		this._isDetected = state
		this._onIsDetectedChangedDispatcher.dispatch(state)
	}

	private processDiff(diffImageData: ImageData) {
		const rgba = diffImageData.data

		// pixel adjustments are done by reference directly on diffImageData
		let score = 0
		for (let i = 0; i < rgba.length; i += 4) {
			const pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1
			const normalized = Math.min(255, pixelDiff * (255 / this._opts.pixelDiffThreshold))
			rgba[i] = 0
			rgba[i + 1] = normalized
			rgba[i + 2] = 0

			if (pixelDiff >= this._opts.pixelDiffThreshold) {
				score++
			}
		}

		return {
			score,
		}
	}
}

export default PresenceDetector
