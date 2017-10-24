import { IdentifyFacesResponse } from '../../../docs/FaceAPI/IdentifyFacesResponse'
import { ICommentProvider } from '../CommentProvider'

export class FakeCommentProvider implements ICommentProvider {
	public getComments(identifyFacesResponse: IdentifyFacesResponse): string[] {
		return identifyFacesResponse.map((x, i) => 'Fake joke #' + i)
	}
}

export default FakeCommentProvider
