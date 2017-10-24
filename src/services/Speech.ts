// Normal-paced Norwegian speech
const defaultOpts: ISpeechOpts = {
	// voiceURI: 'Microsoft David Desktop - English (United States)',
	lang: 'nb-NO',
	rate: 2,
	// pitch: 0.15
}

export interface ISpeechOpts {
	voiceURI?: string
	lang?: string
	rate?: number
	pitch?: number
}

export interface ISpeech {
	speak(text: string, opts?: ISpeechOpts): void
}

export class Speech {
	constructor() {
		const canSpeak = 'speechSynthesis' in window
		if (!canSpeak) {
			alert('Text to speech not available on this device.')
		}
	}

	public speak(text: string, opts: ISpeechOpts) {

		return new Promise((resolve, reject) => {
			const utter = new SpeechSynthesisUtterance()

			// Note: some voices don't support altering params
			Object.assign(utter, defaultOpts, opts, { text })

			utter.onerror = (ev: ErrorEvent) => {
				console.error('Speech failed: ' + utter.text, utter, ev)
				reject(ev.error)
			}

			utter.onend = (ev: Event) => {
				console.info('Speech completed: ' + utter.text, utter)
				resolve(ev)
			}

			window.speechSynthesis.speak(utter)
		})
	}
}

export default Speech
