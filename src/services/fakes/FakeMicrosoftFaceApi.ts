import { DetectFacesResponse } from '../../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFacesResponse } from '../../../docs/FaceAPI/IdentifyFacesResponse'
import { Person } from '../../../docs/FaceAPI/Person'
import { IMicrosoftFaceApi } from '../MicrosoftFaceApi'

export class FakeMicrosoftFaceApi implements IMicrosoftFaceApi {
	constructor(
		private readonly _detectFacesAsyncResult: Promise<DetectFacesResponse> = FakeMicrosoftFaceApi.defaultDetectFacesAsyncResult) {
	}

	public getPersonAsync(personGroupId: AAGUID, personId: AAGUID): Promise<Person> {
		const result: Person = {
			name: 'Fake person name',
			persistedFaceIds: ['face face id'],
			personId: 'fake person id',
			userData: 'fake person userdata',
		}
		console.debug('FakeMicrosoftFaceApi: getPersonAsync() returns', result)
		return Promise.resolve(result)
	}

	public async detectFacesAsync(imageDataUrl: string): Promise<DetectFacesResponse> {
		const result = await this._detectFacesAsyncResult
		console.debug('FakeMicrosoftFaceApi: detectFacesAsync() returns', result)
		return result
	}

	public identifyFacesAsync(faceIds: string[], personGroupId: string): Promise<IdentifyFacesResponse> {
		const result: IdentifyFacesResponse = faceIds.map((faceId, i) => ({
			candidates: [
				{
					confidence: 0.8,
					personId: 'fake person id for face ' + faceId,
				},
			],
			faceId,
		}))
		console.debug('FakeMicrosoftFaceApi: identifyFacesAsync() returns', result)
		return Promise.resolve(result)
	}

	private static get defaultDetectFacesAsyncResult(): Promise<DetectFacesResponse> {
		const result: DetectFacesResponse = [
			{
				faceAttributes: {
					age: 35,
					gender: 'male',
				},
				faceId: 'fake face id',
			} as any,
		]
		return Promise.resolve(result)
	}

}

export default FakeMicrosoftFaceApi
