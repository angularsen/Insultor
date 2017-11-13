import { DetectFacesResponse } from '../../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFacesResponse } from '../../../docs/FaceAPI/IdentifyFacesResponse'
import { AddPersonFaceResponse, CreatePersonResponse, Person, UserData } from '../../../docs/FaceAPI/Person'
import PersonGroupTrainingStatus from '../../../docs/FaceAPI/PersonGroupTrainingStatus'
import { IMicrosoftFaceApi } from '../MicrosoftFaceApi'

export class FakeMicrosoftFaceApi implements IMicrosoftFaceApi {
	constructor(
		private readonly _detectFacesAsyncResult: Promise<DetectFacesResponse> = FakeMicrosoftFaceApi.defaultDetectFacesAsyncResult) {
	}

	public addPersonFaceAsync(personId: string, imageDataUrl: string): Promise<AddPersonFaceResponse> {
		throw new Error('Method not implemented.')
	}
	public createPersonAsync(name: string, userData?: UserData): Promise<CreatePersonResponse> {
		throw new Error('Method not implemented.')
	}
	public createAnonymousPersonWithFacesAsync(imageDataUrls: string[]): Promise<Person> {
		throw new Error('Method not implemented.')
	}
	public getPersonsAsync(): Promise<Person[]> {
		throw new Error('Method not implemented.')
	}
	public getPersonGroupTrainingStatus(): Promise<PersonGroupTrainingStatus> {
		throw new Error('Method not implemented.')
	}
	public trainPersonGroup(): Promise<void> {
		throw new Error('Method not implemented.')
	}

	public getPersonAsync(personId: AAGUID): Promise<Person> {
		const result: Person = {
			name: 'Fake person name',
			persistedFaceIds: ['face face ID'],
			personId,
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

	public identifyFacesAsync(faceIds: string[]): Promise<IdentifyFacesResponse> {
		const result: IdentifyFacesResponse = faceIds.map((faceId, i) => ({
			candidates: [
				{
					confidence: 0.8,
					personId: `fake person id for face [${faceId}]`,
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
		console.debug('FakeMicrosoftFaceApi: defaultDetectFacesAsyncResult() returns', result)
		return Promise.resolve(result)
	}

}

export default FakeMicrosoftFaceApi
