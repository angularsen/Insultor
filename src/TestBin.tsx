import * as React from 'react'
import * as ReactDOM from 'react-dom'

import JokeProvider from './services/JokeProvider'
import Speech, { ISpeechOpts } from './services/Speech'

const speech = new Speech()

interface State {
	error?: string
	textToSpeak?: string
}

class Component extends React.Component<{}, State> {
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

}

export default Component
