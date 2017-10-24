import { ISpeech, ISpeechOpts } from '../Speech'

export class FakeSpeech implements ISpeech {
	public speak(text: string, opts?: ISpeechOpts) {
		console.log('FakeSpeech: speaking: ' + text)
	}
}

export default FakeSpeech
