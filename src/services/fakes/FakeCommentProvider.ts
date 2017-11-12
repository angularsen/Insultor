import { ICommentProvider, PersonInfo } from '../CommentProvider'

export class FakeCommentProvider implements ICommentProvider {
	public getCommentForPerson(person: PersonInfo): string {
		return 'Fake comment'
	}
}

export default FakeCommentProvider
