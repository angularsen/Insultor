import * as FaceApiTypes from '../../docs/FaceAPI/DetectFacesResponse'

export const jokes = {
	anger: (anger: number) => [`Whoa.. why so angry mister?`],
	beard: (beard: number) => [
		`Who shaves 10 times a day and still has a beard? The barber.`,
	],
	glasses: (glasses: FaceApiTypes.GlassType) => {
		switch (glasses) {
			case 'ReadingGlasses':
			return 'I was elected to LEAD, not to READ.'

			case 'Sunglasses':
			return 'Dude, drop the sunglasses. It\'s not SUNNY inside!'

			case 'SwimmingGoggles':
			return 'Swimming goggles... really? REALLY!?'

			default:
			return undefined
		}
	},
	hair: (hair: FaceApiTypes.Hair) => ['Insert clever hair joke'],
	hairColor: (hairColor: FaceApiTypes.HairColor[]) => [
		`Am I seeing some grey spots inside that lush, ${hairColor[0].color} noggin?`,
	],
	happiness: (happiness: number) => [`Happy, so happy! I'm so happy today!`],
	moustache: (moustache: number) => [
		`Do you know the difference between a moustache and a gay moustache? The smell!`,
	],
	neutral: (neutral: number) => [`Lookin'.. neutral bro!`],
}

export default jokes