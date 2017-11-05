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

function getRenderDataForState(commentator: Commentator): RenderDataForState {
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

	const stateText = commentator.status.text

	switch (commentator.state) {
		case 'idle': return { background: color95, color: darkTextColor, stateText }
		case 'detectPresence': return { background: color80, color: darkTextColor, stateText }
		case 'detectFaces': return { background: color70, color: darkTextColor, stateText }
		case 'identifyFaces': return { background: color60, color: lightTextColor, stateText }
		case 'deliverComments': return { background: color50, color: lightTextColor, stateText }
		default: return { background: color10, color: lightTextColor, stateText }
	}
}

const getTimePeriodOfDay = () => {
	const now = moment()
	if (now.hour() < 5) return 'night'
	if (now.hour() < 12) return 'morning'
	if (now.hour() < 18) return 'evening'
	return 'late evening'
}

interface State {
	error?: string
	isPresenceDetected: boolean
	commentatorState: CommentatorState
	commentatorStatus: string
	commentatorEmoji: string
	motionScore: number
	/** Currently speaking this text, undefined otherwise. */
	textToSpeak?: string
	videoSize: Size
}

interface RenderDataForState {
	background: string
	color: string
	stateText: string
}

class Component extends React.Component<any, State> {
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
			commentatorEmoji: '😶',
			commentatorState: 'idle',
			commentatorStatus: 'Ikke startet enda...',
			isPresenceDetected: false,
			motionScore: 0,
			videoSize: { width: 640, height: 480 },
		}

		this._onMotionScore = this._onMotionScore.bind(this)
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

		this._commentator.onStatusChanged.subscribe(status => {
			this.setState({
				commentatorEmoji: status.emoji,
				commentatorStatus: status.text,
			})
		})

		this._commentator.onSpeak.subscribe(speakData => {
			this.setState({ textToSpeak: speakData.utterance.text })
		})
	}

	public componentWillUnmount() {
		console.log('Unmounting IdentifyOnPresence.')
		this._commentator.stop()
	}

	public render() {
		const { videoSize } = this.state
		const { width, height } = videoSize

		const startStopButtonText = this.state.commentatorState === 'idle' ? 'Start' : 'Stop'
		const buttonStyle = { padding: '1em', minWidth: '6em' }
		// const person = this.state.persons && this.state.persons[0]
		const renderData = getRenderDataForState(this._commentator)

		return (
			<div style={{ color: renderData.color, background: renderData.background }}>
				<h1>Kommentator</h1>
				<h3>{this.state.commentatorStatus}</h3>
				<h3>{this.state.commentatorEmoji}</h3>
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
		// const height = video.videoHeight / (video.videoWidth / this.state.width)
		// this.setState({ height })
	}

	public onPresenceStateChanged(isPresenceDetected: boolean) {
		this.setState({ isPresenceDetected })
	}

	public _onMotionScore(motionScore: number) {
		// this._presenceDetector.addMotionScore(frame.score)
		this.setState({ motionScore })
	}

	public _startStopOnClick(ev: React.MouseEvent<HTMLButtonElement>) {
		ev.preventDefault()
		this._commentator.toggleStartStop()
	}
}

export default Component
