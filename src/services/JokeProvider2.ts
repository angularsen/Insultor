import { DetectFaceResult, Emotion, GlassType } from '../../docs/FaceAPI/DetectFacesResponse'
import { jokes } from './jokes'

function getRandom(items: any[]) {
	return items[Math.floor(Math.random() * items.length)]
}

function flatten(arr: any[][]) {
	return arr.reduce((acc, cur) => [...acc, ...cur], [])
}

export class JokeProvider {

	public getJoke(faceAnalysis: DetectFaceResult): string {
		if (faceAnalysis === undefined) return 'No joke for you!'

		const { faceAttributes } = faceAnalysis
		const { age, emotion, facialHair, gender, glasses, hair, smile, } = faceAttributes
		const { bald, invisible, hairColor } = hair

		const moustacheJoke = (facialHair && facialHair.moustache && facialHair.moustache >= 0.5)
			? jokes.moustache(facialHair.moustache) : []

		const beardJoke = (facialHair && facialHair.beard && facialHair.beard >= 0.5) ? jokes.beard(facialHair.beard) : []
		const hairJoke = (hairColor && hairColor.length > 0) ? jokes.hairColor(hairColor) : []

		const getEmotionJoke = (e: Emotion) => {
			if (e && e.neutral >= 0.9) { return [`Lookin'.. neutral bro!`] }
			if (e.anger >= 0.6) { return [`Whoa.. why so angry mister?`] }
			if (e.happiness >= 0.6) { return [`Happy, so happy! I'm so happy today!`] }
			return []
		}

		const emotionJoke = getEmotionJoke(emotion)
		const glassesJoke = jokes.glasses(glasses)

		const jokesArr = flatten([moustacheJoke, beardJoke, hairJoke, emotionJoke, glassesJoke])
		return getRandom(jokesArr)
	}
}

export default JokeProvider
