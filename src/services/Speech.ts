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
	speak(text: string, opts?: ISpeechOpts): SpeakData
}

export interface SpeakData {
	utterance: SpeechSynthesisUtterance
	completion: Promise<SpeechSynthesisEvent>
}

export class Speech implements ISpeech {
	constructor() {
		const canSpeak = 'speechSynthesis' in window
		if (!canSpeak) {
			alert('Text to speech not available on this device.')
		}
	}

	public speak(text: string, opts: ISpeechOpts): SpeakData {

		const utter = new SpeechSynthesisUtterance()

		const completion = new Promise<SpeechSynthesisEvent>((resolve, reject) => {
			// Note: some voices don't support altering params
			Object.assign(utter, defaultOpts, opts, { text })

			utter.onerror = (ev: ErrorEvent) => {
				console.error('Speech failed: ' + utter.text, utter, ev)
				reject(ev.error)
			}

			utter.onend = (ev: SpeechSynthesisEvent) => {
				console.info('Speech completed: ' + utter.text, utter)
				resolve(ev)
			}

			window.speechSynthesis.speak(utter)
		})

		return {
			completion,
			utterance: utter,
		}
	}
}

export default Speech
