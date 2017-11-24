import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { Person } from '../docs/FaceAPI/Person'
import PersonGroupTrainingStatus from '../docs/FaceAPI/PersonGroupTrainingStatus'
import Loader from './components/loader'
import { default as Commentator, DeliverCommentData, State as CommentatorState } from './services/Commentator'
import CommentProvider from './services/CommentProvider'
import FaceApi, { MicrosoftFaceApi } from './services/MicrosoftFaceApi'
import { default as PresenceDetector } from './services/PresenceDetector'
import Speech from './services/Speech'
import { isDefined } from './services/utils/index'
import { VideoService } from './services/VideoService'
import { defaultSettings, Settings } from './Settings'

const VIDEO_WIDTH = 600
const VIDEO_HEIGHT = 600

const faceApiConfig = {
	endpoint: 'https://northeurope.api.cognitive.microsoft.com/face/v1.0/',
	myPersonalSubscriptionKey: 'e3778e3dab7c46bba4b0af4dcd3df272',
	webstepPersonGroupId: 'insultor-webstep-trd',
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

async function getSettingsAsync(): Promise<Settings> {
	const url = 'https://rawgit.com/angularsen/08998fe7673b485de800a4c1c1780e62/raw/08473af35b7dd7b8d32ab4ec13ed5670bea60b32/settings.json'
	const res = await fetch(url)
	const ok = res.status >= 200 && res.status <= 300
	if (!ok) {
		console.warn('Failed to get settings.', res)
		return defaultSettings
	}

	const settings: Settings = await res.json()
	if (!settings || !settings.persons) {
		console.error('Invalid settings stored.', settings)
		return defaultSettings
	}

	console.info('Loaded settings.', settings)
	return settings
}

interface State {
	error?: string
	isPresenceDetected: boolean
	commentatorState: CommentatorState
	commentatorStatus: string
	commentatorEmoji: string
	isFaceApiActive: boolean
	motionScore: number
	/** App settings  */
	settings: Settings
	/** Currently speaking this text, undefined otherwise. */
	commentData?: DeliverCommentData
	/** Last polled training status */
	trainingStatus?: PersonGroupTrainingStatus
	videoHeight: number
	videoWidth: number
}

interface StateStyle {
	background: string
	color: string
}

class Component extends React.Component<any, State> {
	private _faceApi: MicrosoftFaceApi
	private _commentator: Commentator
	private readonly _settingsPromise: Promise<Settings>

	/**
	 * Copying over images from live video for sending to Microsoft Face API to detect faces.
	 */
	private _faceDetectCanvas?: HTMLCanvasElement

	/** Diff calculation canvas by rendering new frames with a 'difference' filter on top of previous frames. */
	private _diffCalcCanvas?: HTMLCanvasElement
	/** Resulting diff image. */
	private _diffResultCanvas?: HTMLCanvasElement

	private readonly _speech = new Speech()

	/**
	 * Live video element.
	 */
	private _video?: HTMLVideoElement

	constructor() {
		super()

		this.state = {
			commentatorEmoji: '😶',
			commentatorState: 'idle',
			commentatorStatus: 'Ikke startet enda...',
			isFaceApiActive: false,
			isPresenceDetected: false,
			motionScore: 0,
			settings: defaultSettings,
			trainingStatus: undefined,
			videoHeight: VIDEO_WIDTH,
			videoWidth: VIDEO_HEIGHT,
		}

		this._faceApi = new MicrosoftFaceApi(
			faceApiConfig.myPersonalSubscriptionKey,
			faceApiConfig.endpoint,
			faceApiConfig.webstepPersonGroupId)

		this._settingsPromise = getSettingsAsync()

		this._onMotionScore = this._onMotionScore.bind(this)
		this._onPresenceStateChanged = this._onPresenceStateChanged.bind(this)
		this._onMotionScore = this._onMotionScore.bind(this)
		this._startStopOnClick = this._startStopOnClick.bind(this)
		this._trainPersonGroupAsync = this._trainPersonGroupAsync.bind(this)
		this._updatePersonGroupTrainingStatusAsync = this._updatePersonGroupTrainingStatusAsync.bind(this)
	}

	public componentDidMount() {
		console.log('Mounted InsultMyFace.')
		const video = isDefined(this._video, '_video')
		const faceDetectCanvas = isDefined(this._faceDetectCanvas, '_faceDetectCanvas')
		const diffCalcCanvas = isDefined(this._diffCalcCanvas, '_diffCalcCanvas')
		const diffResultCanvas = isDefined(this._diffResultCanvas, '_diffResultCanvas')

		const presenceDetector = new PresenceDetector({ diffCalcCanvas, diffResultCanvas, video })
		presenceDetector.onMotionScore.subscribe(motionScore => {
			this.setState({ motionScore })
		})

		this._commentator = new Commentator({
			commentProvider: new CommentProvider(this._settingsPromise),
			faceApi: this._faceApi,
			presenceDetector,
			speech: this._speech,
			videoService: new VideoService(video, faceDetectCanvas, VIDEO_WIDTH, VIDEO_HEIGHT),
		})

		this._commentator.onHasFaceApiActivity.subscribe(active => {
			this.setState({
				isFaceApiActive: active,
			})
		})

		this._commentator.onStatusChanged.subscribe(status => {
			this.setState({
				commentatorEmoji: status.emoji,
				commentatorState: status.state,
				commentatorStatus: status.text,
			})
		})

		this._commentator.onSpeak.subscribe(commentData => {
			commentData.speech.completion.then(ev => {
				this.setState({
					commentData: undefined,
				})
			})

			this.setState({
				commentData,
			})
		})
	}

	public componentWillUnmount() {
		console.log('Unmounting InsultMyFace.')
		this._commentator.stop()
	}

	public render() {
		const { commentData, trainingStatus } = this.state

		const startStopButtonText = this.state.commentatorState === 'idle' ? 'Start' : 'Stop'
		const buttonStyle = { padding: '1em', minWidth: '6em' }
		const stateStyle: StateStyle = this._commentator ? getStateStyle(this._commentator) : { color: 'back', background: 'white' }

		const trainingStatusDiv = trainingStatus ? (
			<p>
				{trainingStatus.status} {trainingStatus.lastActionDateTime} {trainingStatus.message}
			</p>) : undefined

		const tmp = commentData ? (
			<div>
					<div style={{ textAlign: 'center', fontSize: 49/* too large for chrome Android '10em'*/ }}>{this.state.commentatorEmoji}</div>
					<div style={{ textAlign: 'center', fontSize: '2em' }}><span>{commentData.name}</span></div>
					<div style={{ textAlign: 'center', fontSize: '1.2em' }}><span>{commentData.speech.utterance.text}</span></div>
					<div style={{ textAlign: 'center' }}><img src={commentData.imageDataUrl} style={{ width: 400 }} /></div>
			</div>
				) : (
				<div>
					<div style={{ textAlign: 'center', fontSize: 54/* too large for chrome Android '10em'*/ }}>{this.state.commentatorEmoji}</div>
					<div style={{ textAlign: 'center', fontSize: '2em' }}>{this.state.commentatorStatus}</div>
				</div>
				)

		return (
			<div>
				<div hidden={!this.state.isFaceApiActive}>
					<Loader />
				</div>
				<div style={{ color: 'white', background: 'black', minHeight: '500px', width: '100%' }}>
					{tmp}
				</div>

				<div style={{ color: stateStyle.color, background: stateStyle.background }}>
					<p>Detection score: {this.state.motionScore}</p>
					{trainingStatusDiv}
					<div>
						<button style={buttonStyle} onClick={this._startStopOnClick}>{startStopButtonText}</button>
						<button style={buttonStyle} onClick={() => this._speakRandom()}>Si noe</button>
						<button style={buttonStyle} onClick={this._trainPersonGroupAsync}>Train person group</button>
						<button style={buttonStyle} onClick={() => this._updatePersonGroupTrainingStatusAsync()}>Update training status</button>
						<button style={buttonStyle} onClick={() => this._getAllPersons()}>List persons (log)</button>
					</div>
					<div className='camera'>
						<video style={{ border: '1px solid lightgrey', width: '100%' }} id='video' ref={(video) => this._video = video || undefined}
							onCanPlay={ev => this.videoOnCanPlay(ev)}>Video stream not available.</video>
					</div>
					<div>
						<canvas style={{ border: '1px solid lightgrey' }} id='diff-calc-canvas'
							width={64} height={64}
							ref={(canvas) => this._diffCalcCanvas = canvas || undefined}></canvas>
						<canvas style={{ border: '1px solid lightgrey' }} id='diff-result-canvas'
							width={64} height={64}
							ref={(canvas) => this._diffResultCanvas = canvas || undefined}></canvas>
					</div>
					<div>
						<canvas style={{ border: '1px solid lightgrey', width: '100%' }} id='faceapi-canvas'
						width={this.state.videoWidth} height={this.state.videoHeight}
							ref={(canvas) => this._faceDetectCanvas = canvas || undefined}></canvas>
					</div>
					<p>
						{this.state.error ? 'Error happened: ' + this.state.error : ''}
					</p>
				</div>
			</div>
		)
	}

	private videoOnCanPlay(ev: React.SyntheticEvent<HTMLVideoElement>) {
		const video: HTMLVideoElement = ev.target as HTMLVideoElement

		console.log('InsultMyFace: Video ready to play.')
	}

	private _onPresenceStateChanged(isPresenceDetected: boolean) {
		this.setState({ isPresenceDetected })
	}

	private _onMotionScore(motionScore: number) {
		this.setState({ motionScore })
	}

	private _startStopOnClick(ev: React.MouseEvent<HTMLButtonElement>) {
		this._commentator.toggleStartStop()
	}

	private async _getAllPersons(): Promise<void> {
		console.info('Get all persons in person group...')
		const persons: Person[] = await this._faceApi.getPersonsAsync()
		console.info('Get all persons in person group...DONE.', persons)
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

	private _speakRandom() {
		this._speech.speak('Dette er en setning for å teste norsk.')
	}
}

export default Component
