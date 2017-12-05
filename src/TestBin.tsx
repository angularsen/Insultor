import * as React from 'react'
import * as ReactDOM from 'react-dom'

import JokeProvider from './services/JokeProvider'
import Speech, { ISpeechOpts } from './services/Speech'
import { MicrosoftFaceApi } from 'src/services/MicrosoftFaceApi';
import { faceApiConfig } from 'src/services/constants';

const speech = new Speech()

interface State {
	error?: string
	textToSpeak?: string
}

class Component extends React.Component<{}, State> {
	private readonly _faceApi: MicrosoftFaceApi = new MicrosoftFaceApi(
			faceApiConfig.myPersonalSubscriptionKey,
			faceApiConfig.endpoint,
			faceApiConfig.webstepPersonGroupId)

	constructor(props: {}) {
		super(props)

		this.state = {
		}
	}

	public render() {
		console.log('Render')

		const buttonStyle = { padding: '1em', minWidth: '6em' }

		return (
			<div className='container'>
				<div className='row'>
					<div className='col'>
						<h1 className='display-4'>TestBin</h1>
						<div>
							<button style={buttonStyle} onClick={ev => this.speakRandomJoke()}>Insult me now!</button>
							<button style={buttonStyle} onClick={ev => this.didWifeyAppearAndItIsMorning()}>Wifey appears in the morning</button>
							<button style={buttonStyle} onClick={ev => this.onBigChiefAppearAnItIsdMorning()}>The big chief appears in the morning</button>
							<button style={buttonStyle} onClick={ev => this.speakNorwegian()}>Si noe norsk</button>
							<button style={buttonStyle} onClick={ev => this.speakEnglish()}>Say something English</button>
							<button style={buttonStyle} onClick={ev => this._trainPersonGroupAsync()}>Train person group</button>
							<button style={buttonStyle} onClick={ev => this._updatePersonGroupTrainingStatusAsync()}>Update training status</button>
							<button style={buttonStyle} onClick={ev => this._logAllPersonsAsync()}>List persons (log)</button>
						</div>
						<p>
							{this.state.textToSpeak ? this.state.textToSpeak : ''}
						</p>
						<p>
							{this.state.error ? 'Error happened: ' + this.state.error : ''}
						</p>
					</div>
				</div>
			</div>
		)
	}

	public speakRandomJoke() {
		const joke = new JokeProvider().randomJoke()
		this.speak(joke, {})
	}

	public speak(msg: string, opts?: ISpeechOpts) {
		this.setState({ textToSpeak: msg })
		speech.speak(msg, opts)
	}

	public didWifeyAppearAndItIsMorning() {
		console.info('Wifey appeared and it is morning.')
		const text = new JokeProvider().randomWifeyMorningCompliment()
		this.speak(text)
	}

	public onBigChiefAppearAnItIsdMorning() {
		console.info('The big chief appeared and it is morning.')
		const text = new JokeProvider().randomWifeyMorningCompliment()
		this.speak(text)
	}

	public speakNorwegian() {
		this.speak('En setning på norsk!', {lang: 'nb-NO', rate: 2})
	}

	public speakEnglish() {
		this.speak('A sentence in English!', {lang: 'en-US', rate: 2})
	}

	private async _logAllPersonsAsync(): Promise<void> {
		console.info('Get all persons in person group...')
		const persons = await this._faceApi.getPersonsAsync()
		console.info('Get all persons in person group...DONE.', persons)
	}

	private async _trainPersonGroupAsync() {
		console.info('Training person group...')
		await this._faceApi.trainPersonGroup()
		console.info('Training person group...DONE. Results may still take some time.')
		await this._updatePersonGroupTrainingStatusAsync()
	}

	private async _updatePersonGroupTrainingStatusAsync() {
		console.info('Query person group training status...')
		const trainingStatus = await this._faceApi.getPersonGroupTrainingStatus()
		console.info('Query person group training status...DONE.', trainingStatus)
		alert('Status trening av ansikter i persongruppe:\n' + JSON.stringify(trainingStatus))
	}
}

export default Component
