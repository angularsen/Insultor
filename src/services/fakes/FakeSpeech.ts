import { ISpeech, ISpeechOpts, SpeakData } from '../Speech'

export class FakeSpeech implements ISpeech {
	public speak(text: string, opts?: ISpeechOpts): SpeakData {
		console.log('FakeSpeech: speaking: ' + text)

		// tslint:disable-next-line:no-object-literal-type-assertion
		const utterance: SpeechSynthesisUtterance = { text } as SpeechSynthesisUtterance

		// Simulate it takes a few seconds to speak
		const durationMs = 2000
		const completion = new Promise<SpeechSynthesisEvent>((res, rej) => setTimeout(() => {
			// tslint:disable-next-line:no-object-literal-type-assertion
			const event: SpeechSynthesisEvent = {
				elapsedTime: durationMs,
				utterance,
			} as SpeechSynthesisEvent

			res(event)
		}, durationMs))

		return {
			completion,
			// tslint:disable-next-line:no-object-literal-type-assertion
			utterance,
		}
	}
}

export default FakeSpeech
