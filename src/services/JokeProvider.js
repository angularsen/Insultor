import jokes from './jokes';

function getRandom(items) {
	return items[Math.floor(Math.random() * items.length)];
}

class JokeProvider {

  /**
   * 
   * @param {*} faceDetectResult The face detection result (face_detect_res.json)
   * @param {*} optionalIdentifiedPerson Optional, the identified person (person_res.json)
   */
  getCommentForPerson(faceDetectResult, optionalIdentifiedPerson) {
    
  }

  getJoke(faceAnalysis) {
    if (faceAnalysis === undefined) return 'No joke for you!';

    const { faceAttributes } = faceAnalysis;
    const { smile, gender, age, facialHair, glasses, emotion, hair } = faceAttributes;
    const { bald, invisible, hairColor } = hair;
    const moustacheJoke = facialHair && facialHair.moustache && facialHair.moustache >= 0.5 ? jokes.moustache(facialHair.moustache) : undefined;
    const beardJoke = facialHair && facialHair.beard && facialHair.beard >= 0.5 ? jokes.beard(facialHair.beard) : undefined;
    const hairJoke = hairColor && hairColor.length > 0 ? jokes.hairColor(hairColor[0]) : undefined;
    const emotionJoke = emotion && emotion.neutral >= 0.9
      ? `Lookin'.. neutral bro!`
      : emotion.anger >= 0.6
        ? `Whoa.. why so angry mister?`
        : emotion.happiness >= 0.6
          ? `Happy, so happy! I'm so happy today!`
          : undefined;

    const glassesJoke = this.getGlassesJoke(glasses);

    const jokes = [moustacheJoke, beardJoke, hairJoke, emotionJoke, glassesJoke].filter(joke => joke !== undefined);
    return jokes.join('<br />');
  }

  randomJoke() {
		// TODO Aggregate all jokes somehow
		return jokes.anger(1)[0];
	}
	
	randomWifeyMorningCompliment() {
		const wifeyCompliments = [
			'You look absolutely stunning this morning!',
		];

		const feelGoodQuotes = [
			'This will be a great day, now go enjoy it!',
			'Yesterday is HISTORY, tomorrow is a MYSTERY, but TODAY is a GIFT; that’s why we call it the PRESENT',
			'Be Thankful for What You Have... and You Will End Up Having More'
		];

		return getRandom(wifeyCompliments.concat(feelGoodQuotes));
	}

}

export default JokeProvider;