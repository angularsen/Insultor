import { DetectFaceResult, Emotion } from '../../docs/FaceAPI/DetectFacesResponse'
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
		const { /*age, gender, smile, */ emotion, facialHair, glasses, hair } = faceAttributes
		const { /*bald, invisible,*/ hairColor } = hair

		const moustacheJoke = (facialHair && facialHair.moustache && facialHair.moustache >= 0.5)
			? jokes.moustache(facialHair.moustache) : []

		const beardJoke = (facialHair && facialHair.beard && facialHair.beard >= 0.5) ? jokes.beard(facialHair.beard) : []
		const hairJoke = (hairColor && hairColor.length > 0) ? jokes.hairColor(hairColor[0]) : []

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

	public randomJoke() {
		// TODO Aggregate all jokes somehow
		return jokes.anger(1)[0]
	}

	public randomWifeyMorningCompliment() {
		const wifeyCompliments = [
			'You look absolutely stunning this morning!',
		]

		const feelGoodQuotes = [
			'This will be a great day, now go enjoy it!',
			'Yesterday is HISTORY, tomorrow is a MYSTERY, but TODAY is a GIFT; that’s why we call it the PRESENT',
			'Be Thankful for What You Have... and You Will End Up Having More',
		]

		return getRandom(wifeyCompliments.concat(feelGoodQuotes))
	}

}

export default JokeProvider
