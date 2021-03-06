import { DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
import { AddPersonFaceResponse, CreatePersonResponse, Person, UserData } from '../../docs/FaceAPI/Person'
import PersonGroupTrainingStatus from '../../docs/FaceAPI/PersonGroupTrainingStatus'

import { withTimeout } from './utils/'
import { EventDispatcher, IEvent } from './utils/Events'

const FACE_ATTRIBUTES = 'age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise'
const TIMEOUT = 20000

async function ensureSuccessAsync(res: Response) {
	if (!res.ok) {
		switch (res.status) {
			case 429: {
				throw new ThrottledHttpError('Rate limit exceeded.', res)
			}
			default: {
				throw new HttpError(`Request failed with status ${res.status} ${res.statusText}`, res)
			}
		}
	}
}

export interface IMicrosoftFaceApi {
	/** Event raised on change in whether requests are currently in flight or not. */
	readonly onActivity: IEvent<boolean>
	/** Add face image to a person in a person group. */
	addPersonFaceWithImageBlobAsync(personId: AAGUID, imageDataUrl: AAGUID): Promise<AddPersonFaceResponse>
	/** Add face image to a person in a person group. */
	addPersonFaceWithUrlAsync(personId: AAGUID, imageUrl: string): Promise<AddPersonFaceResponse>
	/** Create a person in a person group. */
	createPersonAsync(name: string, userData?: UserData): Promise<CreatePersonResponse>
	/** Create an anonymous person in a person group given one or more persisted face IDs from @see detectFacesAsync */
	createAnonymousPersonWithFacesAsync(imageDataUrls: string[]): Promise<Person>
	/** Remove person from this person group. */
	removePersonAsync(personId: AAGUID): Promise<void>
	/**
	 * Detect face and analyze facial attributes of photo with Microsoft Face API.
	 * @param {string} imageDataUrl URL encoded representation of image, obtained by canvas.toDataUrl()
	 * @returns Promise that on success returns an array of face entries ranked by face rectangle size in descending order,
	 * otherwise returns the error.
	 * An empty response indicates no faces detected.
	 * Face entry shape: { faceId: string, faceRectangle: Object, faceLandmarks: Object, faceAttributes: Object }
	 * @see https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395236
	 */
	detectFacesAsync(imageDataUrl: string): Promise<DetectFacesResponse>
	/** Get person in person group. */
	getPersonAsync(personId: AAGUID): Promise<Person>
	/** Get all persons in person group. */
	getPersonsAsync(): Promise<Person[]>
	/** Get person group face image training status. */
	getPersonGroupTrainingStatusAsync(): Promise<PersonGroupTrainingStatus>
	/**
	 * Identify up to 10 faces given a list of face IDs from a prior call to detectFaces().
	 * @param {Array} Array of query faces faceIds, created by the detectFace(). Each of the faces are identified independently.
	 * The valid number of faceIds is between [1, 10].
	 * @returns Promise that on success returns the identified candidate person(s) for each query face. Otherwise returns the error.
	 * @see https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395239
	 */
	identifyFacesAsync(faceIds: AAGUID[]): Promise<IdentifyFacesResponse>
	/** Start training the persisted face images for identifying faces later. */
	trainPersonGroupAsync(): Promise<void>
}

export class MicrosoftFaceApi implements IMicrosoftFaceApi {
	public get onActivity(): IEvent<boolean> { return this._onActivityDispatcher }
	private readonly _onActivityDispatcher = new EventDispatcher<boolean>()

	constructor(
		private readonly _subscriptionKey: string,
		private readonly _endpoint: string,
		private readonly _personGroupId: string,
	) {
	}

	public async addPersonFaceWithUrlAsync(personId: AAGUID, imageUrl: string): Promise<AddPersonFaceResponse> {
		console.debug(`Adding person face personId[${personId}], imageUrl[${imageUrl}].`)

		const headers = this._getDefaultHeaders('application/json')
		const body = JSON.stringify({
			url: imageUrl,
		})
		return this._addPersonFaceAsync(personId, headers, body)
	}

	public async addPersonFaceWithImageBlobAsync(personId: AAGUID, imageDataUrl: string): Promise<AddPersonFaceResponse> {
		console.debug(`Adding person face personId[${personId}], imageDataUrl[${imageDataUrl.substring(0, 15)}...].`)
		const headers = this._getDefaultHeaders('application/octet-stream')
		const body = this._createBlob(imageDataUrl)
		return this._addPersonFaceAsync(personId, headers, body)
	}

	/** @inheritdoc */
	public async createPersonAsync(name: string, userData?: UserData | undefined): Promise<CreatePersonResponse> {
		console.log('MicrosoftFaceApi: Create person...', name, userData)

		const method = 'POST'
		const url = `${this._endpoint}persongroups/${this._personGroupId}/persons`
		const headers = this._getDefaultHeaders('application/json')

		// userData is also a JSON encoded string
		const body = JSON.stringify({
			name,
			userData: JSON.stringify(userData),
		})

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers, body }), TIMEOUT)
			await ensureSuccessAsync(res)
			const person: CreatePersonResponse = await res.json()

			console.log('MicrosoftFaceApi: Create person...DONE.', person)
			return person
		} catch (err) {
			console.log('MicrosoftFaceApi: Failed to create person.', name, err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	/** @inheritdoc */
	public async removePersonAsync(personId: AAGUID): Promise<void> {
		console.debug(`MicrosoftFaceApi: Delete person [${personId}]...`)
		const method = 'DELETE'
		const url = `${this._endpoint}persongroups/${this._personGroupId}/persons/${personId}`
		const headers = this._getDefaultHeaders('application/json')

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers }), TIMEOUT)
			await ensureSuccessAsync(res)

			console.info(`MicrosoftFaceApi: Delete person [${personId}]...OK`)
		} catch (err) {
			console.error(`MicrosoftFaceApi: Delete person [${personId}]...OK`, err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	/** @inheritdoc */
	public async createAnonymousPersonWithFacesAsync(imageDataUrls: string[]): Promise<Person> {
		console.log(`MicrosoftFaceApi: Add anonymous person with ${imageDataUrls.length} faces...`)

		const userData: UserData = {
			anonymous: true,
			created: new Date().toISOString(),
			firstName: 'Ukjent',
			lastName: 'Vandrer',
		}

		const name = 'Ukjent Vandrer'
		const createdPerson = await this.createPersonAsync(name, userData)

		const persistedFaceIds: string[] = []
		for (const imageDataUrl of imageDataUrls) {
			const personFace = await this.addPersonFaceWithImageBlobAsync(createdPerson.personId, imageDataUrl)
			persistedFaceIds.push(personFace.persistedFaceId)
		}

		const person: Person = {
			name,
			persistedFaceIds,
			personId: createdPerson.personId,
			userData: JSON.stringify(userData),
		}
		console.log(`MicrosoftFaceApi: Add anonymous person with ${imageDataUrls.length} faces...DONE.`, person)
		return person
	}

	/** @inheritdoc */
	public async detectFacesAsync(imageDataUrl: string) {
		console.log('MicrosoftFaceApi: Detect face and analyze facial attributes with Microsoft Face API.')

		const method = 'POST'
		const url = `${this._endpoint}detect?returnFaceId=true&returnFaceAttributes=${FACE_ATTRIBUTES}&returnFaceLandmarks=false`
		const headers = this._getDefaultHeaders('application/octet-stream')

		const body = this._createBlob(imageDataUrl)

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers, body }), TIMEOUT)

			await ensureSuccessAsync(res)
			const detectedFaces: DetectFacesResponse = await res.json()

			if (detectedFaces.length > 0) {
				console.log(`MicrosoftFaceApi: Detected ${detectedFaces.length} faces.`, detectedFaces)
			} else {
				console.log(`MicrosoftFaceApi: No faces detected.`)
			}
			return detectedFaces
		} catch (err) {
			console.error('MicrosoftFaceApi: Failed to analyze face image.', err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	/** @inheritdoc */
	public async getPersonsAsync(): Promise<Person[]> {
		console.log(`MicrosoftFaceApi: Get all persons.`)

		const method = 'GET'
		const url = `${this._endpoint}persongroups/${this._personGroupId}/persons`
		const headers = this._getDefaultHeaders()

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers }), TIMEOUT)

			await ensureSuccessAsync(res)

			const persons: Person[] = await res.json()
			console.log(`MicrosoftFaceApi: Got ${persons.length} persons in person group.`)
			return persons
		} catch (err) {
			console.error('MicrosoftFaceApi: Failed to get persons in person group.', err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	/** @inheritdoc */
	public async identifyFacesAsync(faceIds: AAGUID[]): Promise<IdentifyFacesResponse> {
		if (faceIds.length < 1 || faceIds.length > 10) { throw new Error('Expected between 1 and 10 face IDs, got ' + faceIds.length) }

		console.log(`MicrosoftFaceApi: Identify ${faceIds.length} faces with Microsoft Face API.`)

		const method = 'POST'
		const url = `${this._endpoint}identify`
		const headers = this._getDefaultHeaders('application/json')

		const body = JSON.stringify({
			faceIds,
			personGroupId: this._personGroupId,
			// maxNumOfCandidatesReturned = 1..5 (1),
			// confidenceThreshold = 0..1 (default depends)
		})

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers, body }), TIMEOUT)

			await ensureSuccessAsync(res)

			const identifiedFaces: IdentifyFacesResponse = await res.json()
			if (identifiedFaces.length === 0) {
				console.log(`MicrosoftFaceApi: No faces were identified.`)
			} else {
				console.info(`MicrosoftFaceApi: Identified ${identifiedFaces.length} faces.`, identifiedFaces)
			}
			return identifiedFaces
		} catch (err) {
			console.error('MicrosoftFaceApi: Failed to identify faces.', err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	/** @inheritdoc */
	public async getPersonAsync(personId: AAGUID) {
		console.log(`MicrosoftFaceApi: Get person ${personId}.`)

		const method = 'GET'
		const url = `${this._endpoint}persongroups/${this._personGroupId}/persons/${personId}`
		const headers = this._getDefaultHeaders()

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers }), TIMEOUT)

			await ensureSuccessAsync(res)
			return res.json()
		} catch (err) {
			console.error('MicrosoftFaceApi: Failed to get person.', err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	/** @inheritdoc */
	public async trainPersonGroupAsync(): Promise<void> {
		const method = 'POST'
		const url = `${this._endpoint}persongroups/${this._personGroupId}/train`
		const headers = this._getDefaultHeaders()

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers }), TIMEOUT)
			await ensureSuccessAsync(res)
		} catch (err) {
			console.error('MicrosoftFaceApi: Failed to get person.', err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	/** @inheritdoc */
	public async getPersonGroupTrainingStatusAsync(): Promise<PersonGroupTrainingStatus> {
		const method = 'GET'
		const url = `${this._endpoint}persongroups/${this._personGroupId}/training`
		const headers = this._getDefaultHeaders()

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers }), TIMEOUT)

			await ensureSuccessAsync(res)
			return res.json()
		} catch (err) {
			console.error('MicrosoftFaceApi: Failed to get person.', err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	private async _addPersonFaceAsync(personId: AAGUID, headers: Headers, body: any) {
		const method = 'POST'
		const url = `${this._endpoint}persongroups/${this._personGroupId}/persons/${personId}/persistedFaces`
		console.debug(`MicrosoftFaceApi: Add person face...`, url)

		try {
			this._onActivityDispatcher.dispatch(true)
			const res = await withTimeout(fetch(url, { method, headers, body }), TIMEOUT)
			await ensureSuccessAsync(res)
			const result: AddPersonFaceResponse = await res.json()

			console.info('MicrosoftFaceApi: Add person face...DONE.', url)
			return result
		} catch (err) {
			console.error('MicrosoftFaceApi: Failed to add person face.', url, err)
			throw err
		} finally {
			this._onActivityDispatcher.dispatch(false)
		}
	}

	// Convert a data URL to a file blob for POST request
	private _createBlob(dataURL: string) {
		const BASE64_MARKER = 'base64,'

		if (dataURL.indexOf(BASE64_MARKER) === -1) {
			const parts = dataURL.split(',')
			const contentType = parts[0].split(':')[1]
			const raw = decodeURIComponent(parts[1])
			return new Blob([raw], { type: contentType })
		} else {
			const parts = dataURL.split(BASE64_MARKER)
			const contentType = parts[0].split(':')[1]
			const raw = window.atob(parts[1])
			const rawLength = raw.length

			const arr = new Uint8Array(rawLength)
			for (let i = 0; i < rawLength; ++i) {
				arr[i] = raw.charCodeAt(i)
			}

			return new Blob([arr], { type: contentType })
		}
	}

	private _getDefaultHeaders(contentType?: string) {
		const headers = new Headers()
		headers.append('Ocp-Apim-Subscription-Key', this._subscriptionKey)
		headers.append('Accept', 'application/json')
		if (contentType) {
			headers.append('Content-Type', contentType)
		}
		return headers
	}

}

// tslint:disable-next-line:max-classes-per-file
export class HttpError extends Error {
	public readonly body: Promise<any>
	constructor(public msg: string, public response: Response) {
		super(msg)
		this.body = response.json()
	}

	public get statusCode() { return this.response.status }
}

// tslint:disable-next-line:max-classes-per-file
export class ThrottledHttpError extends HttpError {
	constructor(public msg: string, public response: Response) {
		super(msg, response)
		if (response.status !== 429) { throw new Error('Expected status code 429 for a throttled error.') }
	}
}

export default MicrosoftFaceApi
