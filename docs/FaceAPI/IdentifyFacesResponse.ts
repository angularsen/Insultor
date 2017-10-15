export interface Candidate {
	personId: string
	confidence: number
}

export interface IdentifyFaceResult {
	faceId: string
	candidates: Candidate[]
}

export type IdentifyFacesResponse = IdentifyFaceResult[]
export default IdentifyFacesResponse
