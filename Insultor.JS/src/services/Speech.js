const defaultVoiceURI = 'Microsoft Zira Desktop - English (United States)';
const defaultRate = 1.7; // Normal-paced speech
const defaultPitch = 0.2; // Rough, dark voice

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
			utter.text = text;

			if (this.voice) { utter.voice = this.voice; }

			// Note: some voices don't support altering params
			if (opts) {
				if (opts.voiceURI) { utter.voiceURI = opts.voiceURI; }
				if (opts.volume) { utter.volume = opts.volume; }
				if (opts.rate) { utter.rate = opts.rate; }
				if (opts.pitch) { utter.pitch = opts.pitch; }
				if (opts.lang) { utter.lang = opts.lang; }
			}

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