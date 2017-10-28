import { isDefined } from './utils/index'

/**
 * Handles configuring video source to stream to a <video> HTML element
 * and has actions for starting/stopping video stream.
 */
export interface IVideoService {
	/**
	 * Draw current video image to a canvas.
	 */
	drawCurrentImageOnCanvas(canvas: HTMLCanvasElement, width: number, height: number): void

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
	private isPlaying: boolean
	private videoStream: MediaStream

	constructor(
		private _video: HTMLVideoElement = document.createElement('video'),
		private _copyImageCanvas: HTMLCanvasElement = document.createElement('canvas')) {
		isDefined(_video, '_video')
		isDefined(_copyImageCanvas, '_copyImageCanvas')

		// console.log('Initialize DiffCamEngine')
		// DiffCamEngine.init({
		// 	captureCallback: this._onDiffCamFrame,
		// 	captureIntervalTime: 200,
		// 	initSuccessCallback: () => DiffCamEngine.start(),
		// 	motionCanvas: this.canvas,
		// 	video: this.video,
		// })
	}

	public drawCurrentImageOnCanvas(canvas: HTMLCanvasElement): void {
		const context = canvas.getContext('2d')
		if (!context) { throw new Error('Unable to get context of canvas.') }

		// Draw current content of <video> element to canvas
		context.drawImage(this._video, 0, 0, this._video.width, this._video.height)

		const imageDataUrl = canvas.toDataURL('image/png')

		throw new Error('Method not implemented.')
	}

	public getCurrentImageDataUrl() {
		const context = this._copyImageCanvas.getContext('2d')
		if (!context) { throw new Error('Unable to get context of canvas.') }

		// Draw current content of <video> element to canvas
		context.drawImage(this._video, 0, 0, this._video.width, this._video.height)
		return this._copyImageCanvas.toDataURL('image/png')
	}

	public start(): void {
		console.info('start(): Starting video...')
		navigator.mediaDevices.getUserMedia({ video: true, audio: false })
			.then((stream) => {
				console.debug('Requesting video...OK!')
				this.videoStream = stream
				this._video.srcObject = stream
				this._video.play()
				this.isPlaying = true

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

			const videoTracks = this.videoStream.getVideoTracks()
			const audioTracks = this.videoStream.getAudioTracks()
			for (const track of videoTracks.concat(audioTracks)) {
				track.stop()
			}

			this._video.pause()
			this._video.src = ''
			this.isPlaying = false

			console.log('Stopping video...OK.')
		} catch (err) {
			console.error('Failed to stop video.', err)
			alert('Failed to stop video.\nSee console for details.')
		}
	}
}

export default VideoService
