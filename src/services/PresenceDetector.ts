import * as moment from 'moment'
type Moment = moment.Moment

import { setInterval, setTimeout } from 'timers' // Workaround for webpack --watch: https://github.com/TypeStrong/ts-loader/issues/348
import { EventDispatcher, IEvent } from './utils/Events'
import { isDefined, strEnum } from './utils/index'
import { IVideoService } from './VideoService'

const motionThreshold = 50	// Motion detected if frame.score value is greater than this

/**
 * During transition from not detected to detected, if any two motion detected samples are at least this
 * much time apart, it will complete the transition.
 */
const initialDetectionDurationMs = 200

/**
 * During transition from not detected to detected, this is the max time between two motion detection samples
 * before resetting the transition.
 */
const maxInitialDetectionGapMs = 5000

/**
 * While in detected state, this is the max time since last motion detected before transitioning
 * back to not detected state.
 * Once present, be lenient about person standing still for a few seconds.
 */
const maxPresenceDetectionGapMs = 10000

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
	public get onMotionScore(): IEvent<number> { return this._onMotionScoreDispatcher }
	public get onIsDetectedChanged(): IEvent<boolean> { return this._onIsDetectedChangedDispatcher }

	private readonly _onIsDetectedChangedDispatcher = new EventDispatcher<boolean>()
	private readonly _onMotionScoreDispatcher = new EventDispatcher<number>()

	private _diffContext: CanvasRenderingContext2D
	// private _diffCanvas: HTMLCanvasElement
	private _diffImageSize: Size
	private _intervalTimer?: NodeJS.Timer
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
		this.isDetected = false

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
		this.isDetected = false
	}

	// Call this method for every frame received from diff-cam-engine, or some other means to calculate motion score
	private _onMotionScore(motionScore: number, receivedOnDate: Moment = moment()) {
		const wasDetected = this.isDetected
		const isDetectedNow = motionScore > this._opts.motionScoreThreshold

		if (!wasDetected) {
			if (isDetectedNow) {
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
			if (isDetectedNow) {
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
		const motionScore = this._processDiff(diffImageData)

		// draw current capture normally over diff, ready for next time
		diffContext.globalCompositeOperation = 'source-over'
		diffContext.drawImage(video, 0, 0, width, height)

		this._onMotionScore(motionScore)
		this._onMotionScoreDispatcher.dispatch(motionScore)
	}

	private _setIsDetected(state: boolean) {
		if (state === this.isDetected) { return }

		this.isDetected = state
		this._onIsDetectedChangedDispatcher.dispatch(state)
	}

	private _processDiff(diffImageData: ImageData): number {
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
		return score
	}
}

export default PresenceDetector
