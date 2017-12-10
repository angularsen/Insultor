import * as React from 'react'

interface Props {
	name: string
	comment: string
	imageDataUrl: string
}

export interface CommentOnPersonViewModel {
	readonly type: 'commentOnPerson'
	readonly comment: string
	readonly imageDataUrl: string
	readonly name: string
}

export class CommentOnPerson extends React.PureComponent<Props> {
	public render() {
		return (
			<div>
				<div style={{ textAlign: 'center' }}><img src={this.props.imageDataUrl} style={{ width: 400 }} /></div>
				<div style={{ textAlign: 'center', fontSize: '2em' }}><span>{this.props.name}</span></div>
				<div style={{ textAlign: 'center', fontSize: '1.2em' }}><span>{this.props.comment}</span></div>
			</div>
		)
	}
}

export default CommentOnPerson
