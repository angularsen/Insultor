import * as React from 'react'
import * as ReactDOM from 'react-dom'

import * as moment from 'moment'
type Moment = moment.Moment

// import FaceIdentityProvider from './services/FaceIdentityProvider'
import FaceApi, { MicrosoftFaceApi } from './services/MicrosoftFaceApi'

import { default as Commentator, State as CommentatorState } from './services/Commentator'
// import DiffCamEngine from './services/diff-cam-engine'
import { default as PresenceDetector } from './services/PresenceDetector'
import Speech from './services/Speech'
import { isDefined } from './services/utils/index'
import { VideoService } from './services/VideoService'

const STATE_FACE_DETECTED = 'face detected'
const STATE_PERSON_IDENTIFIED = 'person identified'

const faceApiConfig = {
	endpoint: 'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/',
	myPersonalSubscriptionKey: '93a68a5ab7d94ca0984fea54a332ad89',
	webstepPersonGroupId: 'insultor-webstep-trd',
}

interface Size {
	height: number
	width: number
}

const speech = new Speech()

const getTimePeriodOfDay = () => {
	const now = moment()
	if (now.hour() < 5) return 'night'
	if (now.hour() < 12) return 'morning'
	if (now.hour() < 18) return 'evening'
	return 'late evening'
}

interface State {
	isPresenceDetected: boolean
	commentatorState: CommentatorState
	motionScore: number
	videoSize: Size
}

interface RenderDataForState {
	background: string
	foreground: string
	stateText: string
}

class Component extends React.Component<any, State> {
	private static _getRenderDataForState(commentatorState: CommentatorState): RenderDataForState {
		// Shades of steel blue, 100% is white and 0% is black
		const color95 = '#edf3f8'
		const color90 = '#dae7f1'
		const color80 = '#b6cee2'
		const color70 = '#91b6d4'
		const color60 = '#6c9dc6'
		const color50 = '#4785b8'
		const color10 = '#0e1b25'
		const lightTextColor = color95
		const darkTextColor = color10

		switch (commentatorState) {
			case 'idle': return { background: color95, foreground: darkTextColor, stateText: 'Sover...' }
			case 'detectPresence': return { background: color80, foreground: darkTextColor, stateText: 'Jeg ser ingen' }
			case 'detectFaces': return { background: color70, foreground: darkTextColor, stateText: 'Hm.. Er det noen her?' }
			case 'identifyFaces': return { background: color60, foreground: lightTextColor, stateText: 'Hei, hvem er du?' }
			case 'deliverComments': return { background: color50, foreground: lightTextColor, stateText: 'Hør her' }
			default: return { background: color10, foreground: lightTextColor, stateText: 'Ingen i nærheten' }
		}
	}
	private _commentator: Commentator

	/**
	 * Copying over images from live video for sending to Microsoft Face API to detect faces.
	 */
	private _faceDetectCanvas?: HTMLCanvasElement

	/**
	 * Copying over images for comparing image difference compared to a baseline (background).
	 */
	private _motionDiffCanvas?: HTMLCanvasElement

	/**
	 * Live video element.
	 */
	private _video?: HTMLVideoElement
	// private _presenceDetector: PresenceDetector

	constructor() {
		super()

		// this._presenceDetector = new PresenceDetector({ video: null, onStateChanged: (state) => this.onPresenceStateChanged(state) })
		// this.faceIdentityProvider = undefined

		this.state = {
			commentatorState: 'idle',
			isPresenceDetected: false,
			motionScore: 0,
			videoSize: { width: 640, height: 480 },
		}

		this._initVideo = this._initVideo.bind(this)
		this._onMotionScore = this._onMotionScore.bind(this)
		// this._initDiffCam = this._initDiffCam.bind(this)
	}

	public componentDidMount() {
		console.log('Mounted IdentifyOnPresence.')
		const video = isDefined(this._video, '_video')
		const motionDiffCanvas = isDefined(this._motionDiffCanvas, '_motionDiffCanvas')
		const faceDetectCanvas = isDefined(this._faceDetectCanvas, '_faceDetectCanvas')

		this._commentator = new Commentator({
			faceApi: new MicrosoftFaceApi(faceApiConfig.myPersonalSubscriptionKey, faceApiConfig.endpoint, faceApiConfig.webstepPersonGroupId),
			presenceDetector: new PresenceDetector({ diffCanvas: motionDiffCanvas, video }),
			videoService: new VideoService(video),
		})
	}

	public componentWillUnmount() {
		console.log('Unmounting IdentifyOnPresence.')
		// this.stopVideo()
	}

	public render() {
		const { videoSize } = this.state
		const { width, height } = videoSize

		const startStopButtonText = this.state.commentatorState === 'idle' ? 'Start' : 'Stop'
		const buttonStyle = { padding: '1em', minWidth: '6em' }
		const person = this.state.persons && this.state.persons[0]
		let background: string = this._getBackgroundColor(this.state.commentatorState)

		return (
			<div>
				<h1>Identify on presence</h1>
				<h3>{person ? `Hi ${person.name}` : ''}</h3>
				<h3>State: {this.state.isPresenceDetected}</h3>
				<div className='camera'>
					<video style={{ border: '1px solid lightgrey' }} id='video' ref={(video) => this._video = video || undefined}
					width={width} height={height} onCanPlay={ev => this.videoOnCanPlay(ev)}>Video stream not available.</video>
				</div>
				<div>
					<canvas style={{ border: '1px solid lightgrey' }} id='motion-diff-canvas'
						ref={(canvas) => this._motionDiffCanvas = canvas || undefined}></canvas>
				</div>
				<div>
					<canvas style={{ border: '1px solid lightgrey' }} id='faceapi-canvas' ref={(canvas) => this._faceDetectCanvas = canvas || undefined}
						width={width} height={height}></canvas>
				</div>
				<div>
					<button style={buttonStyle} onClick={this._startStopOnClick}>{startStopButtonText}</button>
				</div>
				<p>
					{this.state.textToSpeak ? this.state.textToSpeak : ''}
				</p>
				<p>
					Detection score: {this.state.motionScore}
				</p>
				<p>
					{this.state.error ? 'Error happened: ' + this.state.error : ''}
				</p>
			</div>
		)
	}

	public videoOnCanPlay(ev: React.SyntheticEvent<HTMLVideoElement>) {
		const video: HTMLVideoElement = ev.target as HTMLVideoElement

		console.log('IdentifyOnPresence: Video ready to play. Calculating output height.')

		// Scale height to achieve same aspect ratio for whatever our rendered width is
		const height = video.videoHeight / (video.videoWidth / this.state.width)
		this.setState({ height })
	}

	public _initVideo(video: HTMLVideoElement) {
		// this.video = video
		if (!video) return

		this.setState({ width: video.width, height: video.height })
		// this._initDiffCam()
	}

	// public _initDiffCam() {
	// 	// This method is called for the ref callback of both video and motionDiffCanvas
	// 	if (this._video && this._motionDiffCanvas) {
	// 		console.log('IdentifyOnPresence: Initialize DiffCamEngine')

	// 		DiffCamEngine.init({
	// 			video: this.video,
	// 			motionCanvas: this.motionDiffCanvas,
	// 			captureIntervalTime: 200,
	// 			captureCallback: this._onDiffCamFrame,
	// 			initSuccessCallback: () => DiffCamEngine.start()
	// 		})
	// 	}
	// }

	public onPresenceStateChanged(state: boolean) {
		this.setState({ detectionState: state })
	}

	public _onMotionScore(motionScore: number) {
		// this._presenceDetector.addMotionScore(frame.score)
		this.setState({ motionScore })
	}

	public startVideo(video: any) {
		// console.log('IdentifyOnPresence: Starting video...')
		// _initVideo(this.video)
	}

	public stopVideo(video: any) {
		// console.log('IdentifyOnPresence: Stopping video...')
		// console.log('IdentifyOnPresence: Stopping video...OK.')
		// DiffCamEngine.stop()
	}

	public _startStopOnClick(ev: React.MouseEvent<HTMLButtonElement>) {
		ev.preventDefault()
		this._commentator.toggleStartStop()
	}
}

export default Component
