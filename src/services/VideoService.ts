import { checkDefined } from './utils/index'

/**
 * Handles configuring video source to stream to a <video> HTML element
 * and has actions for starting/stopping video stream.
 */
export interface IVideoService {
	/**
	 * Gets an URL encoded string of the current image data.
	 */
	getCurrentImageDataUrl(): string

	/**
	 * Start streaming video.
	 */
	start(): void

	/**
	 * Stop streaming video. Will release the camera resource (webcam LED should no longer be lit).
	 */
	stop(): void
}

export class VideoService implements IVideoService {
	private isRunning: boolean
	private videoStream?: MediaStream

	constructor(
		private readonly _video: HTMLVideoElement,
		private readonly _copyImageCanvas: HTMLCanvasElement,
		private readonly _width: number = 500,
		private readonly _height: number = 500,
		) {
		checkDefined(_video, '_video')
		checkDefined(_copyImageCanvas, '_copyImageCanvas')
	}

	public getCurrentImageDataUrl() {
		const context = this._copyImageCanvas.getContext('2d')
		if (!context) { throw new Error('Unable to get context of canvas.') }

		// Draw current content of <video> element to canvas
		context.drawImage(this._video, 0, 0, this._video.videoWidth, this._video.videoHeight)
		return this._copyImageCanvas.toDataURL('image/png')
	}

	public start(): void {
		if (this.isRunning) {
			console.warn('Already started.')
			return
		}

		console.info('start(): Starting video...')
		navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				facingMode: 'user',
				frameRate: { ideal: 10, max: 30 },
				height: this._height,
				width: this._width,
			},
		})
		.then((stream) => {
			console.debug('Requesting video...OK!')
			this.videoStream = stream
			this._video.srcObject = stream

			this._video.onloadedmetadata = (e) => {
				this._video.play()
			}

			this.isRunning = true
			console.log('Starting video...OK.')
		})
		.catch((err) => {
			console.error('Starting video...FAILED!', err)
			alert('Could not access video.\n\nSee console for details.')
		})
	}

	public stop(): void {
		try {
			console.log('Stopping video...')
			if (!this.videoStream) {
				console.warn('Nothing to stop, video stream not created yet.')
				return
			}
			if (!this.isRunning) {
				console.warn('Already stopped.')
				return
			}

			const videoTracks = this.videoStream.getVideoTracks()
			const audioTracks = this.videoStream.getAudioTracks()
			for (const track of videoTracks.concat(audioTracks)) {
				track.stop()
			}

			this._video.pause()
			this._video.src = ''
			this.isRunning = false

			console.log('Stopping video...OK.')
		} catch (err) {
			console.error('Failed to stop video.', err)
			alert('Failed to stop video.\nSee console for details.')
		}
	}
}

export default VideoService
