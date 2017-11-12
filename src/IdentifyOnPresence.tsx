import * as React from 'react'
import * as ReactDOM from 'react-dom'

import * as moment from 'moment'
type Moment = moment.Moment

// import FaceIdentityProvider from './services/FaceIdentityProvider'
import FaceApi, { MicrosoftFaceApi } from './services/MicrosoftFaceApi'

import PersonGroupTrainingStatus from '../docs/FaceAPI/PersonGroupTrainingStatus'
import { default as Commentator, State as CommentatorState } from './services/Commentator'
// import DiffCamEngine from './services/diff-cam-engine'
import { default as PresenceDetector } from './services/PresenceDetector'
import Speech from './services/Speech'
import { isDefined } from './services/utils/index'
import { VideoService } from './services/VideoService'

const STATE_FACE_DETECTED = 'face detected'
const STATE_PERSON_IDENTIFIED = 'person identified'

// Persons:
// Andreas Gullberg Larsen 1e797137-fa4c-4d2b-86e8-6032b1007a04
// tslint:disable-next-line:max-line-length
// 		face1 3651cd42-91f9-424f-84aa-e5e466a8f378 https://x4qqkg-sn3301.files.1drv.com/y4mrfl-hnbFB2TZfZBryCkMu9MdRAJN5Md7siS_iC96u-8L5mz1ow4aR6HZ48f3wN8QnV5QyP8oxybraZGMVS1t917hOJi3GXti_McLYZJUXU7SIX48klK9upfcui3R6CiGSkVloi3StSb10bdk1or5_24qPIOgKMP0sj0CyOG97wUjrljP3bEizMI5ha_hbfmEYOKFtUb1BjAK8rZQWY2oig/Andreas%20Gullberg%20Larsen%202017-05-30%20-%20profile%202%20square%20300p.jpg?psid=1

const faceApiConfig = {
	endpoint: 'https://northeurope.api.cognitive.microsoft.com/face/v1.0/',
	myPersonalSubscriptionKey: 'e3778e3dab7c46bba4b0af4dcd3df272',
	webstepPersonGroupId: 'insultor-webstep-trd',
}

interface Size {
	height: number
	width: number
}

const speech = new Speech()

function getStateStyle(commentator: Commentator): StateStyle {
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

	switch (commentator.state) {
		case 'idle': return { background: color95, color: darkTextColor }
		case 'detectPresence': return { background: color80, color: darkTextColor }
		case 'detectFaces': return { background: color70, color: darkTextColor }
		case 'identifyFaces': return { background: color60, color: lightTextColor }
		case 'deliverComments': return { background: color50, color: lightTextColor }
		default: return { background: color10, color: lightTextColor }
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
	/** Last polled training status */
	trainingStatus?: PersonGroupTrainingStatus
}

interface StateStyle {
	background: string
	color: string
}

class Component extends React.Component<any, State> {
	private _faceApi: MicrosoftFaceApi
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
			trainingStatus: undefined,
			videoSize: { width: 640, height: 480 },
		}

		this._faceApi = new MicrosoftFaceApi(
			faceApiConfig.myPersonalSubscriptionKey,
			faceApiConfig.endpoint,
			faceApiConfig.webstepPersonGroupId)

		this._onMotionScore = this._onMotionScore.bind(this)
		this._onPresenceStateChanged = this._onPresenceStateChanged.bind(this)
		this._onMotionScore = this._onMotionScore.bind(this)
		this._startStopOnClick = this._startStopOnClick.bind(this)
		this._trainPersonGroupAsync = this._trainPersonGroupAsync.bind(this)
		this._updatePersonGroupTrainingStatusAsync = this._updatePersonGroupTrainingStatusAsync.bind(this)
	}

	public componentDidMount() {
		console.log('Mounted IdentifyOnPresence.')
		const video = isDefined(this._video, '_video')
		const motionDiffCanvas = isDefined(this._motionDiffCanvas, '_motionDiffCanvas')
		const faceDetectCanvas = isDefined(this._faceDetectCanvas, '_faceDetectCanvas')

		const presenceDetector = new PresenceDetector({ diffCanvas: motionDiffCanvas, video })
		presenceDetector.onMotionScore.subscribe(motionScore => {
			this.setState({ motionScore })
		})

		this._commentator = new Commentator({
			faceApi: this._faceApi,
			presenceDetector,
			videoService: new VideoService(video, faceDetectCanvas),
		})

		this._commentator.onStatusChanged.subscribe(status => {
			this.setState({
				commentatorEmoji: status.emoji,
				commentatorState: status.state,
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
		const { trainingStatus, videoSize } = this.state
		const { width, height } = videoSize

		const startStopButtonText = this.state.commentatorState === 'idle' ? 'Start' : 'Stop'
		const buttonStyle = { padding: '1em', minWidth: '6em' }
		// const person = this.state.persons && this.state.persons[0]
		const stateStyle: StateStyle = this._commentator ? getStateStyle(this._commentator) : { color: 'back', background: 'white' }

		const trainingStatusDiv = trainingStatus ? (
			<p>
				{trainingStatus.status} {trainingStatus.lastActionDateTime} {trainingStatus.message}
			</p>) : undefined

		return (
			<div style={{ color: stateStyle.color, background: stateStyle.background }}>
				{/* <h1>Kommentator</h1> */}
				<h3>{this.state.commentatorStatus}</h3>
				<h3>{this.state.commentatorEmoji}</h3>
				<p>Detection score: {this.state.motionScore}</p>
				{trainingStatusDiv}
				<div>
					<button style={buttonStyle} onClick={this._startStopOnClick}>{startStopButtonText}</button>
					<button style={buttonStyle} onClick={this._trainPersonGroupAsync}>Train person group</button>
					<button style={buttonStyle} onClick={() => this._updatePersonGroupTrainingStatusAsync()}>Update training status</button>
				</div>
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
				<p>
					{this.state.textToSpeak ? this.state.textToSpeak : ''}
				</p>
				<p>
					{this.state.error ? 'Error happened: ' + this.state.error : ''}
				</p>
			</div>
		)
	}

	private videoOnCanPlay(ev: React.SyntheticEvent<HTMLVideoElement>) {
		const video: HTMLVideoElement = ev.target as HTMLVideoElement

		console.log('IdentifyOnPresence: Video ready to play. Calculating output height.')

		// Scale height to achieve same aspect ratio for whatever our rendered width is
		// const height = video.videoHeight / (video.videoWidth / this.state.width)
		// this.setState({ height })
	}

	private _onPresenceStateChanged(isPresenceDetected: boolean) {
		this.setState({ isPresenceDetected })
	}

	private _onMotionScore(motionScore: number) {
		// this._presenceDetector.addMotionScore(frame.score)
		this.setState({ motionScore })
	}

	private _startStopOnClick(ev: React.MouseEvent<HTMLButtonElement>) {
		this._commentator.toggleStartStop()
	}

	private async _trainPersonGroupAsync(ev: React.MouseEvent<HTMLButtonElement>) {
		console.info('Training person group...')
		await this._faceApi.trainPersonGroup()
		console.info('Training person group...DONE. Results may still take some time.')
		await this._updatePersonGroupTrainingStatusAsync()
	}

	private async _updatePersonGroupTrainingStatusAsync() {
		console.info('Query person group training status...')
		const trainingStatus = await this._faceApi.getPersonGroupTrainingStatus()
		console.info('Query person group training status...DONE.', trainingStatus)
		this.setState({trainingStatus})
	}
}

export default Component
