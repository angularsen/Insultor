import * as React from 'react'

export interface Props {
	desiredWidth: number
	desiredHeight: number
	initialPhotoDataUrl?: string
	onPhotoDataUrlChanged: (photoDataUrl?: string) => void
}

interface State {
	state: 'notstarted' | 'capturing' | 'captured' | 'accepted'
	videoWidth: number
	videoHeight: number
}

function noop() { /*noop*/ }

function visibleStyle<T>(val: T, ...args: T[]): { display?: 'none' } {
	const show = args.indexOf(val) >= 0
	return show ? {} : { display: 'none' }
}

// function visCol<T>(val: T, ...args: T[]): VisibilityType {
// 	const show = args.indexOf(val) >= 0
// 	return show ? 'visible' : 'collapse'
// }

class Component extends React.Component<Props, State> {
	public photoHeight?: number
	public photoWidth?: number
	public photoDataUrl?: string

	private _videoStream?: MediaStream
	private _photoContext?: CanvasRenderingContext2D
	private _photoCanvas?: HTMLCanvasElement
	private _video?: HTMLVideoElement

	constructor(props: Props) {
		super()

		this.state = {
			state: 'notstarted',
			videoWidth: props.desiredWidth,
			videoHeight: props.desiredHeight,
		}
	}

	public componentDidMount() {
		if (!this._photoCanvas) { throw new Error('Photo canvas not available.') }
		if (!this._video) { throw new Error('Video element not available.') }

		this._photoContext = this._photoCanvas.getContext('2d') || undefined
		if (!this._photoContext) { throw new Error('Unable to get photo context.') }
	}

	public render() {
		const { state, videoWidth, videoHeight } = this.state

		return (
			<div style={{ display: 'flex', flexDirection: 'column' }}>
				<img src={this.props.initialPhotoDataUrl} style={{
					background: '#666',
					width: '100%',
					...visibleStyle(state, 'notstarted'),
				}} />
				<video style={{
					background: '#666',
					width: '100%',
					...visibleStyle(state, 'capturing'),
				}}
					ref={(video) => this._video = video || undefined}>Video stream not available.</video>

				<canvas style={{ background: '#666', width: '100%', ...visibleStyle(state, 'captured', 'accepted') }}
					width={videoWidth} height={videoHeight}
					ref={(canvas) => this._photoCanvas = canvas || undefined}></canvas>

				<div style={{display: 'flex', flexDirection: 'row' }}>
					<button className='btn btn-primary' style={{ ...visibleStyle(state, 'capturing') }} type='button'
						onClick={() => this._takePhoto()}>Ta bilde</button>

					<button className='btn btn-default' style={{ ...visibleStyle(state, 'notstarted', 'accepted') }} type='button'
						onClick={() => this._startAsync()}>Start kamera</button>

					<button className='btn btn-default' style={{ ...visibleStyle(state, 'capturing') }} type='button'
						onClick={() => this._stop()}>Stopp kamera</button>

					<button className='btn btn-default' style={{ ...visibleStyle(state, 'captured') }} type='button'
						onClick={() => this._clearPhoto()}>Tøm bilde</button>

					<button className='btn btn-default' style={{ ...visibleStyle(state, 'captured') }} type='button'
						onClick={() => this._startAsync()}>Prøv igjen</button>
						{this.photoDataUrl
							? (<a href={this.photoDataUrl || 'javascript:void(0)'} download='wow_you_look_great.jpg' role='button' type='button'
									className='btn btn-default' style={{ ...visibleStyle(state, 'captured') }}>Last ned</a>)
							: undefined
						}
				</div>
			</div>
		)
	}

	private _takePhoto(): any {
		if (!this._photoContext) { console.error('No photo context.'); return }
		if (!this._photoCanvas) { console.error('No photo canvas.'); return }
		if (!this._video) { console.error('No video element.'); return }

		this._photoContext.drawImage(this._video, 0, 0, this.state.videoWidth, this.state.videoHeight)
		const photoDataUrl = this._photoCanvas.toDataURL('image/jpeg', 1.0)
		this.photoDataUrl = photoDataUrl
		this.photoWidth = this.state.videoWidth
		this.photoHeight = this.state.videoHeight
		this._stopCamera()
		this.props.onPhotoDataUrlChanged(photoDataUrl)
		this.setState({ state: 'captured' })
	}

	private _clearPhoto(): any {
		if (!this._photoContext || !this._photoCanvas) { console.error('No canvas to clear.'); return }

		this._photoContext.clearRect(0, 0, this._photoCanvas.width, this._photoCanvas.height)
		this.photoHeight = undefined
		this.photoWidth = undefined
		this.photoDataUrl = undefined
		this.props.onPhotoDataUrlChanged(undefined)
		this.setState({ state: 'notstarted' })
	}

	private async _startAsync(): Promise<void> {
		if (!this._video) { console.error('No video element.'); return }
		try {
			console.info('start(): Starting video...')
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: 'user',
					// frameRate: { ideal: 10, max: 30 },
					height: this.props.desiredHeight,
					width: this.props.desiredWidth,
				},
			})

			console.debug('Requesting video...OK!')
			this._videoStream = stream
			this._video.srcObject = stream

			this._video.onloadedmetadata = (_) => {
				if (!this._video) { console.error('No video element.'); return }
				this.setState({ videoWidth: this._video.videoWidth, videoHeight: this._video.videoHeight })
				this._video.play()
				console.log('Starting video...OK.')
				console.log(`Video resolution: ${this._video.videoWidth}x${this._video.videoHeight}`)
				this._video.onloadedmetadata = noop
			}

			this.setState({ state: 'capturing' })
		} catch (err) {
			console.error('Starting video...FAILED!', err)
			alert('Could not access video.\n\nSee console for details.')
		}
	}

	private _stop(): void {
		this._stopCamera()
		this.setState({ state: 'notstarted' })
	}

	private _stopCamera(): void {
		if (!this._video) { console.error('No video element.'); return }
		if (!this._videoStream) { console.error('No video stream.'); return }

		try {
			console.log('Stopping video...')

			const videoTracks = this._videoStream.getVideoTracks()
			for (const track of videoTracks) {
				track.stop()
			}

			this._video.pause()
			this._video.src = ''

			console.log('Stopping video...OK.')
		} catch (err) {
			console.error('Failed to stop video.', err)
			alert('Failed to stop video.\nSee console for details.')
		}
	}
}

export default Component
