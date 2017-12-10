import * as React from 'react'

// tslint:disable-next-line:no-empty-interface
interface State {
}

interface Props {
	emoji: string
	status: string
}

export interface EmojiStatusViewModel {
	readonly type: 'emojiStatus'
	readonly emoji: string
	readonly status: string
}

export class EmojiStatus extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props)

		this.state = {
			emoji: '😶',
			status: 'Ikke startet enda...',
		}

	}

	public render() {
		return (
		<div>
				<div style={{ textAlign: 'center', fontSize: 49/* Android Chrome size constraint*/ }}>{this.props.emoji}</div>
				<div style={{ textAlign: 'center', fontSize: '2em' }}><span>{this.props.status}</span></div>
		</div>
		)
	}
}

export default EmojiStatus
