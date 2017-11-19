import * as FaceApiTypes from '../../docs/FaceAPI/DetectFacesResponse'

export const jokes = {
	anger: (anger: number) => [`Åååå så sinna!`],
	bald: (bald: number) => ['Trange kår og tynt med hår.'],
	beard: (beard: number) => [ `Du har en flott samling av hårstrå i ansiktet.` ],
	glasses: (glasses: FaceApiTypes.GlassType) => {
		switch (glasses) {
			case 'ReadingGlasses':
				return ['Brillefin!', 'Det fins ingen briller for kortsynt.', 'Jeg ble valgt til å lede, ikke til å lese.']

			case 'Sunglasses':
				return ['Solbriller innendørs? Kult.']

			case 'SwimmingGoggles':
				return ['Svømmebriller... Øh okei?']

			default:
				return ['Brillefin!']
		}
	},
	hairColor: (hairColor: FaceApiTypes.HairColor) => {
		return [`For et rikt og fyldig flott ${hairColor[0]} hår.`]
	},
	happiness: (happiness: number) => [`Noen er veldig fornøyde i dag!`],
	moustache: (moustache: number) => [ `Herlig bart!` ],
	neutral: (neutral: number) => [`Verken blid eller sur i dag. Midt på treet.`],
}

export default jokes
