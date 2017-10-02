import { jokes } from './jokes';

class JokeProvider {

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
}

export default JokeProvider;