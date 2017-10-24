import * as moment from 'moment'
type Moment = moment.Moment

import { IEvent } from './utils/Events'
import { isDefined, strEnum } from './utils/index'
import { IVideoService } from './VideoService'

const motionThreshold = 100	// Motion detected if frame.score value is greater than this
const initialDetectionDurationMs = 500
const maxInitialDetectionGapMs = 500
const maxPresenceDetectionGapMs = 5000 // Once present, be lenient about person standing still for a few seconds

const defaultOpts: PresenceDetectorOpts = {
	diffCanvas: undefined,
	diffHeight: 64,
	diffWidth: 64,
	motionScoreThreshold: 100,
	onStateChanged: undefined,
	pixelDiffThreshold: 32,
	video: undefined,
}

// tslint:disable-next-line:variable-name
export const State = strEnum([
	'notPresent',
	'present',
])
export type State = keyof typeof State

export interface PresenceDetectorOpts {
	diffWidth?: number
	diffHeight?: number
	video?: HTMLVideoElement
	diffCanvas?: HTMLCanvasElement
	motionScoreThreshold: number
	onStateChanged?: (state: string) => void
	/**
	 * min for a pixel to be considered significant
	 */
	pixelDiffThreshold?: number
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
	public onIsDetectedChanged: IEvent<boolean>

	private _diffContext: CanvasRenderingContext2D
	private _diffCanvas: HTMLCanvasElement
	private _diffImageSize: Size
	private _intervalTimer?: NodeJS.Timer
	private _detectionState: State
	private _motionStart?: Moment
	private _pixelDiffThreshold: number
	private _lastMotionOn?: Moment
	private _video: HTMLVideoElement
	private readonly _opts: PresenceDetectorOpts

	constructor(opts: PresenceDetectorOpts) {
		this._opts = { ...defaultOpts, ...opts }
		this._detectionState = State.notPresent

		this._video = isDefined(this._opts.video, 'video')!
		this._diffCanvas = isDefined(this._opts.diffCanvas, 'motionCanvas')!
		this._diffContext = isDefined(this._diffCanvas.getContext('2d'), 'diffContext')!
		this._diffImageSize = { width: this._opts.diffWidth || 64, height: this._opts.diffHeight || 64 }
		this._pixelDiffThreshold = isDefined(this._opts.pixelDiffThreshold, 'pixelDiffThreshold')!
	}

	public start(pollIntervalMs: number = 100): void {
		if (this._intervalTimer) {
			console.warn('Already started.')
			return
		}

		console.info('Start polling presence.')
		this._intervalTimer = setInterval(this.checkPresenceInImage, pollIntervalMs)
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

		const isMotionDetected = motionScore > this._opts.motionScoreThreshold

		switch (this._detectionState) {
			case State.notPresent: {
				if (isMotionDetected) {
					if (this._motionStart === undefined) {
						console.info('Initial detection of person.')
						this._motionStart = moment()
					}
					this._lastMotionOn = moment()
					const motionDurationMs = moment().diff(this._motionStart)
					if (motionDurationMs > initialDetectionDurationMs) {
						console.info('Presence detected.')
						this._setDetectionState(State.present)
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
				break
			}

			case State.present: {
				if (isMotionDetected) {
					// Presence is sustained
					this._lastMotionOn = moment()
				} else {
					const detectionGapDurationMs = moment().diff(this._lastMotionOn)
					if (detectionGapDurationMs > maxPresenceDetectionGapMs) {
						// Motion no longer detected, demote to not present if person is out of camera view for some time
						console.info('Presence ended.')
						this._motionStart = undefined
						this._lastMotionOn = undefined
						this._setDetectionState(State.notPresent)
					}
				}
				break
			}
		}
	}

	private checkPresenceInImage() {
		const diffContext = this._diffContext
		const video = this._video
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

	private _setDetectionState(state: State) {
		this._detectionState = state

		if (this._opts.onStateChanged) {
			this._opts.onStateChanged(state)
		}
	}

	private processDiff(diffImageData: ImageData) {
		const rgba = diffImageData.data

		// pixel adjustments are done by reference directly on diffImageData
		let score = 0
		for (let i = 0; i < rgba.length; i += 4) {
			const pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1
			const normalized = Math.min(255, pixelDiff * (255 / this._pixelDiffThreshold))
			rgba[i] = 0
			rgba[i + 1] = normalized
			rgba[i + 2] = 0

			if (pixelDiff >= this._pixelDiffThreshold) {
				score++
			}
		}

		return {
			score,
		}
	}
}

export default PresenceDetector
