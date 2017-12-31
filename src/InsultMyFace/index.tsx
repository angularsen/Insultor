import * as React from 'react'

import Loader from '../components/loader'
import PlayPauseButton from '../components/playPauseButton'
import { Commentator, Sounds, StatusInfo } from '../services/Commentator'
import CommentProvider from '../services/CommentProvider'
import { AddPersonParams, DataStore } from '../services/DataStore'
import { DetectedFaceWithImageData } from '../services/PeriodicFaceDetector'
import { default as PresenceDetector } from '../services/PresenceDetector'
import { PersonSettings } from '../services/Settings'
import Speech from '../services/Speech'
import { checkDefined } from '../services/utils'
import { VideoService } from '../services/VideoService'

import AskToCreatePerson from './AskToCreatePerson'
import CommentOnPerson from './CommentOnPerson'
import CreatePerson from './CreatePerson'
import EmojiStatus from './EmojiStatus'

const VIDEO_WIDTH = 600
const VIDEO_HEIGHT = 600

type ViewModel = EmojiStatusViewModel | AskToCreatePersonViewModel | CreatePersonViewModel | CommentOnPersonViewModel

interface EmojiStatusViewModel {
	readonly type: 'emojiStatus'
	readonly emoji: string
	readonly status: string
}

interface AskToCreatePersonViewModel {
	readonly type: 'askToCreatePerson'
	readonly face: DetectedFaceWithImageData
}

class CreatePersonViewModel {
	public readonly type = 'createPerson'
	constructor(
		public readonly face: DetectedFaceWithImageData,
		private readonly _commentator: Commentator,
		private readonly _dataStore: DataStore,
	) { }

	public async createPersonAsync(params: AddPersonParams) {
		try {
			const settings: PersonSettings = await this._dataStore.addPersonAsync(params)
			this._commentator.createPerson_Ok({ detectedFace: this.face, personId: settings.personId, settings })
		} catch (err) {
			console.error('Failed to create person.', err)
			this._commentator.createPerson_Canceled()
		}
	}
}

interface CommentOnPersonViewModel {
	readonly type: 'commentOnPerson'
	readonly comment: string
	readonly imageDataUrl: string
	readonly name: string
}

function renderView(vm: ViewModel, commentator?: Commentator) {
	if (!commentator) { return undefined }

	switch (vm.type) {
		case 'emojiStatus':
			return <EmojiStatus emoji={vm.emoji} status={vm.status} />
		case 'askToCreatePerson':
			return <AskToCreatePerson
				face={vm.face}
				timeoutMs={10000}
				onAccept={() => commentator.askToCreatePerson_Accepted()}
				onDecline={() => commentator.askToCreatePerson_Declined()}
				onTimeout={() => commentator.askToCreatePerson_Timeout()}
			/>

		case 'createPerson':
			return <CreatePerson
				face={vm.face}
				createPerson={(person) => vm.createPersonAsync(person)}
				cancel={() => commentator.createPerson_Canceled()}
			/>

		case 'commentOnPerson':
			return <CommentOnPerson
				comment={vm.comment}
				imageDataUrl={vm.imageDataUrl}
				name={vm.name}
			/>

		default:
			return <span>¯\_(ツ)_/¯</span>
	}
}

interface State {
	viewModel: ViewModel
	error?: string
	isFaceApiActive: boolean
	motionScore: number
	videoHeight: number
	videoWidth: number
	canStart: boolean
	showDebug: boolean
}

interface Props {
	dataStore: DataStore
}

// tslint:disable-next-line:max-classes-per-file
class InsultMyFace extends React.Component<Props, State> {
	private readonly _sounds: Sounds
	private _commentator?: Commentator

	/**
	 * Copying over images from live video for sending to Microsoft Face API to detect faces.
	 */
	private _faceDetectCanvas?: HTMLCanvasElement

	/** Diff calculation canvas by rendering new frames with a 'difference' filter on top of previous frames. */
	private _diffCalcCanvas?: HTMLCanvasElement
	/** Resulting diff image. */
	private _diffResultCanvas?: HTMLCanvasElement

	/**
	 * Live video element.
	 */
	private _video?: HTMLVideoElement

	constructor(props: Props) {
		super(props)

		const viewModel: EmojiStatusViewModel = {
			emoji: 'meh',
			status: '',
			type: 'emojiStatus',
		}

		this.state = {
			canStart: false,
			viewModel,
			isFaceApiActive: false,
			motionScore: 0,
			videoHeight: VIDEO_HEIGHT,
			videoWidth: VIDEO_WIDTH,
			showDebug: false,
		}

		this._onMotionScore = this._onMotionScore.bind(this)
		this._onMotionScore = this._onMotionScore.bind(this)

		this._sounds = new Sounds()
	}

	public componentDidMount() {
		console.log('Mounted InsultMyFace.')
		const video = checkDefined(this._video, '_video')
		const faceDetectCanvas = checkDefined(this._faceDetectCanvas, '_faceDetectCanvas')
		const diffCalcCanvas = checkDefined(this._diffCalcCanvas, '_diffCalcCanvas')
		const diffResultCanvas = checkDefined(this._diffResultCanvas, '_diffResultCanvas')

		const presenceDetector = new PresenceDetector({ diffCalcCanvas, diffResultCanvas, video })

		const commentator = new Commentator({
			commentProvider: new CommentProvider(this.props.dataStore.settingsStore),
			dataStore: this.props.dataStore,
			presenceDetector,
			speech: new Speech(),
			videoService: new VideoService(video, faceDetectCanvas, VIDEO_WIDTH, VIDEO_HEIGHT),
			sounds: this._sounds,
		})
		this._commentator = commentator

		presenceDetector.onMotionScore.subscribe(motionScore => {
			this.setState({ motionScore })
		})

		this.props.dataStore.faceApi.onActivity.subscribe(active => {
			this.setState({ isFaceApiActive: active })
		})

		commentator.onAskToCreatePerson.subscribe(personToCreate => {
			const viewModel: AskToCreatePersonViewModel = {
				face: personToCreate.face,
				type: 'askToCreatePerson',
			}
			this.setState({ viewModel })
		})

		commentator.onCreatePerson.subscribe(personToCreate => {
			const viewModel = new CreatePersonViewModel(personToCreate.face, commentator, this.props.dataStore)
			this.setState({ viewModel })
		})

		commentator.onStatusChanged.subscribe(status => {
			const viewModel: EmojiStatusViewModel = this._createEmojiStatusVm(status)
			this.setState({
				viewModel,
				canStart: commentator.can('start'),
			})
		})

		commentator.onSpeak.subscribe(commentData => {
			const viewModel: CommentOnPersonViewModel = {
				comment: commentData.comment,
				imageDataUrl: commentData.person.detectedFace.imageDataUrl,
				name: commentData.person.settings.name,
				type: 'commentOnPerson',
			}

			this.setState({ viewModel })
		})

		// Commentator instance created
		this.setState({
			canStart: true,
			viewModel: this._createEmojiStatusVm(commentator.status),
		})
	}

	public componentWillUnmount() {
		console.log('Unmounting InsultMyFace.')
		if (this._commentator) { this._commentator.stop() }
	}

	public render() {
		const { viewModel, canStart } = this.state

		return (
			<div className = 'container-fludi' >
				<div className='row no-gutters'>
					<div className='col'>
						<div hidden={!this.state.isFaceApiActive}>
							<Loader />
						</div>

						<PlayPauseButton
							canStart={canStart}
							onStart={(event) => this._onClickStart(event)}
							onStop={() => this._onClickStop()} />

						<div style={{ color: 'white', background: '#111', minHeight: '92vh', width: '100%' }}>
							{renderView(viewModel, this._commentator)}
						</div>

						<div style={{ position: 'absolute', bottom: '.5em', right: '.5em' }}>
							<button role='button' type='button' className='btn btn-outline-secondary'
								onClick={() => this.setState({ showDebug: !this.state.showDebug })}>⚙</button>
						</div>

						<div hidden={!this.state.showDebug}>
							<h3>Detaljer</h3>
							<p>Bevegelsespoeng: {this.state.motionScore}</p>
							<div className='camera'>
								<video style={{ border: '1px solid lightgrey', width: '100%' }} id='video' ref={(video) => this._video = video || undefined}
									onCanPlay={ev => this.videoOnCanPlay(ev.target as HTMLVideoElement)}>Video stream not available.</video>
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
				</div>
			</div >
		)
	}

	private _onClickStart(ev: React.MouseEvent<HTMLButtonElement>) {
		if (this._commentator) { this._commentator.start() }
		this._sounds.loadSoundsOnUserInteractionEvent(ev)
	}

	private _onClickStop() {
		if (this._commentator) { this._commentator.stop() }
	}

	private videoOnCanPlay(video: HTMLVideoElement) {
		console.debug('InsultMyFace: Video ready to play.', video)
	}

	private _onMotionScore(motionScore: number) {
		this.setState({ motionScore })
	}

	private _createEmojiStatusVm(status: StatusInfo): EmojiStatusViewModel {
		return {
			emoji: status.emoji,
			status: status.text,
			type: 'emojiStatus',
		}
	}

}

export default InsultMyFace
