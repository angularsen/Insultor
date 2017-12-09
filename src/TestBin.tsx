import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { faceApiConfig } from './services/constants'
import JokeProvider from './services/JokeProvider'
import { MicrosoftFaceApi } from './services/MicrosoftFaceApi'
import Speech, { ISpeechOpts } from './services/Speech'
import { settingsStore } from './services/Settings';

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
							<button style={buttonStyle} onClick={ev => this._deleteIncompletePersons()}>Slett ukomplette personer</button>
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
		console.debug('Get all persons in person group...')
		const persons = await this._faceApi.getPersonsAsync()
		console.info('Get all persons in person group...DONE.', persons)
	}

	private async _trainPersonGroupAsync() {
		console.debug('Training person group...')
		await this._faceApi.trainPersonGroup()
		console.info('Training person group...DONE. Results may still take some time.')
		await this._updatePersonGroupTrainingStatusAsync()
	}

	private async _updatePersonGroupTrainingStatusAsync() {
		console.debug('Query person group training status...')
		const trainingStatus = await this._faceApi.getPersonGroupTrainingStatus()
		console.info('Query person group training status...DONE.', trainingStatus)
		alert('Status trening av ansikter i persongruppe:\n' + JSON.stringify(trainingStatus))
	}

	private async _deleteIncompletePersons() {
		console.debug('Delete incomplete persons...')
		const faceApiPersons = await this._faceApi.getPersonsAsync()
		const settings = await settingsStore.getSettingsAsync()

		const faceApiPersonsWithoutSettings = faceApiPersons.filter(fp => settings.persons.findIndex(sp => sp.personId === fp.personId) < 0)
		const settingsPersonsWithoutFaceApi = settings.persons.filter(sp => faceApiPersons.findIndex(fp => sp.personId === fp.personId) < 0)

		if (faceApiPersonsWithoutSettings.length === 0 && settingsPersonsWithoutFaceApi.length === 0) {
			console.info('No incomplete persons found in settings or in Face API.')
			return
		}

		if (faceApiPersonsWithoutSettings.length > 0) {
			try {
			console.debug(`Delete ${faceApiPersonsWithoutSettings.length} persons from Face API without settings entry...`)
			await Promise.all(faceApiPersonsWithoutSettings.map(p => this._faceApi.deletePersonAsync(p.personId)))
			console.info(`Delete ${faceApiPersonsWithoutSettings.length} persons from Face API without settings entry...OK.`)
			} catch (err) {
				console.error(`Failed to delete one or more Face API persons.`, err)
			}
		}

		if (settingsPersonsWithoutFaceApi.length > 0) {
			try {
				console.debug(`Delete ${settingsPersonsWithoutFaceApi.length} persons from settings without Face API entry...`)
				await Promise.all(settingsPersonsWithoutFaceApi.map(p => settingsStore.deletePersonAsync(p.personId)))
				console.info(`Delete ${settingsPersonsWithoutFaceApi.length} persons from settings without Face API entry...OK.`)
			} catch (err) {
				console.error(`Failed to delete one or more persons from settings.`, err)
			}
		}

		console.info('Delete incomplete persons...OK.')
	}
}

export default Component
