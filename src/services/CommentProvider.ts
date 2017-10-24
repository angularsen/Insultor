import { IdentifyFacesResponse } from '../../docs/FaceAPI/IdentifyFacesResponse'

export interface ICommentProvider {
	getComments(identifyFacesResponse: IdentifyFacesResponse): string[]
}
