// Normal-paced speech, rough dark voice
const defaultOpts = {
	voiceURI: 'Microsoft David Desktop - English (United States)',
	rate: 1.6,
	pitch: 0.15
};

class Speech {
	constructor() {
		const canSpeak = 'speechSynthesis' in window;
		if (!canSpeak) {
			alert('Text to speech not available on this device.');
		}
		const localVoices = window.speechSynthesis.getVoices().filter(v => v.localService);
		this.voice = localVoices.find(v => v.voiceURI === defaultVoiceURI) || localVoices[0] || undefined; // Fall back to default
	}

	speak(text, opts) {

		return new Promise((resolve, reject) => {
			var utter = new SpeechSynthesisUtterance();

			// Note: some voices don't support altering params
			Object.assign(utter, defaultOpts, opts, { text });

			utter.onerror = (_, ev) => {
				console.error('Speech failed: ' + utter.msg, utter, ev);
				reject(err);
			}

			utter.onend = (_, ev) => {
				console.info('Speech completed: ' + utter.msg, utter);
				resolve(ev);
			};

			window.speechSynthesis.speak(utter);
		});
	}
}


export default Speech;