import { DetectFacesResponse } from '../../docs/FaceAPI/DetectFacesResponse'
import { IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'
import { Person } from '../../docs/FaceAPI/Person'

const PERSONGROUPID_WEBSTEPTRONDHEIM = 'insultor-webstep-trd'
const SUBSCRIPTIONKEY_DEFAULT = '93a68a5ab7d94ca0984fea54a332ad89'
const ENDPOINT_DEFAULT = 'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/'

const FACE_ATTRIBUTES = 'age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise'

export interface IMicrosoftFaceApi {
	detectFacesAsync(imageDataUrl: string): Promise<DetectFacesResponse>
	getPersonAsync(personGroupId: string, personId: AAGUID): Promise<Person>
	identifyFacesAsync(faceIds: AAGUID[], personGroupId: string): Promise<IdentifyFacesResponse>
}

export class MicrosoftFaceApi implements IMicrosoftFaceApi {
	private endpointIdentifyFace: string
	private endpointDetectFace: string

	constructor(
		private subscriptionKey = SUBSCRIPTIONKEY_DEFAULT,
		private endpoint = ENDPOINT_DEFAULT,
	) {
		this.endpointDetectFace = endpoint + 'detect'
		this.endpointIdentifyFace = endpoint + 'identify'
	}

	/**
	 * Detect face and analyze facial attributes of photo with Microsoft Face API.
	 * @param {string} imageDataUrl URL encoded representation of image, obtained by canvas.toDataUrl()
	 * @returns Promise that on success returns an array of face entries ranked by face rectangle size in descending order,
	 * otherwise returns the error.
	 * An empty response indicates no faces detected.
	 * Face entry shape: { faceId: string, faceRectangle: Object, faceLandmarks: Object, faceAttributes: Object }
	 * @see https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395236
	 */
	public detectFacesAsync(imageDataUrl: string) {
		console.log('MsFaceApi: Detect face and analyze facial attributes with Microsoft Face API.')

		const method = 'POST'
		const url = `${this.endpointDetectFace}?returnFaceId=true&returnFaceAttributes=${FACE_ATTRIBUTES}&returnFaceLandmarks=false`
		const headers = new Headers()
		headers.append('Content-Type', 'application/octet-stream')
		headers.append('Ocp-Apim-Subscription-Key', this.subscriptionKey)

		const body = this._createBlob(imageDataUrl)

		return fetch(url, { method, headers, body })
			.then(async res => {
				if (!res.ok) {
					switch (res.status) {
						case 429: {
							const responseBody = await res.json()
							throw new HttpError('Rate limit exceeded.', res, responseBody)
						}
						default: {
							const responseBody = await res.json()
							throw new HttpError(`Request failed with status ${res.status} ${res.statusText}`, res, responseBody)
						}
					}
				}
				return res.json()
			})
			.then(detectedFaces => {
				if (detectedFaces.length > 0) {
					console.log(`MsFaceApi: No faces detected.`)
				} else {
					console.log(`MsFaceApi: Detected ${detectedFaces.length} faces.`, detectedFaces)
				}
				return detectedFaces
			})
			.catch(err => {
				console.error('MsFaceApi: Failed to analyze face image.', err)
				throw err
			})
	}

	/**
	 * Identify up to 10 faces given a list of face IDs from a prior call to detectFaces().
	 * @param {Array} Array of query faces faceIds, created by the detectFace(). Each of the faces are identified independently.
	 * The valid number of faceIds is between [1, 10].
	 * @returns Promise that on success returns the identified candidate person(s) for each query face. Otherwise returns the error.
	 * @see https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395239
	 */
	public identifyFacesAsync(faceIds: AAGUID[], personGroupId: string = PERSONGROUPID_WEBSTEPTRONDHEIM) {
		if (faceIds.length < 1) { throw new Error('Expected between 1 and 10 face IDs, got ' + faceIds.length) }

		console.log(`MsFaceApi: Identify ${faceIds.length} faces with Microsoft Face API.`)

		const method = 'POST'
		const url = this.endpointIdentifyFace
		const headers = new Headers()
		headers.append('Accept', 'application/json')
		headers.append('Content-Type', 'application/json')
		headers.append('Ocp-Apim-Subscription-Key', this.subscriptionKey)

		const body = JSON.stringify({
			faceIds,
			personGroupId,
			// maxNumOfCandidatesReturned = 1..5 (1),
			// confidenceThreshold = 0..1 (default depends)
		})

		return fetch(url, { method, headers, body })
			.then(async res => {
				if (!res.ok) {
					switch (res.status) {
						case 429: {
							throw new HttpError('Rate limit exceeded.', res, await res.json())
						}
						default: {
							throw new HttpError(`Request failed with status ${res.status} ${res.statusText}`, res, await res.json())
						}
					}
				}
				return res.json()
			})
			.then(identifiedFaces => {
				if (identifiedFaces.length > 0) {
					console.log(`MsFaceApi: No faces were identified.`)
				} else {
					console.info(`MsFaceApi: Detected ${identifiedFaces.length} faces.`, identifiedFaces)
				}
				return identifiedFaces
			})
			.catch(err => {
				console.error('MsFaceApi: Failed to identify faces.', err)
				throw err
			})
	}

	public getPersonAsync(personGroupId: string, personId: AAGUID) {

		console.log(`MsFaceApi: Get person ${personId}.`)

		const method = 'GET'
		const url = `${this.endpoint}persongroups/${personGroupId}/persons/${personId}`
		const headers = new Headers()
		headers.append('Accept', 'application/json')
		headers.append('Ocp-Apim-Subscription-Key', this.subscriptionKey)

		return fetch(url, { method, headers })
					.then(async res => {
						if (!res.ok) {
							switch (res.status) {
								case 429: {
									throw new HttpError('Rate limit exceeded.', res, await res.json())
								}
								default: {
									throw new HttpError(`Request failed with status ${res.status} ${res.statusText}`, res, await res.json())
								}
							}
						}
						return res.json()
					})
					.catch(err => {
						console.error('MsFaceApi: Failed to get person.', err)
						throw err
					})

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

}

// tslint:disable-next-line:max-classes-per-file
class HttpError extends Error {
	constructor(public msg: string, public response: Response, public responseBody: string) {
		super(msg)
	}
}

export default MicrosoftFaceApi